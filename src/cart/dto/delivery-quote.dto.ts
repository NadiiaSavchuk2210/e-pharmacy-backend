import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class DeliveryQuoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  @Transform(trimString)
  address: string;
}
