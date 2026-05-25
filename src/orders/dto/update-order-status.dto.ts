import { IsIn } from 'class-validator';
import type { OrderStatus } from '../../cart/schemas/order.schema';

export class UpdateOrderStatusDto {
  @IsIn(['pending', 'paid', 'completed', 'cancelled'])
  status: OrderStatus;
}
