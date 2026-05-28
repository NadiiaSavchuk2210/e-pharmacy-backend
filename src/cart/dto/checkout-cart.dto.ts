import { Transform, Type } from 'class-transformer';
import {
  IsDefined,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

class ShippingInfoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(trimString)
  name: string;

  @IsEmail()
  @MaxLength(120)
  @Transform(trimString)
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @Transform(trimString)
  phone: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  @Transform(trimString)
  address: string;
}

export class CheckoutCartDto {
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => ShippingInfoDto)
  shippingInfo: ShippingInfoDto;

  @IsIn(['cash_on_delivery', 'bank'])
  paymentMethod: 'cash_on_delivery' | 'bank';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(trimString)
  comment?: string;
}
