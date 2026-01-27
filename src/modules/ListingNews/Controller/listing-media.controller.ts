import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ListingMediaService } from '../Service/listingMediaService';
import { AddMediaDto } from '../DTOs/media/add-media.dto';
import { ReplaceMediaDto } from '../DTOs/media/replace-media.dto';
import { DeleteManyMediaDto } from '../DTOs/media/delete-many-media.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/auth/jwt.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
@ApiTags('Listings Media')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(1)
@Controller('listings/:listingId/media')
export class ListingMediaController {
  constructor(private readonly mediaService: ListingMediaService) {}

  @Get()
  getByListing(@Param('listingId') listingId: string) {
    return this.mediaService.getByListing(listingId);
  }

  @Post()
  addMedia(@Param('listingId') listingId: string, @Body() body: AddMediaDto) {
    return this.mediaService.addMedia(
      listingId,
      body.files.map((file) => ({
        file_url: file.file_url,
        mime_type: file.mime_type,
        size_bytes: BigInt(file.size_bytes),
        type: file.media_type, // ✅ đồng bộ với service
      })),
    );
  }

  @Patch(':mediaId/cover')
  setCover(@Param('mediaId') mediaId: string) {
    return this.mediaService.setCover(mediaId);
  }

  @Patch(':mediaId')
  replaceMedia(
    @Param('mediaId') mediaId: string,
    @Body() body: ReplaceMediaDto,
  ) {
    return this.mediaService.replaceMedia(mediaId, {
      file_url: body.file_url,
      mime_type: body.mime_type,
      size_bytes: BigInt(body.size_bytes),
    });
  }

  @Delete(':mediaId')
  deleteOne(@Param('mediaId') mediaId: string) {
    return this.mediaService.deleteOne(mediaId);
  }

  @Delete()
  deleteMany(
    @Param('listingId') listingId: string,
    @Body() body: DeleteManyMediaDto,
  ) {
    return this.mediaService.deleteMany(body.mediaIds);
  }
}
