import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PRODUCT_CATEGORIES, type ProductCategory } from '../products.types';
import {
  parseLimit,
  normalizeCategory,
  trimQueryValue,
} from './query-products.transformers';

export class QueryProductsDto {
  @IsOptional()
  @IsIn(PRODUCT_CATEGORIES)
  @Transform(normalizeCategory)
  category?: ProductCategory;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(trimQueryValue)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(parseLimit)
  limit?: number;
}
