import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { NearestStore, Store } from './schemas/store.schema';
import { StoresService } from './stores.service';

describe('StoresService', () => {
  let service: StoresService;
  let findMock: jest.Mock;
  let findOneMock: jest.Mock;
  let findNearestMock: jest.Mock;
  let countDocumentsMock: jest.Mock;
  let aggregateMock: jest.Mock;
  let aggregateNearestMock: jest.Mock;
  let sortMock: jest.Mock;
  let sortNearestMock: jest.Mock;
  let skipMock: jest.Mock;
  let limitMock: jest.Mock;
  let limitNearestMock: jest.Mock;

  beforeEach(async () => {
    findMock = jest.fn();
    findOneMock = jest.fn();
    findNearestMock = jest.fn();
    countDocumentsMock = jest.fn();
    aggregateMock = jest.fn();
    aggregateNearestMock = jest.fn();
    sortMock = jest.fn();
    sortNearestMock = jest.fn();
    skipMock = jest.fn();
    limitMock = jest.fn();
    limitNearestMock = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoresService,
        {
          provide: getModelToken(Store.name),
          useValue: {
            find: findMock,
            findOne: findOneMock,
            countDocuments: countDocumentsMock,
            aggregate: aggregateMock,
          },
        },
        {
          provide: getModelToken(NearestStore.name),
          useValue: {
            find: findNearestMock,
            aggregate: aggregateNearestMock,
          },
        },
      ],
    }).compile();

    service = module.get<StoresService>(StoresService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns a paginated stores page sorted by name', async () => {
    const leanMock = jest.fn().mockResolvedValue([{ id: 'store-1' }]);

    limitMock.mockReturnValue({ lean: leanMock });
    skipMock.mockReturnValue({ limit: limitMock });
    sortMock.mockReturnValue({ skip: skipMock });
    findMock.mockReturnValue({ sort: sortMock });
    countDocumentsMock.mockResolvedValue(23);

    await expect(service.findAll({ limit: 9, page: 2 })).resolves.toEqual({
      items: [{ id: 'store-1', status: 'OPEN' }],
      meta: {
        totalItems: 23,
        currentPage: 2,
        perPage: 9,
        totalPages: 3,
      },
    });

    expect(findMock).toHaveBeenCalledWith();
    expect(sortMock).toHaveBeenCalledWith({ name: 1 });
    expect(skipMock).toHaveBeenCalledWith(9);
    expect(limitMock).toHaveBeenCalledWith(9);
    expect(countDocumentsMock).toHaveBeenCalledWith();
  });

  it('returns at least one stores page when there are no stores', async () => {
    const leanMock = jest.fn().mockResolvedValue([]);

    limitMock.mockReturnValue({ lean: leanMock });
    skipMock.mockReturnValue({ limit: limitMock });
    sortMock.mockReturnValue({ skip: skipMock });
    findMock.mockReturnValue({ sort: sortMock });
    countDocumentsMock.mockResolvedValue(0);

    await expect(service.findAll({ limit: 9, page: 1 })).resolves.toEqual({
      items: [],
      meta: {
        totalItems: 0,
        currentPage: 1,
        perPage: 9,
        totalPages: 1,
      },
    });
  });

  it('returns a random sample of stores when requested', async () => {
    aggregateMock.mockResolvedValue([{ id: 'store-1' }, { id: 'store-2' }]);

    await expect(service.findAll({ limit: 6, random: true })).resolves.toEqual([
      { id: 'store-1', status: 'OPEN' },
      { id: 'store-2', status: 'OPEN' },
    ]);

    expect(aggregateMock).toHaveBeenCalledWith([{ $sample: { size: 6 } }]);
    expect(findMock).not.toHaveBeenCalled();
    expect(countDocumentsMock).not.toHaveBeenCalled();
  });

  it('returns nearest pharmacies from the nearest_pharmacies model', async () => {
    const leanMock = jest.fn().mockResolvedValue([
      {
        name: 'Wellness Pharma',
        address: 'Reitarska St, 17',
        city: 'Kyiv',
        phone: '045-256-9564',
        rating: 2,
      },
    ]);

    limitNearestMock.mockReturnValue({ lean: leanMock });
    sortNearestMock.mockReturnValue({ limit: limitNearestMock });
    findNearestMock.mockReturnValue({ sort: sortNearestMock });

    await service.findNearest({ limit: 5 });

    expect(findNearestMock).toHaveBeenCalledWith();
    expect(sortNearestMock).toHaveBeenCalledWith({ rating: -1, name: 1 });
    expect(limitNearestMock).toHaveBeenCalledWith(5);
  });

  it('returns a random nearest store sample with a default limit', async () => {
    aggregateNearestMock.mockResolvedValue([
      { id: 'nearest-1' },
      { id: 'nearest-2', status: 'CLOSE' },
    ]);

    await expect(service.findRandomNearest()).resolves.toEqual([
      { id: 'nearest-1', status: 'OPEN' },
      { id: 'nearest-2', status: 'CLOSE' },
    ]);

    expect(aggregateNearestMock).toHaveBeenCalledWith([
      { $sample: { size: 6 } },
    ]);
    expect(findNearestMock).not.toHaveBeenCalled();
  });

  it('returns a random nearest store sample with a custom limit', async () => {
    aggregateNearestMock.mockResolvedValue([]);

    await service.findRandomNearest({ limit: 4 });

    expect(aggregateNearestMock).toHaveBeenCalledWith([
      { $sample: { size: 4 } },
    ]);
  });

  it('finds a store by public id', async () => {
    const leanMock = jest.fn().mockResolvedValue({ id: 'store-1' });
    findOneMock.mockReturnValue({ lean: leanMock });

    await expect(service.findOne('store-1')).resolves.toEqual({
      id: 'store-1',
      status: 'OPEN',
    });

    expect(findOneMock).toHaveBeenCalledWith({ $or: [{ id: 'store-1' }] });
  });
});
