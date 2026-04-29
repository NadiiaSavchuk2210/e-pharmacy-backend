import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ProductsService } from './products.service';
import { Product } from './schemas/product.schema';

describe('ProductsService', () => {
  let service: ProductsService;
  let findMock: jest.Mock;
  let findOneMock: jest.Mock;

  beforeEach(async () => {
    findMock = jest.fn();
    findOneMock = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: getModelToken(Product.name),
          useValue: {
            find: findMock,
            findOne: findOneMock,
          },
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('builds case-insensitive independent filters for category and name', async () => {
    const leanMock = jest.fn().mockResolvedValue([
      { id: '1', name: 'Aspirin', category: 'Medicine' },
    ]);

    findMock.mockReturnValue({ lean: leanMock });

    await service.findAll({
      category: 'Medicine',
      name: 'asp',
    });

    expect(findMock).toHaveBeenCalledWith({
      category: {
        $regex: '^Medicine$',
        $options: 'i',
      },
      name: {
        $regex: 'asp',
        $options: 'i',
      },
    });
  });
});
