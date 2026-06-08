import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { TenantService } from '../services/tenant.service';
import { CreateTenantDto } from '../dtos/tenant.dto';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { UserRole } from 'src/shared/enums/roles';
import { RolesGuard } from 'src/shared/guards/roles.guard';
import { PUBLIC } from 'src/shared/decorators/get_current_user';

@Controller('tenants')
export class TenantController {
  constructor(private readonly tenant_service: TenantService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  create_tenant(@Body() dto: CreateTenantDto) {
    return this.tenant_service.create_tenant(dto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  list_tenants() {
    return this.tenant_service.list_tenants();
  }

  @Get(':slug')
  @PUBLIC()
  get_tenant_by_slug(@Param('slug') slug: string) {
    return this.tenant_service.find_by_slug(slug);
  }
}
