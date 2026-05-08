import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CustomerReview,
  type CustomerReviewDocument,
} from './schemas/customer-review.schema';

@Injectable()
export class CustomerReviewsService {
  constructor(
    @InjectModel(CustomerReview.name)
    private readonly customerReviewModel: Model<CustomerReviewDocument>,
  ) {}

  async findAll() {
    return this.customerReviewModel.find().sort({ createdAt: -1 }).lean();
  }
}
