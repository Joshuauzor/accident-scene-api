import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { TenantRepository } from '../repositories/tenant.repository';
import { CreateTenantDto } from '../dtos/tenant.dto';
import { Tenant } from '../entities/tenant.entity';

@Injectable()
export class TenantService {
  constructor(private readonly tenant_repo: TenantRepository) {}

  async create_tenant(dto: CreateTenantDto): Promise<Tenant> {
    const existing = await this.tenant_repo.find_by_slug(dto.slug);
    if (existing) {
      throw new HttpException('Slug already exists.', HttpStatus.CONFLICT);
    }

    return this.tenant_repo.create({
      name: dto.name,
      slug: dto.slug,
    });
  }

  async find_by_slug(slug: string): Promise<Tenant> {
    const tenant = await this.tenant_repo.find_by_slug(slug);
    if (!tenant) {
      throw new HttpException('Tenant not found.', HttpStatus.NOT_FOUND);
    }
    return tenant;
  }

  async find_by_id(id: string): Promise<Tenant> {
    const tenant = await this.tenant_repo.find_by_id(id);
    if (!tenant) {
      throw new HttpException('Tenant not found.', HttpStatus.NOT_FOUND);
    }
    return tenant;
  }

  async list_tenants(): Promise<Tenant[]> {
    return this.tenant_repo.find_all();
  }
}
