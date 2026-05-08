import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  CustomerReview,
  CustomerReviewSchema,
} from './schemas/customer-review.schema';
import { CustomerReviewsController } from './customer-reviews.controller';
import { CustomerReviewsService } from './customer-reviews.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CustomerReview.name, schema: CustomerReviewSchema },
    ]),
  ],
  controllers: [CustomerReviewsController],
  providers: [CustomerReviewsService],
})
export class CustomerReviewsModule {}
