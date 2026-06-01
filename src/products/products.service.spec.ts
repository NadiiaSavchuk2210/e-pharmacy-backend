import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { FrontendRevalidationService } from '../revalidation/frontend-revalidation.service';
import { ProductsService } from './products.service';
import { Product } from './schemas/product.schema';

describe('ProductsService', () => {
  let service: ProductsService;
  let createMock: jest.Mock;
  let findMock: jest.Mock;
  let findOneMock: jest.Mock;
  let findOneAndUpdateMock: jest.Mock;
  let countDocumentsMock: jest.Mock;
  let revalidationNotifyMock: jest.Mock;
  let sortMock: jest.Mock;
  let skipMock: jest.Mock;
  let limitMock: jest.Mock;

  beforeEach(async () => {
    createMock = jest.fn();
    findMock = jest.fn();
    findOneMock = jest.fn();
    findOneAndUpdateMock = jest.fn();
    countDocumentsMock = jest.fn();
    revalidationNotifyMock = jest.fn().mockResolvedValue(undefined);
    sortMock = jest.fn();
    skipMock = jest.fn();
    limitMock = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: getModelToken(Product.name),
          useValue: {
            create: createMock,
            find: findMock,
            findOne: findOneMock,
            findOneAndUpdate: findOneAndUpdateMock,
            countDocuments: countDocumentsMock,
          },
        },
        {
          provide: FrontendRevalidationService,
          useValue: {
            notify: revalidationNotifyMock,
          },
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates products with reviewed rich description data', async () => {
    const product = {
      id: 'product-001',
      photo: 'photo.png',
      name: 'Aspirin',
      suppliers: 'Acme Pharma',
      stock: '5',
      price: '12.50',
      category: 'Medicine' as const,
      description: 'Reviewed product description.',
      descriptionSections: [
        {
          title: 'Overview',
          body: 'Reviewed overview text.',
        },
      ],
      sourceUrl: 'https://example.com/source',
    };

    createMock.mockResolvedValue({
      toObject: jest.fn().mockReturnValue(product),
    });

    await expect(service.create(product)).resolves.toEqual(product);
    expect(createMock).toHaveBeenCalledWith(product);
    expect(revalidationNotifyMock).toHaveBeenCalledWith({
      type: 'product.created',
    });
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

    const result = await service.findAll({
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
    expect(result.meta).toEqual({
      totalItems: 0,
      currentPage: 2,
      perPage: 10,
      totalPages: 1,
    });
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

  it('uses page 1 and limit 9 to return the first products page', async () => {
    const products = Array.from({ length: 9 }, (_, index) => ({
      id: `product-${index + 1}`,
    }));
    const leanMock = jest.fn().mockResolvedValue(products);

    limitMock.mockReturnValue({ lean: leanMock });
    skipMock.mockReturnValue({ limit: limitMock });
    sortMock.mockReturnValue({ skip: skipMock });
    findMock.mockReturnValue({ sort: sortMock });
    countDocumentsMock.mockResolvedValue(19);

    const result = await service.findAll({ limit: 9, page: 1 });

    expect(findMock).toHaveBeenCalledWith({});
    expect(skipMock).toHaveBeenCalledWith(0);
    expect(limitMock).toHaveBeenCalledWith(9);
    expect(result).toEqual({
      items: products,
      meta: {
        totalItems: 19,
        currentPage: 1,
        perPage: 9,
        totalPages: 3,
      },
    });
  });

  it('uses page 2 and limit 9 to skip the first products page', async () => {
    const products = Array.from({ length: 9 }, (_, index) => ({
      id: `product-${index + 10}`,
    }));
    const leanMock = jest.fn().mockResolvedValue(products);

    limitMock.mockReturnValue({ lean: leanMock });
    skipMock.mockReturnValue({ limit: limitMock });
    sortMock.mockReturnValue({ skip: skipMock });
    findMock.mockReturnValue({ sort: sortMock });
    countDocumentsMock.mockResolvedValue(19);

    const result = await service.findAll({ limit: 9, page: 2 });

    expect(skipMock).toHaveBeenCalledWith(9);
    expect(limitMock).toHaveBeenCalledWith(9);
    expect(result.meta).toEqual({
      totalItems: 19,
      currentPage: 2,
      perPage: 9,
      totalPages: 3,
    });
  });

  it('applies category, name, and discount filters with pagination', async () => {
    const filters = {
      category: {
        $regex: '^Medicine$',
        $options: 'i',
      },
      name: {
        $regex: 'aspirin',
        $options: 'i',
      },
      discount: {
        $in: [70, '70', '70%'],
      },
    };
    const leanMock = jest
      .fn()
      .mockResolvedValue([{ id: 'product-10', name: 'Aspirin Plus' }]);

    limitMock.mockReturnValue({ lean: leanMock });
    skipMock.mockReturnValue({ limit: limitMock });
    sortMock.mockReturnValue({ skip: skipMock });
    findMock.mockReturnValue({ sort: sortMock });
    countDocumentsMock.mockResolvedValue(11);

    const result = await service.findAll({
      category: 'Medicine',
      name: 'aspirin',
      discount: 70,
      limit: 9,
      page: 2,
    });

    expect(findMock).toHaveBeenCalledWith(filters);
    expect(countDocumentsMock).toHaveBeenCalledWith(filters);
    expect(skipMock).toHaveBeenCalledWith(9);
    expect(limitMock).toHaveBeenCalledWith(9);
    expect(result.meta.totalItems).toBe(11);
  });

  it('returns DB-backed rich product description fields for one product', async () => {
    const product = {
      id: 'product-001',
      name: 'Aspirin',
      category: 'Medicine',
      description: 'Reviewed product description.',
      descriptionSections: [
        {
          title: 'Overview',
          body: 'Reviewed overview text.',
        },
      ],
      sourceUrl: 'https://example.com/source',
    };
    const leanMock = jest.fn().mockResolvedValue(product);

    findOneMock.mockReturnValue({ lean: leanMock });

    await expect(service.findOne('product-001')).resolves.toEqual(product);
    expect(findOneMock).toHaveBeenCalledWith({ id: 'product-001' });
  });

  it('updates products with runValidators enabled', async () => {
    const updatedProduct = {
      id: 'product-001',
      name: 'Aspirin',
      descriptionSections: [
        {
          title: 'Usage',
          body: 'Reviewed usage text.',
        },
      ],
    };
    const leanMock = jest.fn().mockResolvedValue(updatedProduct);

    findOneAndUpdateMock.mockReturnValue({ lean: leanMock });

    await expect(
      service.update('product-001', {
        descriptionSections: updatedProduct.descriptionSections,
      }),
    ).resolves.toEqual(updatedProduct);

    expect(findOneAndUpdateMock).toHaveBeenCalledWith(
      { id: 'product-001' },
      {
        $set: {
          descriptionSections: updatedProduct.descriptionSections,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );
    expect(revalidationNotifyMock).toHaveBeenCalledWith({
      type: 'product.updated',
      id: 'product-001',
    });
  });
});
