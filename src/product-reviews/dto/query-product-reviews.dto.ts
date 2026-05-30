import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  parseLimit,
  parsePage,
} from '../../products/dto/transformers/query-products.transformers';

export class QueryProductReviewsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(parseLimit)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(parsePage)
  page?: number;
}
