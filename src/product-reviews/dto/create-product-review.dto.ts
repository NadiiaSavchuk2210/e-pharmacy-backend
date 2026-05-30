import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { trimString } from '../../products/dto/transformers/product-dto.transformers';

export class CreateProductReviewDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Transform(trimString)
  authorName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Transform(trimString)
  authorAvatar?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  @Transform(trimString)
  comment: string;
}
