import { randomUUID } from 'crypto';
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
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
import { ADMIN_TRANSFER_RELATIONS } from './transfer.constants';

type TransferWithTransactions = Prisma.TransferGetPayload<{
  include: { transactions: true };
}>;

@Injectable()
export class TransferService {
  private readonly logger = new Logger(TransferService.name);
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
      throw new NotFoundException('Transfer not found');
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
      throw new NotFoundException('Transfer not found');
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

  async getAllTransfers(status?: string) {
    const where = status ? { approval_state: status } : {};

    const transfers = await this.prisma.transfer.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: ADMIN_TRANSFER_RELATIONS,
    });

    return {
      success: true,
      total: transfers.length,
      data: transfers,
    };
  }

  async executeDraftTransfer(transferId: string) {
    const client = this.getPayoutClient();

    // 1. Find and validate transfer
    const transfer = await this.prisma.transfer.findUnique({
      where: { transfer_id: transferId },
      include: { transactions: true },
    });

    if (!transfer) {
      throw new NotFoundException('Transfer không tồn tại');
    }

    if (transfer.approval_state !== 'DRAFTING') {
      throw new BadRequestException(
        `Transfer đang ở trạng thái "${transfer.approval_state}", chỉ có thể thực thi DRAFTING transfers`,
      );
    }

    if (!transfer.user_id) {
      throw new BadRequestException('Transfer không có user_id');
    }

    // 2. Lazy Fetching: Get freshest bank info from UserProfile
    const userProfile = await this.prisma.userProfile.findUnique({
      where: { user_id: transfer.user_id },
      include: { user: true },
    });

    if (!userProfile || !userProfile.bank_bin || !userProfile.bank_account) {
      throw new BadRequestException(
        'Người dùng chưa cập nhật thông tin ngân hàng. Vui lòng yêu cầu người dùng cập nhật trước khi duyệt.',
      );
    }

    // 3. Call PayOS SDK
    const transaction = transfer.transactions[0];
    if (!transaction) {
      throw new BadRequestException('Transfer không có transaction nào');
    }

    try {
      const payout = await client.payouts.create({
        referenceId: transfer.reference_id,
        amount: Number(transaction.amount),
        description: transaction.description,
        toBin: userProfile.bank_bin,
        toAccountNumber: userProfile.bank_account,
      });

      // 4. Update Transfer with PayOS response
      await this.prisma.transfer.update({
        where: { transfer_id: transferId },
        data: {
          payout_id: payout.id,
          approval_state: payout.approvalState,
        },
      });

      // 5. Update TransferTransaction(s) with PayOS response
      for (const payosTx of payout.transactions) {
        await this.prisma.transferTransaction.update({
          where: { reference_id: transaction.reference_id },
          data: {
            payout_transaction_id: payosTx.id,
            to_bin: payosTx.toBin,
            to_account_number: payosTx.toAccountNumber,
            to_account_name: payosTx.toAccountName ?? userProfile.user.full_name,
            reference: payosTx.reference ?? undefined,
            transaction_datetime: this.parseTransactionDate(payosTx.transactionDatetime),
            error_message: payosTx.errorMessage ?? undefined,
            error_code: payosTx.errorCode ?? undefined,
            state: payosTx.state,
          },
        });
      }

      this.logger.log(`[Admin] Executed transfer ${transferId} via PayOS (payout_id: ${payout.id})`);

      // 6. Fetch and return the updated transfer
      const updated = await this.prisma.transfer.findUniqueOrThrow({
        where: { transfer_id: transferId },
        include: ADMIN_TRANSFER_RELATIONS,
      });

      return { success: true, data: updated };
    } catch (error) {
      this.handlePayosError(error);
    }
  }


  async rejectDraftTransfer(transferId: string, reason: string) {
    const transfer = await this.prisma.transfer.findUnique({
      where: { transfer_id: transferId },
      include: { transactions: true },
    });

    if (!transfer) {
      throw new NotFoundException('Transfer không tồn tại');
    }

    if (transfer.approval_state !== 'DRAFTING') {
      throw new BadRequestException(
        `Transfer đang ở trạng thái "${transfer.approval_state}", chỉ có thể từ chối DRAFTING transfers`,
      );
    }

    // Update transfer state
    await this.prisma.transfer.update({
      where: { transfer_id: transferId },
      data: { approval_state: 'REJECTED' },
    });

    // Update transaction(s) with rejection reason
    if (transfer.transactions.length > 0) {
      await this.prisma.transferTransaction.updateMany({
        where: { transfer_id: transferId },
        data: {
          state: 'REJECTED',
          error_message: reason,
        },
      });
    }

    // Notify the user
    if (transfer.user_id) {
      await this.prisma.notification.create({
        data: {
          user_id: transfer.user_id,
          type: 'SYSTEM',
          title: 'Lệnh chuyển tiền bị từ chối',
          message: `Lệnh chuyển tiền (Mã: ${transfer.reference_id}) đã bị từ chối. Lý do: ${reason}`,
          created_at: new Date(),
        },
      });
    }

    this.logger.log(`[Admin] Rejected transfer ${transferId}. Reason: ${reason}`);

    const updated = await this.prisma.transfer.findUniqueOrThrow({
      where: { transfer_id: transferId },
      include: ADMIN_TRANSFER_RELATIONS,
    });

    return { success: true, data: updated };
  }

  async getMyTransferHistory(userId: string) {
    const transfers = await this.prisma.transfer.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      include: {
        transactions: { orderBy: { created_at: 'asc' as const } },
        order: {
          select: {
            order_id: true,
            status: true,
            deposit_amount: true,
            created_at: true,
          },
        },
      },
    });

    return {
      success: true,
      total: transfers.length,
      data: transfers.map((t) => this.toTransferResponse(t)),
    };
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


  private async createDraftTransfer(
    userId: string,
    orderId: string,
    finalAmount: Prisma.Decimal,
    description: string,
  ) {
    // 1. Lazy Fetching Bank Info
    const userProfile = await this.prisma.userProfile.findUnique({
      where: { user_id: userId },
      include: { user: true },
    });

    const hasBankInfo = userProfile && userProfile.bank_bin && userProfile.bank_account;

    // 2. Create Transfer Record (DRAFTING)
    const referenceId = randomUUID();
    const transfer = await this.prisma.transfer.create({
      data: {
        reference_id: referenceId,
        user_id: userId,
        order_id: orderId,
        total_credit: finalAmount, // EXACT final amount
        approval_state: 'DRAFTING',
        transactions: {
          create: {
            reference_id: randomUUID(),
            amount: finalAmount,
            description: description,
            state: 'DRAFTING',
            to_bin: hasBankInfo ? userProfile.bank_bin : null,
            to_account_number: hasBankInfo ? userProfile.bank_account : null,
            to_account_name: hasBankInfo ? userProfile.user.full_name : null,
          },
        },
      },
    });

    // 3. Trigger Notification if bank info is missing
    if (!hasBankInfo) {
      await this.prisma.notification.create({
        data: {
          user_id: userId,
          type: 'SYSTEM',
          title: 'Cập nhật thông tin ngân hàng',
          message: `Vui lòng cập nhật thông tin tài khoản ngân hàng trong hồ sơ để chúng tôi có thể duyệt lệnh chuyển tiền (Mã: ${referenceId}).`,
          created_at: new Date(),
        },
      });
    }

    return transfer;
  }

  // 1. Happy Path (Order COMPLETED)
  async createPayoutForCompletedOrder(order: any) {
    const totalPrice = order.orderDetails.reduce(
      (acc: Prisma.Decimal, curr: any) => acc.add(new Prisma.Decimal(curr.total_price)),
      new Prisma.Decimal(0),
    );
    const fee = totalPrice.mul(0.07); // 7% platform fee
    const payoutAmount = totalPrice.sub(fee);

    return this.createDraftTransfer(
      order.listing.seller_id,
      order.order_id,
      payoutAmount,
      `Thanh toán đơn hàng ${order.order_id.split('-')[0]} (đã trừ 7% phí)`,
    );
  }

  // 2. SLA Timeout (Order FORFEITED)
  async createForfeitCompensation(order: any) {
    return this.createDraftTransfer(
      order.listing.seller_id,
      order.order_id,
      new Prisma.Decimal(order.deposit_amount),
      `Bồi thường cọc đơn hàng ${order.order_id.split('-')[0]} (Người mua quá hạn thanh toán)`,
    );
  }

  // 3. Seller Rejects (Order CANCELLED_BY_SELLER)
  async createSellerRejectRefund(order: any) {
    return this.createDraftTransfer(
      order.buyer_id,
      order.order_id,
      new Prisma.Decimal(order.deposit_amount),
      `Hoàn cọc đơn hàng ${order.order_id.split('-')[0]} (Người bán từ chối)`,
    );
  }

  // 4. Buyer Cancels (Order CANCELLED_BY_BUYER)
  async createBuyerCancelTransfer(order: any) {
    // Note: status here refers to the state BEFORE cancellation.
    // If we only have the current status, you might check if they had already paid the full amount or confirmed.
    // E.g. we can pass the "previousStatus" safely. 
    // Assuming 'DEPOSITED' -> Refund Buyer, else -> Compensate Seller.
    if (order.status === 'DEPOSITED' || order.status === 'PENDING') {
      return this.createDraftTransfer(
        order.buyer_id,
        order.order_id,
        new Prisma.Decimal(order.deposit_amount),
        `Hoàn cọc đơn hàng ${order.order_id.split('-')[0]} (Người mua tự hủy)`,
      );
    } else {
      // Order status was CONFIRMED or PAID
      return this.createDraftTransfer(
        order.listing.seller_id,
        order.order_id,
        new Prisma.Decimal(order.deposit_amount),
        `Bồi thường cọc đơn hàng ${order.order_id.split('-')[0]} (Người mua hủy sau xác nhận)`,
      );
    }
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
