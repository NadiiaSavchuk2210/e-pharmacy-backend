import { Controller, Get, Param, Query } from '@nestjs/common';
import { QueryNearestStoresDto } from './dto/query-nearest-stores.dto';
import { QueryStoresDto } from './dto/query-stores.dto';
import { StoresService } from './stores.service';
import { type StoreResponse } from './types/store-response.type';

@Controller('stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Get()
  findAll(@Query() query: QueryStoresDto): Promise<StoreResponse[]> {
    return this.storesService.findAll(query);
  }

  @Get('nearest')
  findNearest(@Query() query: QueryNearestStoresDto): Promise<StoreResponse[]> {
    return this.storesService.findNearest(query);
  }

  @Get('random-nearest')
  findRandomNearest(
    @Query() query: QueryNearestStoresDto,
  ): Promise<StoreResponse[]> {
    return this.storesService.findRandomNearest(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<StoreResponse> {
    return this.storesService.findOne(id);
  }
}
