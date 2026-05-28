import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PRODUCT_CATEGORIES, type ProductCategory } from '../products.types';
import { ProductDescriptionSectionDto } from './product-description-section.dto';
import { trimString } from './transformers/product-dto.transformers';
import { IsProductDiscount } from './validators/product-discount.validator';

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Transform(trimString)
  photo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(trimString)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(trimString)
  suppliers?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(trimString)
  stock?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(trimString)
  price?: string;

  @IsOptional()
  @IsProductDiscount()
  @Transform(trimString)
  discount?: number | string;

  @IsOptional()
  @IsIn(PRODUCT_CATEGORIES)
  category?: ProductCategory;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  @Transform(trimString)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ProductDescriptionSectionDto)
  descriptionSections?: ProductDescriptionSectionDto[];

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Transform(trimString)
  sourceUrl?: string;
}
