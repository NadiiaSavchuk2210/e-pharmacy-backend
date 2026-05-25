import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const parseQuantity = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? Number(value) : value;

export class UpdateCartDto {
  @IsString()
  @IsNotEmpty()
  @Transform(trimString)
  productId: string;

  @IsInt()
  @Min(0)
  @Transform(parseQuantity)
  quantity: number;
}
