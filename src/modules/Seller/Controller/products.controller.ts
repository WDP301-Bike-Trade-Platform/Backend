import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ProductsService } from '../Service/products.service';
import { CreateListingDto } from '../DTOs/create-listing.dto';
import { JwtAuthGuard } from 'src/common/auth/jwt.guard';
import { ApiBearerAuth } from '@nestjs/swagger';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@Controller('listingProduct')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)

export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}
    @Roles(1)
    @Post("/create")
    async createListing(@Body() dto: CreateListingDto, @Req() req: any) {
        /**
         * Giả sử đã có Auth Guard
         * req.user = { user_id: 'uuid' }
         */
        const sellerId = req.user.user_id;

        return this.productsService.createListing(dto, sellerId);
    }
}
