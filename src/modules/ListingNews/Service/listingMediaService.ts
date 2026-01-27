import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { MediaType, ListingStatus } from '@prisma/client';

@Injectable()
export class ListingMediaService {
  constructor(private readonly prisma: PrismaService) {}

  // ==========================
  // HELPERS
  // ==========================

  private async assertListingEditable(listingId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { listing_id: listingId },
      select: { status: true },
    });

    if (!listing) {
      throw new BadRequestException('Listing không tồn tại');
    }

    if (
      listing.status === ListingStatus.SOLD ||
      listing.status === ListingStatus.HIDDEN
    ) {
      throw new BadRequestException(
        'Listing không thể chỉnh sửa media',
      );
    }
  }

  private async getMediaOrThrow(mediaId: string) {
    const media = await this.prisma.listingMedia.findUnique({
      where: { media_id: mediaId },
    });

    if (!media) {
      throw new BadRequestException('Media không tồn tại');
    }

    return media;
  }

  // ==========================
  // GET MEDIA
  // ==========================
  async getByListing(listingId: string) {
    return this.prisma.listingMedia.findMany({
      where: { listing_id: listingId },
      orderBy: [
        { is_cover: 'desc' },
        { uploaded_at: 'asc' },
      ],
    });
  }

  // ==========================
  // ADD MANY
  // ==========================
  async addMedia(
    listingId: string,
    files: {
      file_url: string;
      mime_type: string;
      size_bytes: bigint;
      type: MediaType;
    }[],
  ) {
    await this.assertListingEditable(listingId);

    const count = await this.prisma.listingMedia.count({
      where: { listing_id: listingId },
    });

    if (count + files.length > 10) {
      throw new BadRequestException(
        'Mỗi tin tối đa 10 ảnh',
      );
    }

    const hasCover = await this.prisma.listingMedia.findFirst({
      where: {
        listing_id: listingId,
        is_cover: true,
      },
    });

    return this.prisma.$transaction(
      files.map((file, index) =>
        this.prisma.listingMedia.create({
          data: {
            ...file,
            listing_id: listingId,
            is_cover: !hasCover && index === 0,
            uploaded_at: new Date(),
          },
        }),
      ),
    );
  }

  // ==========================
  // SET COVER
  // ==========================
  async setCover(mediaId: string) {
    const media = await this.getMediaOrThrow(mediaId);
    await this.assertListingEditable(media.listing_id);

    await this.prisma.$transaction([
      this.prisma.listingMedia.updateMany({
        where: { listing_id: media.listing_id },
        data: { is_cover: false },
      }),
      this.prisma.listingMedia.update({
        where: { media_id: mediaId },
        data: { is_cover: true },
      }),
    ]);

    return { message: 'Đã đặt ảnh đại diện' };
  }

  // ==========================
  // REPLACE FILE
  // ==========================
  async replaceMedia(
    mediaId: string,
    data: {
      file_url: string;
      mime_type: string;
      size_bytes: bigint;
    },
  ) {
    const media = await this.getMediaOrThrow(mediaId);
    await this.assertListingEditable(media.listing_id);

    // TODO: hook delete old file (S3 / Cloudinary) nếu cần

    return this.prisma.listingMedia.update({
      where: { media_id: mediaId },
      data,
    });
  }

  // ==========================
  // DELETE ONE
  // ==========================
  async deleteOne(mediaId: string) {
    const media = await this.getMediaOrThrow(mediaId);
    await this.assertListingEditable(media.listing_id);

    await this.prisma.listingMedia.delete({
      where: { media_id: mediaId },
    });

    // Nếu xóa cover → set cover mới
    if (media.is_cover) {
      const next = await this.prisma.listingMedia.findFirst({
        where: { listing_id: media.listing_id },
        orderBy: { uploaded_at: 'asc' },
      });

      if (next) {
        await this.prisma.listingMedia.update({
          where: { media_id: next.media_id },
          data: { is_cover: true },
        });
      }
    }

    return { message: 'Xóa media thành công' };
  }

  // ==========================
  // DELETE MANY
  // ==========================
  async deleteMany(mediaIds: string[]) {
    if (!mediaIds.length) {
      throw new BadRequestException(
        'Danh sách media rỗng',
      );
    }

    const medias = await this.prisma.listingMedia.findMany({
      where: { media_id: { in: mediaIds } },
    });

    if (!medias.length) {
      throw new BadRequestException(
        'Media không tồn tại',
      );
    }

    const listingId = medias[0].listing_id;
    await this.assertListingEditable(listingId);

    const deletingCover = medias.some(
      (m) => m.is_cover,
    );

    await this.prisma.listingMedia.deleteMany({
      where: { media_id: { in: mediaIds } },
    });

    if (deletingCover) {
      const next = await this.prisma.listingMedia.findFirst({
        where: { listing_id: listingId },
        orderBy: { uploaded_at: 'asc' },
      });

      if (next) {
        await this.prisma.listingMedia.update({
          where: { media_id: next.media_id },
          data: { is_cover: true },
        });
      }
    }

    return { message: 'Xóa nhiều media thành công' };
  }
}
