import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { OptionalAuthGuard } from '../user/guards/optional-auth.guard';
import { UserModule } from '../user/user.module';
import { ProductReviewsController } from './product-reviews.controller';
import { ProductReviewsService } from './product-reviews.service';
import {
  ProductReview,
  ProductReviewSchema,
} from './schemas/product-review.schema';

@Module({
  imports: [
    UserModule,
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: ProductReview.name, schema: ProductReviewSchema },
    ]),
  ],
  controllers: [ProductReviewsController],
  providers: [ProductReviewsService, OptionalAuthGuard],
})
export class ProductReviewsModule {}
