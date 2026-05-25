import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, type OrderDocument } from '../cart/schemas/order.schema';
import { serializeOrder } from '../common/utils/order-response.util';
import type {
  OrderRecord,
  OrderResponse,
  OrdersResponse,
  UpdateOrderStatusInput,
} from './types/order.types';
import { ALLOWED_STATUS_TRANSITIONS } from './types/order.types';

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
  ) {}

  async findAllForUser(userId: string): Promise<OrdersResponse> {
    const orders = await this.orderModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .lean<OrderRecord[]>();

    return {
      orders: orders.map((order) => serializeOrder(order)),
    };
  }

  async updateStatus(
    userId: string,
    orderId: string,
    updateOrderStatusDto: UpdateOrderStatusInput,
  ): Promise<{ order: OrderResponse }> {
    const order = await this.orderModel.findOne({
      userId,
      ...this.buildOrderIdFilter(orderId),
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status === updateOrderStatusDto.status) {
      return {
        order: serializeOrder(order),
      };
    }

    const allowedNextStatuses = ALLOWED_STATUS_TRANSITIONS[order.status];

    if (!allowedNextStatuses.includes(updateOrderStatusDto.status)) {
      throw new BadRequestException('Invalid order status transition');
    }

    order.status = updateOrderStatusDto.status;
    await order.save();

    return {
      order: serializeOrder(order),
    };
  }

  private buildOrderIdFilter(orderId: string): { _id: Types.ObjectId } {
    if (!Types.ObjectId.isValid(orderId)) {
      throw new NotFoundException('Order not found');
    }

    return {
      _id: new Types.ObjectId(orderId),
    };
  }
}
