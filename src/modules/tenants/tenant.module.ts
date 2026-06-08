import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Tenant } from './entities/tenant.entity';
import { TenantRepository } from './repositories/tenant.repository';
import { TenantService } from './services/tenant.service';
import { TenantController } from './controllers/tenant.controller';

@Module({
  imports: [SequelizeModule.forFeature([Tenant])],
  controllers: [TenantController],
  providers: [TenantRepository, TenantService],
  exports: [TenantService, TenantRepository],
})
export class TenantModule {}
