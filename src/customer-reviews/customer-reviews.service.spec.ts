import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { CustomerReviewsService } from './customer-reviews.service';
import { CustomerReview } from './schemas/customer-review.schema';

describe('CustomerReviewsService', () => {
  let service: CustomerReviewsService;
  let findMock: jest.Mock;
  let sortMock: jest.Mock;

  beforeEach(async () => {
    findMock = jest.fn();
    sortMock = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerReviewsService,
        {
          provide: getModelToken(CustomerReview.name),
          useValue: {
            find: findMock,
          },
        },
      ],
    }).compile();

    service = module.get<CustomerReviewsService>(CustomerReviewsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns reviews sorted newest first', async () => {
    const leanMock = jest.fn().mockResolvedValue([{ id: 'review-1' }]);

    sortMock.mockReturnValue({ lean: leanMock });
    findMock.mockReturnValue({ sort: sortMock });

    await service.findAll();

    expect(findMock).toHaveBeenCalledWith();
    expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });
  });
});
