import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SkipResponseWrapper } from '../common/decorators/skip-response-wrapper.decorator';
import { AuthGuard } from '../user/guards/auth.guard';
import type { AuthenticatedRequest } from '../user/types/authenticated-request.type';
import { CartService } from './cart.service';
import { CheckoutCartDto } from './dto/checkout-cart.dto';
import { DeliveryQuoteDto } from './dto/delivery-quote.dto';
import { UpdateCartDto } from './dto/update-cart.dto';

@Controller('cart')
@UseGuards(AuthGuard)
@SkipResponseWrapper()
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  getCart(@Req() request: AuthenticatedRequest) {
    return this.cartService.getCart(request.user.sub);
  }

  @Put('update')
  updateCart(
    @Req() request: AuthenticatedRequest,
    @Body() updateCartDto: UpdateCartDto,
  ) {
    return this.cartService.updateCart(request.user.sub, updateCartDto);
  }

  @Post('delivery-quote')
  @HttpCode(200)
  getDeliveryQuote(
    @Req() request: AuthenticatedRequest,
    @Body() deliveryQuoteDto: DeliveryQuoteDto,
  ) {
    return this.cartService.getDeliveryQuote(
      request.user.sub,
      deliveryQuoteDto.address,
    );
  }

  @Post('checkout')
  @HttpCode(201)
  checkout(
    @Req() request: AuthenticatedRequest,
    @Body() checkoutCartDto: CheckoutCartDto,
  ) {
    return this.cartService.checkout(request.user.sub, checkoutCartDto);
  }
}
