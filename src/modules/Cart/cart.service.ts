import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  /**
   * Thêm sản phẩm vào giỏ hàng
   */
  async addToCart(buyerId: string, addToCartDto: AddToCartDto) {
    const { listingId, quantity = 1 } = addToCartDto;

    // Kiểm tra listing tồn tại và còn available
    const listing = await this.prisma.listing.findUnique({
      where: { listing_id: listingId },
      include: {
        vehicle: true,
      },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.status !== 'APPROVED' && listing.status !== 'ACTIVE') {
      throw new BadRequestException('This listing is not available');
    }

    // Người bán không thể thêm sản phẩm của chính mình vào giỏ hàng
    if (listing.seller_id === buyerId) {
      throw new BadRequestException('You cannot add your own listing to cart');
    }

    // Tìm hoặc tạo giỏ hàng cho buyer
    let cart = await this.prisma.cart.findUnique({
      where: { buyer_id: buyerId },
      include: {
        items: {
          include: {
            listing: {
              include: {
                vehicle: true,
              },
            },
          },
        },
      },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: {
          buyer_id: buyerId,
        },
        include: {
          items: {
            include: {
              listing: {
                include: {
                  vehicle: true,
                },
              },
            },
          },
        },
      });
    }

    // Kiểm tra xem item đã có trong giỏ hàng chưa
    const existingItem = cart.items.find(
      (item) => item.listing_id === listingId,
    );

    if (existingItem) {
      // Cập nhật số lượng (xe đạp thường quantity = 1, nhưng có thể có nhiều)
      const updatedItem = await this.prisma.cartItem.update({
        where: { cart_item_id: existingItem.cart_item_id },
        data: {
          quantity: existingItem.quantity + quantity,
        },
        include: {
          listing: {
            include: {
              vehicle: true,
            },
          },
        },
      });

      return {
        success: true,
        message: 'Cart item quantity updated',
        data: updatedItem,
      };
    } else {
      // Thêm item mới vào giỏ hàng
      const newItem = await this.prisma.cartItem.create({
        data: {
          cart_id: cart.cart_id,
          listing_id: listingId,
          quantity: quantity,
        },
        include: {
          listing: {
            include: {
              vehicle: true,
            },
          },
        },
      });

      return {
        success: true,
        message: 'Item added to cart successfully',
        data: newItem,
      };
    }
  }

  /**
   * Lấy giỏ hàng của buyer
   */
  async getMyCart(buyerId: string) {
    let cart = await this.prisma.cart.findUnique({
      where: { buyer_id: buyerId },
      include: {
        items: {
          include: {
            listing: {
              include: {
                vehicle: true,
                seller: {
                  select: {
                    user_id: true,
                    full_name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Nếu chưa có giỏ hàng, tạo mới
    if (!cart) {
      cart = await this.prisma.cart.create({
        data: {
          buyer_id: buyerId,
        },
        include: {
          items: {
            include: {
              listing: {
                include: {
                  vehicle: true,
                  seller: {
                    select: {
                      user_id: true,
                      full_name: true,
                      email: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
    }

    // Tính tổng tiền
    const totalAmount = cart.items.reduce((sum, item) => {
      return sum + Number(item.listing.vehicle.price) * item.quantity;
    }, 0);

    return {
      success: true,
      data: {
        cart,
        totalAmount,
        itemCount: cart.items.length,
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
      },
    });

    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }

    if (cartItem.cart.buyer_id !== buyerId) {
      throw new BadRequestException('This cart item does not belong to you');
    }

    // Cập nhật số lượng
    const updatedItem = await this.prisma.cartItem.update({
      where: { cart_item_id: cartItemId },
      data: {
        quantity: updateDto.quantity,
      },
      include: {
        listing: {
          include: {
            vehicle: true,
          },
        },
      },
    });

    return {
      success: true,
      message: 'Cart item updated successfully',
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
      throw new NotFoundException('Cart not found');
    }

    // Xóa tất cả items
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
  async validateCartForCheckout(buyerId: string) {
    const cart = await this.prisma.cart.findUnique({
      where: { buyer_id: buyerId },
      include: {
        items: {
          include: {
            listing: {
              include: {
                vehicle: true,
              },
            },
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Your cart is empty');
    }

    const unavailableItems: string[] = [];
    const validItems: typeof cart.items = [];

    for (const item of cart.items) {
      if (
        item.listing.status !== 'APPROVED' &&
        item.listing.status !== 'ACTIVE'
      ) {
        unavailableItems.push(
          `${item.listing.vehicle.brand} ${item.listing.vehicle.model}`,
        );
      } else {
        validItems.push(item);
      }
    }

    if (unavailableItems.length > 0) {
      throw new BadRequestException(
        `The following items are no longer available: ${unavailableItems.join(', ')}`,
      );
    }

    return {
      cart,
      validItems,
    };
  }

  /**
   * Lấy thông tin giỏ hàng để tạo order (không tạo order thực sự, chỉ trả về data)
   */
  async getCartForOrder(buyerId: string) {
    const { cart, validItems } = await this.validateCartForCheckout(buyerId);

    // Tính tổng tiền
    const totalAmount = validItems.reduce((sum, item) => {
      return sum + Number(item.listing.vehicle.price) * item.quantity;
    }, 0);

    return {
      cartId: cart.cart_id,
      items: validItems.map((item) => ({
        cartItemId: item.cart_item_id,
        listingId: item.listing_id,
        vehicleId: item.listing.vehicle_id,
        quantity: item.quantity,
        unitPrice: item.listing.vehicle.price,
        totalPrice: Number(item.listing.vehicle.price) * item.quantity,
        listing: item.listing,
      })),
      totalAmount,
    };
  }
}
