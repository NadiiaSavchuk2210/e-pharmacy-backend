import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  NearestStore,
  NearestStoreSchema,
  Store,
  StoreSchema,
} from './schemas/store.schema';
import { StoresController } from './stores.controller';
import { StoresService } from './stores.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Store.name, schema: StoreSchema },
      { name: NearestStore.name, schema: NearestStoreSchema },
    ]),
  ],
  controllers: [StoresController],
  providers: [StoresService],
})
export class StoresModule {}
