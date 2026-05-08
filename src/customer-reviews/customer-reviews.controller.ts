import { Controller, Get } from '@nestjs/common';
import { CustomerReviewsService } from './customer-reviews.service';

@Controller('customer-reviews')
export class CustomerReviewsController {
  constructor(
    private readonly customerReviewsService: CustomerReviewsService,
  ) {}

  @Get()
  findAll() {
    return this.customerReviewsService.findAll();
  }
}
