import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PRODUCT_CATEGORIES, type ProductCategory } from '../products.types';
import {
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
  @Transform(trimQueryValue)
  name?: string;
}
