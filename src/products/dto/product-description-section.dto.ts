import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { trimString } from './transformers/product-dto.transformers';

export class ProductDescriptionSectionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Transform(trimString)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  @Transform(trimString)
  body: string;
}
