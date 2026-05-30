import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { OptionalAuthGuard } from '../user/guards/optional-auth.guard';
import type { OptionalAuthenticatedRequest } from '../user/types/authenticated-request.type';
import { CreateProductReviewDto } from './dto/create-product-review.dto';
import { QueryProductReviewsDto } from './dto/query-product-reviews.dto';
import { ProductReviewsService } from './product-reviews.service';

@Controller('products/:productId/reviews')
export class ProductReviewsController {
  constructor(private readonly productReviewsService: ProductReviewsService) {}

  @Get()
  findByProductId(
    @Param('productId') productId: string,
    @Query() query: QueryProductReviewsDto,
  ) {
    return this.productReviewsService.findByProductId(productId, query);
  }

  @Get('summary')
  getSummary(@Param('productId') productId: string) {
    return this.productReviewsService.getSummary(productId);
  }

  @Post()
  @UseGuards(OptionalAuthGuard)
  create(
    @Param('productId') productId: string,
    @Body() createProductReviewDto: CreateProductReviewDto,
    @Req() request: OptionalAuthenticatedRequest,
  ) {
    return this.productReviewsService.create(
      productId,
      createProductReviewDto,
      request.user,
    );
  }
}
