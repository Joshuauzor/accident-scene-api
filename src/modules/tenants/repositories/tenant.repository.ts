import { InjectModel } from '@nestjs/sequelize';
import { Tenant } from '../entities/tenant.entity';
import { Transaction } from 'sequelize';

export class TenantRepository {
  constructor(
    @InjectModel(Tenant)
    private readonly tenant_model: typeof Tenant,
  ) {}

  find_by_slug(slug: string, tx?: Transaction): Promise<Tenant | null> {
    return this.tenant_model.findOne({
      where: { slug },
      transaction: tx,
    });
  }

  find_by_id(id: string, tx?: Transaction): Promise<Tenant | null> {
    return this.tenant_model.findOne({
      where: { id },
      transaction: tx,
    });
  }

  find_all(): Promise<Tenant[]> {
    return this.tenant_model.findAll({
      order: [['created_at', 'DESC']],
    });
  }

  async create(
    data: Partial<Tenant>,
    tx?: Transaction,
  ): Promise<Tenant> {
    return this.tenant_model.create(data as Tenant, { transaction: tx });
  }
}
