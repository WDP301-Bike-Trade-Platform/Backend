import { randomUUID } from 'crypto';
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PayOS, APIError, Payout } from '@payos/node';
import { ConfigService } from '@nestjs/config';
import { Prisma, TransferTransaction } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { CreateTransferDto } from './dtos/create-transfer.dto';
import { CreateBatchTransferDto } from './dtos/create-batch-transfer.dto';
import { EstimateCreditDto } from './dtos/estimate-credit.dto';
import {
  TransferResponse,
  TransferTransactionResponse,
} from './dtos/transfer-response.dto';

type TransferWithTransactions = Prisma.TransferGetPayload<{
  include: { transactions: true };
}>;

@Injectable()
export class TransferService {
  private readonly payoutClient: PayOS | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const clientId = this.configService.get<string>('PAYOUT_CLIENT_ID');
    const apiKey = this.configService.get<string>('PAYOUT_API_KEY');
    const checksumKey = this.configService.get<string>('PAYOUT_CHECKSUM_KEY');

    if (clientId && apiKey && checksumKey) {
      this.payoutClient = new PayOS({
        clientId,
        apiKey,
        checksumKey,
      });
    } else {
      this.payoutClient = null;
    }
  }

  async createTransfer(
    userId: string,
    dto: CreateTransferDto,
  ): Promise<TransferResponse> {
    const client = this.getPayoutClient();
    try {
      const referenceId = randomUUID();
      const normalizedCategory = this.normalizeCategory(dto.category);
      const payout = await client.payouts.create({
        referenceId,
        amount: dto.amount,
        description: dto.description,
        toBin: dto.toBin,
        toAccountNumber: dto.toAccountNumber,
        category: normalizedCategory ?? undefined,
      });

      const transfer = await this.persistTransfer(
        payout,
        userId,
        normalizedCategory ?? undefined,
      );
      return this.toTransferResponse(transfer);
    } catch (error) {
      this.handlePayosError(error);
    }
  }

  async createBatchTransfer(
    userId: string,
    dto: CreateBatchTransferDto,
  ): Promise<TransferResponse> {
    const client = this.getPayoutClient();
    try {
      const referenceId = randomUUID();
      const batchCategory = this.normalizeCategory(
        dto.transfers.flatMap((transfer) => transfer.category ?? []),
      );
      const payout = await client.payouts.batch.create({
        referenceId,
        category: batchCategory,
        payouts: dto.transfers.map((transfer) => ({
          referenceId: randomUUID(),
          amount: transfer.amount,
          description: transfer.description,
          toBin: transfer.toBin,
          toAccountNumber: transfer.toAccountNumber,
        })),
      });

      const transfer = await this.persistTransfer(
        payout,
        userId,
        batchCategory ?? undefined,
      );
      return this.toTransferResponse(transfer);
    } catch (error) {
      this.handlePayosError(error);
    }
  }

  async estimateCredit(dto: EstimateCreditDto) {
    const client = this.getPayoutClient();
    try {
      const batchCategory = this.normalizeCategory(
        dto.transfers.flatMap((transfer) => transfer.category ?? []),
      );
      const payload = {
        referenceId: randomUUID(),
        category: batchCategory,
        payouts: dto.transfers.map((transfer) => ({
          referenceId: randomUUID(),
          amount: transfer.amount,
          description: transfer.description,
          toBin: transfer.toBin,
          toAccountNumber: transfer.toAccountNumber,
        })),
      };
      return await client.payouts.estimateCredit(payload);
    } catch (error) {
      this.handlePayosError(error);
    }
  }

  async getAccountBalance() {
    const client = this.getPayoutClient();
    try {
      return await client.payoutsAccount.balance();
    } catch (error) {
      this.handlePayosError(error);
    }
  }

  async getTransferById(
    transferId: string,
    userId: string,
  ): Promise<TransferResponse> {
    const transfer = await this.prisma.transfer.findUnique({
      where: { transfer_id: transferId },
      include: { transactions: true },
    });

    if (!transfer || transfer.user_id !== userId) {
      throw new NotFoundException('Không tìm thấy giao dịch chuyển khoản');
    }

    const synced = await this.syncTransferWithPayos(transfer);
    return this.toTransferResponse(synced);
  }

  async getTransferByReference(
    referenceId: string,
    userId: string,
  ): Promise<TransferResponse> {
    const transfer = await this.prisma.transfer.findUnique({
      where: { reference_id: referenceId },
      include: { transactions: true },
    });

    if (!transfer || transfer.user_id !== userId) {
      throw new NotFoundException('Không tìm thấy giao dịch chuyển khoản');
    }

    const synced = await this.syncTransferWithPayos(transfer);
    return this.toTransferResponse(synced);
  }

  async getTransfersForUser(userId: string): Promise<TransferResponse[]> {
    const transfers = await this.prisma.transfer.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      include: {
        transactions: {
          orderBy: { created_at: 'asc' },
        },
      },
    });

    return transfers.map((transfer) => this.toTransferResponse(transfer));
  }

  private async persistTransfer(
    payout: Payout,
    userId: string,
    fallbackCategory?: string[] | null,
  ): Promise<TransferWithTransactions> {
    const category = payout.category ?? fallbackCategory ?? null;
    const totalCredit = payout.transactions.reduce(
      (sum, transaction) => sum + transaction.amount,
      0,
    );

    return this.prisma.transfer.create({
      data: {
        reference_id: payout.referenceId,
        payout_id: payout.id,
        user_id: userId,
        approval_state: payout.approvalState,
        total_credit: totalCredit,
        category: category ?? undefined,
        transactions: {
          create: payout.transactions.map((transaction) => ({
            reference_id: transaction.referenceId,
            payout_transaction_id: transaction.id,
            amount: transaction.amount,
            description: transaction.description,
            to_bin: transaction.toBin,
            to_account_number: transaction.toAccountNumber,
            to_account_name: transaction.toAccountName ?? undefined,
            reference: transaction.reference ?? undefined,
            transaction_datetime: this.parseTransactionDate(
              transaction.transactionDatetime,
            ),
            error_message: transaction.errorMessage ?? undefined,
            error_code: transaction.errorCode ?? undefined,
            state: transaction.state,
          })),
        },
      },
      include: {
        transactions: true,
      },
    });
  }

  private async syncTransferWithPayos(
    transfer: TransferWithTransactions,
  ): Promise<TransferWithTransactions> {
    const client = this.getPayoutClient();
    try {
      let payout: Payout | null = null;
      if (transfer.payout_id) {
        payout = await client.payouts.get(transfer.payout_id);
      } else {
        const page = await client.payouts.list({
          referenceId: transfer.reference_id,
          limit: 1,
        });
        payout = page.data[0] ?? null;
      }

      if (!payout) {
        return transfer;
      }

      await this.prisma.transfer.update({
        where: { transfer_id: transfer.transfer_id },
        data: {
          payout_id: payout.id,
          approval_state: payout.approvalState,
          category: payout.category ?? undefined,
        },
      });

      for (const transaction of payout.transactions) {
        await this.prisma.transferTransaction.upsert({
          where: { reference_id: transaction.referenceId },
          create: {
            transfer_id: transfer.transfer_id,
            reference_id: transaction.referenceId,
            payout_transaction_id: transaction.id,
            amount: transaction.amount,
            description: transaction.description,
            to_bin: transaction.toBin,
            to_account_number: transaction.toAccountNumber,
            to_account_name: transaction.toAccountName ?? undefined,
            reference: transaction.reference ?? undefined,
            transaction_datetime: this.parseTransactionDate(
              transaction.transactionDatetime,
            ),
            error_message: transaction.errorMessage ?? undefined,
            error_code: transaction.errorCode ?? undefined,
            state: transaction.state,
          },
          update: {
            payout_transaction_id: transaction.id,
            amount: transaction.amount,
            description: transaction.description,
            to_bin: transaction.toBin,
            to_account_number: transaction.toAccountNumber,
            to_account_name: transaction.toAccountName ?? undefined,
            reference: transaction.reference ?? undefined,
            transaction_datetime: this.parseTransactionDate(
              transaction.transactionDatetime,
            ),
            error_message: transaction.errorMessage ?? undefined,
            error_code: transaction.errorCode ?? undefined,
            state: transaction.state,
          },
        });
      }

      return this.prisma.transfer.findUniqueOrThrow({
        where: { transfer_id: transfer.transfer_id },
        include: { transactions: true },
      });
    } catch (error) {
      this.handlePayosError(error);
    }
  }

  private toTransferResponse(transfer: TransferWithTransactions): TransferResponse {
    return {
      transferId: transfer.transfer_id,
      referenceId: transfer.reference_id,
      payoutId: transfer.payout_id,
      totalCredit: transfer.total_credit
        ? Number(transfer.total_credit)
        : null,
      category: this.parseCategory(transfer.category),
      approvalState: transfer.approval_state,
      createdAt: transfer.created_at,
      updatedAt: transfer.updated_at ?? undefined,
      transactions: transfer.transactions.map((transaction) =>
        this.toTransactionResponse(transaction),
      ),
    };
  }

  private toTransactionResponse(
    transaction: TransferTransaction,
  ): TransferTransactionResponse {
    return {
      transferTransactionId: transaction.transfer_transaction_id,
      referenceId: transaction.reference_id,
      payoutTransactionId: transaction.payout_transaction_id,
      amount: Number(transaction.amount),
      description: transaction.description,
      toBin: transaction.to_bin,
      toAccountNumber: transaction.to_account_number,
      toAccountName: transaction.to_account_name,
      reference: transaction.reference,
      transactionDatetime: transaction.transaction_datetime ?? undefined,
      errorMessage: transaction.error_message,
      errorCode: transaction.error_code,
      state: transaction.state,
    };
  }

  private parseCategory(
    category: Prisma.JsonValue | null,
  ): string[] | null {
    if (!category) {
      return null;
    }
    if (Array.isArray(category)) {
      return category.filter((item): item is string => typeof item === 'string');
    }
    return null;
  }

  private parseTransactionDate(value?: string | null) {
    if (!value) {
      return undefined;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private normalizeCategory(values?: string[] | null): string[] | null {
    if (!values || values.length === 0) {
      return null;
    }
    const normalized = values
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter((value) => value.length > 0);
    const unique = Array.from(new Set(normalized));
    return unique.length ? unique : null;
  }

  private getPayoutClient(): PayOS {
    if (!this.payoutClient) {
      throw new BadRequestException(
        'Chưa cấu hình thông tin PayOS payout để thực hiện chuyển khoản',
      );
    }
    return this.payoutClient;
  }

  private handlePayosError(error: unknown): never {
    if (error instanceof APIError) {
      throw new BadRequestException(
        error.desc ?? error.message ?? 'PayOS payout request failed',
      );
    }
    throw error as Error;
  }
}
