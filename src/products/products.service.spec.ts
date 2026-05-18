import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ProductsService } from './products.service';
import { Product } from './schemas/product.schema';

describe('ProductsService', () => {
  let service: ProductsService;
  let findMock: jest.Mock;
  let findOneMock: jest.Mock;
  let countDocumentsMock: jest.Mock;
  let sortMock: jest.Mock;
  let skipMock: jest.Mock;
  let limitMock: jest.Mock;

  beforeEach(async () => {
    findMock = jest.fn();
    findOneMock = jest.fn();
    countDocumentsMock = jest.fn();
    sortMock = jest.fn();
    skipMock = jest.fn();
    limitMock = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: getModelToken(Product.name),
          useValue: {
            find: findMock,
            findOne: findOneMock,
            countDocuments: countDocumentsMock,
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
    skipMock.mockReturnValue({ limit: limitMock });
    sortMock.mockReturnValue({ skip: skipMock });
    findMock.mockReturnValue({ sort: sortMock });
    countDocumentsMock.mockResolvedValue(14);

    const result = await service.findAll({
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
    expect(skipMock).toHaveBeenCalledWith(0);
    expect(limitMock).toHaveBeenCalledWith(9);
    expect(countDocumentsMock).toHaveBeenCalledWith({
      category: {
        $regex: '^Medicine$',
        $options: 'i',
      },
      name: {
        $regex: 'asp',
        $options: 'i',
      },
    });
    expect(result).toEqual({
      items: [{ id: '1', name: 'Aspirin', category: 'Medicine' }],
      meta: {
        totalItems: 14,
        currentPage: 1,
        perPage: 9,
        totalPages: 2,
      },
    });
  });

  it('escapes user-provided search text before building a regex', async () => {
    const leanMock = jest.fn().mockResolvedValue([]);

    limitMock.mockReturnValue({ lean: leanMock });
    skipMock.mockReturnValue({ limit: limitMock });
    sortMock.mockReturnValue({ skip: skipMock });
    findMock.mockReturnValue({ sort: sortMock });
    countDocumentsMock.mockResolvedValue(0);

    await service.findAll({
      name: 'asp.*',
      limit: 10,
      page: 2,
    });

    expect(findMock).toHaveBeenCalledWith({
      name: {
        $regex: 'asp\\.\\*',
        $options: 'i',
      },
    });
    expect(skipMock).toHaveBeenCalledWith(10);
    expect(limitMock).toHaveBeenCalledWith(10);
  });

  it('filters products by discount query values', async () => {
    const leanMock = jest
      .fn()
      .mockResolvedValue([{ id: '1', name: 'Discount Aspirin', discount: 70 }]);

    limitMock.mockReturnValue({ lean: leanMock });
    skipMock.mockReturnValue({ limit: limitMock });
    sortMock.mockReturnValue({ skip: skipMock });
    findMock.mockReturnValue({ sort: sortMock });
    countDocumentsMock.mockResolvedValue(1);

    await service.findAll({
      category: 'Medicine',
      discount: 70,
    });

    expect(findMock).toHaveBeenCalledWith({
      category: {
        $regex: '^Medicine$',
        $options: 'i',
      },
      discount: {
        $in: [70, '70', '70%'],
      },
    });
  });
});
