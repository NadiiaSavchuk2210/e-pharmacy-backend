import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { NearestStore, Store } from './schemas/store.schema';
import { StoresService } from './stores.service';

describe('StoresService', () => {
  let service: StoresService;
  let findMock: jest.Mock;
  let findOneMock: jest.Mock;
  let findNearestMock: jest.Mock;
  let aggregateMock: jest.Mock;
  let sortMock: jest.Mock;
  let sortNearestMock: jest.Mock;
  let limitMock: jest.Mock;
  let limitNearestMock: jest.Mock;

  beforeEach(async () => {
    findMock = jest.fn();
    findOneMock = jest.fn();
    findNearestMock = jest.fn();
    aggregateMock = jest.fn();
    sortMock = jest.fn();
    sortNearestMock = jest.fn();
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
            aggregate: aggregateMock,
          },
        },
        {
          provide: getModelToken(NearestStore.name),
          useValue: {
            find: findNearestMock,
          },
        },
      ],
    }).compile();

    service = module.get<StoresService>(StoresService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns stores sorted by name with a bounded limit', async () => {
    const leanMock = jest.fn().mockResolvedValue([{ id: 'store-1' }]);

    limitMock.mockReturnValue({ lean: leanMock });
    sortMock.mockReturnValue({ limit: limitMock });
    findMock.mockReturnValue({ sort: sortMock });

    await service.findAll({ limit: 25 });

    expect(findMock).toHaveBeenCalledWith();
    expect(sortMock).toHaveBeenCalledWith({ name: 1 });
    expect(limitMock).toHaveBeenCalledWith(25);
  });

  it('returns a random sample of stores when requested', async () => {
    aggregateMock.mockResolvedValue([{ id: 'store-1' }, { id: 'store-2' }]);

    await expect(service.findAll({ limit: 6, random: true })).resolves.toEqual([
      { id: 'store-1', status: 'OPEN' },
      { id: 'store-2', status: 'OPEN' },
    ]);

    expect(aggregateMock).toHaveBeenCalledWith([{ $sample: { size: 6 } }]);
    expect(findMock).not.toHaveBeenCalled();
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
