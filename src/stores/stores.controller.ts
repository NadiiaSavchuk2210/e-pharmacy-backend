import { Controller, Get, Query } from '@nestjs/common';
import { QueryNearestStoresDto } from './dto/query-nearest-stores.dto';
import { QueryStoresDto } from './dto/query-stores.dto';
import { StoresService } from './stores.service';

@Controller('stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Get()
  findAll(@Query() query: QueryStoresDto) {
    return this.storesService.findAll(query);
  }

  @Get('nearest')
  findNearest(@Query() query: QueryNearestStoresDto) {
    return this.storesService.findNearest(query);
  }
}
