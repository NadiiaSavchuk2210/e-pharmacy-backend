import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SkipResponseWrapper } from '../common/decorators/skip-response-wrapper.decorator';
import { AuthGuard } from '../user/guards/auth.guard';
import type { AuthenticatedRequest } from '../user/types/authenticated-request.type';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
@UseGuards(AuthGuard)
@SkipResponseWrapper()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  findAll(@Req() request: AuthenticatedRequest) {
    return this.ordersService.findAllForUser(request.user.sub);
  }

  @Patch(':id/status')
  updateStatus(
    @Req() request: AuthenticatedRequest,
    @Param('id') orderId: string,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(
      request.user.sub,
      orderId,
      updateOrderStatusDto,
    );
  }
}
