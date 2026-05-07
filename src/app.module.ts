import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validateEnv } from './config/env.validation';
import { ProductsModule } from './products/products.module';
import { UserModule } from './user/user.module';
import { TokenBlacklistService } from './token-blacklist/token-blacklist.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.getOrThrow<string>('MONGODB_URI'),
        dbName: configService.get<string>('MONGODB_DB_NAME') || undefined,
      }),
    }),
    ProductsModule,
    UserModule,
  ],
  controllers: [AppController],
  providers: [AppService, TokenBlacklistService],
})
export class AppModule {}
