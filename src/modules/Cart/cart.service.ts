import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { ListingStatus, OrderStatus, Prisma } from '@prisma/client';

const LISTING_RELATIONS = {
  vehicle: true,
  media: true,
  seller: {
    select: {
      user_id: true,
      full_name: true,
      email: true,
    },
  },
} as const;

const CART_ITEM_INCLUDE = {
  listing: {
    include: LISTING_RELATIONS,
  },
} as const;

const CART_WITH_ITEMS = {
  include: {
    items: {
      include: CART_ITEM_INCLUDE,
    },
  },
} as const;

type CartItemWithRelations = Prisma.CartItemGetPayload<{
  include: typeof CART_ITEM_INCLUDE;
}>;

type CartWithRelations = Prisma.CartGetPayload<typeof CART_WITH_ITEMS>;

export type ListingWithRelations = Prisma.ListingGetPayload<{
  include: typeof LISTING_RELATIONS;
}>;

type CartListing = ListingWithRelations | null;

export interface CartItemView {
  cartItemId: string;
  listingId: string;
  vehicleId: string | null;
  sellerId: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  listing: ListingWithRelations | null;
  seller?: ListingWithRelations['seller'] | null;
  isValid: boolean;
  error?: string;
}

export interface CartSellerGroup {
  sellerId: string | null;
  sellerName: string | null;
  sellerEmail: string | null;
  subtotal: number;
  items: CartItemView[];
}

export interface CartValidationError {
  cartItemId: string;
  listingId: string;
  message: string;
}

interface CartValidationResult {
  cart: CartWithRelations;
  items: CartItemView[];
  errors: CartValidationError[];
}

const AVAILABLE_LISTING_STATUSES = new Set<ListingStatus>([
  ListingStatus.ACTIVE,
  ListingStatus.APPROVED,
]);

const BLOCKING_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.DEPOSITED,
];

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) { }

  /**
   * Thêm sản phẩm vào giỏ hàng
   */
  async addToCart(buyerId: string, addToCartDto: AddToCartDto) {
    const { listingId, quantity = 1 } = addToCartDto;

    if (quantity > 1) {
      throw new BadRequestException('Only one quantity is allowed per listing');
    }

    const listing = await this.prisma.listing.findUnique({
      where: { listing_id: listingId },
      include: CART_ITEM_INCLUDE.listing.include,
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (!this.isListingAvailable(listing)) {
      throw new BadRequestException('This listing is not available');
    }

    if (listing.seller_id === buyerId) {
      throw new BadRequestException('You cannot add your own listing to cart');
    }

    const hasBlockingOrder = await this.prisma.order.findFirst({
      where: {
        listing_id: listingId,
        status: { in: BLOCKING_ORDER_STATUSES },
      },
      select: { order_id: true },
    });

    if (hasBlockingOrder) {
      throw new ConflictException('This listing already has an active order');
    }

    const cart = await this.ensureCartRecord(buyerId);

    const existingItem = await this.prisma.cartItem.findFirst({
      where: {
        cart_id: cart.cart_id,
        listing_id: listingId,
      },
    });

    if (existingItem) {
      throw new ConflictException('This listing is already in your cart');
    }

    const newItem = await this.prisma.cartItem.create({
      data: {
        cart_id: cart.cart_id,
        listing_id: listingId,
        quantity: 1,
      },
      include: CART_ITEM_INCLUDE,
    });

    const payload = this.mapCartItem(newItem);

    return {
      success: true,
      message: 'Item added to cart successfully',
      data: payload,
    };
  }

  /**
   * Lấy giỏ hàng của buyer
   */
  async getMyCart(buyerId: string) {
    const validation = await this.buildValidatedCart(buyerId);
    const validItems = validation.items.filter((item) => item.isValid);
    const totalAmount = validItems.reduce(
      (sum, item) => sum + item.totalPrice,
      0,
    );

    const cartResponse = {
      ...validation.cart,
      items: validation.cart.items.map((cartItem, index) => ({
        ...cartItem,
        validationStatus: validation.items[index]?.isValid ? 'VALID' : 'INVALID',
        validationError: validation.items[index]?.error ?? null,
      })),
    };

    return {
      success: true,
      data: {
        cart: cartResponse,
        totalAmount,
        itemCount: validation.items.length,
        validItemCount: validItems.length,
        invalidItemCount: validation.errors.length,
        hasInvalidItems: validation.errors.length > 0,
        validationErrors: validation.errors,
        groups: this.groupItemsBySeller(validation.items),
        items: validation.items,
      },
    };
  }

  /**
   * Cập nhật số lượng item trong giỏ hàng
   */
  async updateCartItem(
    buyerId: string,
    cartItemId: string,
    updateDto: UpdateCartItemDto,
  ) {
    // Kiểm tra cart item có thuộc về buyer không
    const cartItem = await this.prisma.cartItem.findUnique({
      where: { cart_item_id: cartItemId },
      include: {
        cart: true,
        listing: {
          include: LISTING_RELATIONS,
        },
      },
    });

    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }

    if (cartItem.cart.buyer_id !== buyerId) {
      throw new BadRequestException('This cart item does not belong to you');
    }

    if (cartItem.listing && !this.isListingAvailable(cartItem.listing)) {
      throw new BadRequestException('This listing is no longer available');
    }

    if (updateDto.quantity > 1) {
      throw new BadRequestException('Only one quantity is allowed per listing');
    }

    // Cập nhật số lượng
    const updatedItem = await this.prisma.cartItem.update({
      where: { cart_item_id: cartItemId },
      data: {
        quantity: updateDto.quantity,
      },
      include: {
        listing: {
          include: LISTING_RELATIONS,
        },
      },
    });

    return {
      success: true,
      message: 'Cart item quantity updated successfully',
      data: updatedItem,
    };
  }

  /**
   * Xóa item khỏi giỏ hàng
   */
  async removeFromCart(buyerId: string, cartItemId: string) {
    // Kiểm tra cart item có thuộc về buyer không
    const cartItem = await this.prisma.cartItem.findUnique({
      where: { cart_item_id: cartItemId },
      include: {
        cart: true,
      },
    });

    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }

    if (cartItem.cart.buyer_id !== buyerId) {
      throw new BadRequestException('This cart item does not belong to you');
    }

    // Xóa item
    await this.prisma.cartItem.delete({
      where: { cart_item_id: cartItemId },
    });

    return {
      success: true,
      message: 'Item removed from cart successfully',
    };
  }

  /**
   * Xóa tất cả items trong giỏ hàng
   */
  async clearCart(buyerId: string) {
    const cart = await this.prisma.cart.findUnique({
      where: { buyer_id: buyerId },
    });

    if (!cart) {
      return {
        success: true,
        message: 'Cart cleared successfully',
      };
    }

    await this.prisma.cartItem.deleteMany({
      where: { cart_id: cart.cart_id },
    });

    return {
      success: true,
      message: 'Cart cleared successfully',
    };
  }

  /**
   * Kiểm tra tính khả dụng của các items trong giỏ hàng trước khi checkout
   */
  async getCartForOrder(buyerId: string) {
    const validation = await this.buildValidatedCart(buyerId);

    if (validation.items.length === 0) {
      throw new BadRequestException('Your cart is empty');
    }

    if (validation.errors.length > 0) {
      throw new BadRequestException({
        message: 'Cart contains invalid items',
        errors: validation.errors,
      });
    }

    const totalAmount = validation.items.reduce(
      (sum, item) => sum + item.totalPrice,
      0,
    );

    return {
      cartId: validation.cart.cart_id,
      items: validation.items.map((item) => ({
        cartItemId: item.cartItemId,
        listingId: item.listingId,
        vehicleId: item.vehicleId as string,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        listing: item.listing,
      })),
      totalAmount,
      groupedBySeller: this.groupItemsBySeller(validation.items),
    };
  }

  private async ensureCartRecord(buyerId: string) {
    let cart = await this.prisma.cart.findUnique({
      where: { buyer_id: buyerId },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { buyer_id: buyerId },
      });
    }

    return cart;
  }

  private async ensureCartWithItems(buyerId: string): Promise<CartWithRelations> {
    const cart = await this.prisma.cart.findUnique({
      where: { buyer_id: buyerId },
      include: CART_WITH_ITEMS.include,
    });

    if (cart) {
      return cart;
    }

    return this.prisma.cart.create({
      data: { buyer_id: buyerId },
      include: CART_WITH_ITEMS.include,
    });
  }

  private async buildValidatedCart(
    buyerId: string,
  ): Promise<CartValidationResult> {
    const cart = await this.ensureCartWithItems(buyerId);

    if (cart.items.length === 0) {
      return { cart, items: [], errors: [] };
    }

    const listingIds = cart.items.map((item) => item.listing_id);
    const blockingOrders = await this.prisma.order.findMany({
      where: {
        listing_id: { in: listingIds },
        status: { in: BLOCKING_ORDER_STATUSES },
      },
      select: { listing_id: true },
    });
    const busyListings = new Set(blockingOrders.map((order) => order.listing_id));

    const items = cart.items.map((item) => {
      let error: string | undefined;

      if (!item.listing) {
        error = 'Listing not found';
      } else if (!this.isListingAvailable(item.listing)) {
        error = 'Listing is not available for purchase';
      } else if (item.listing.seller_id === buyerId) {
        error = 'You cannot buy your own listing';
      } else if (busyListings.has(item.listing.listing_id)) {
        error = 'Listing already has an active order';
      } else if (item.quantity !== 1) {
        error = 'Only one quantity is allowed for each listing';
      }

      return this.mapCartItem(item, error);
    });

    const errors = items
      .filter((item) => !item.isValid && item.error)
      .map((item) => ({
        cartItemId: item.cartItemId,
        listingId: item.listingId,
        message: item.error!,
      }));

    return { cart, items, errors };
  }

  private mapCartItem(
    cartItem: CartItemWithRelations,
    error?: string,
  ): CartItemView {
    const listing = cartItem.listing;
    const seller = listing?.seller ?? null;
    const unitPrice = listing?.vehicle
      ? Number(listing.vehicle.price)
      : 0;

    return {
      cartItemId: cartItem.cart_item_id,
      listingId: cartItem.listing_id,
      vehicleId: listing?.vehicle_id ?? null,
      sellerId: listing?.seller_id ?? null,
      quantity: cartItem.quantity,
      unitPrice,
      totalPrice: unitPrice * cartItem.quantity,
      listing,
      seller,
      isValid: !error,
      error,
    };
  }

  private groupItemsBySeller(items: CartItemView[]): CartSellerGroup[] {
    const groups = new Map<string | null, CartSellerGroup>();

    for (const item of items) {
      const key = item.sellerId ?? null;
      if (!groups.has(key)) {
        groups.set(key, {
          sellerId: key,
          sellerName: item.seller?.full_name ?? null,
          sellerEmail: item.seller?.email ?? null,
          subtotal: 0,
          items: [],
        });
      }

      const group = groups.get(key)!;
      group.items.push(item);
      if (item.isValid) {
        group.subtotal += item.totalPrice;
      }
    }

    return Array.from(groups.values());
  }

  private isListingAvailable(listing?: CartListing | null) {
    if (!listing) {
      return false;
    }
    return AVAILABLE_LISTING_STATUSES.has(listing.status);
  }
}
