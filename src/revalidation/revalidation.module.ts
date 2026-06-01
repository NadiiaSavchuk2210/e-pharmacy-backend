import { Module } from '@nestjs/common';
import { FrontendRevalidationService } from './frontend-revalidation.service';

@Module({
  providers: [FrontendRevalidationService],
  exports: [FrontendRevalidationService],
})
export class RevalidationModule {}
