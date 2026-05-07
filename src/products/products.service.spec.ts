import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ProductsService } from './products.service';
import { Product } from './schemas/product.schema';

describe('ProductsService', () => {
  let service: ProductsService;
  let findMock: jest.Mock;
  let findOneMock: jest.Mock;
  let sortMock: jest.Mock;
  let limitMock: jest.Mock;

  beforeEach(async () => {
    findMock = jest.fn();
    findOneMock = jest.fn();
    sortMock = jest.fn();
    limitMock = jest.fn();

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
    const leanMock = jest
      .fn()
      .mockResolvedValue([{ id: '1', name: 'Aspirin', category: 'Medicine' }]);

    limitMock.mockReturnValue({ lean: leanMock });
    sortMock.mockReturnValue({ limit: limitMock });
    findMock.mockReturnValue({ sort: sortMock });

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
    expect(sortMock).toHaveBeenCalledWith({ name: 1 });
    expect(limitMock).toHaveBeenCalledWith(50);
  });

  it('escapes user-provided search text before building a regex', async () => {
    const leanMock = jest.fn().mockResolvedValue([]);

    limitMock.mockReturnValue({ lean: leanMock });
    sortMock.mockReturnValue({ limit: limitMock });
    findMock.mockReturnValue({ sort: sortMock });

    await service.findAll({
      name: 'asp.*',
      limit: 10,
    });

    expect(findMock).toHaveBeenCalledWith({
      name: {
        $regex: 'asp\\.\\*',
        $options: 'i',
      },
    });
    expect(limitMock).toHaveBeenCalledWith(10);
  });
});
