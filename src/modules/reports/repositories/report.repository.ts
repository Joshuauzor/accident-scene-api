import { InjectModel } from '@nestjs/sequelize';
import { IncidentReport } from '../entities/report.entity';
import { Transaction } from 'sequelize';

export class ReportRepository {
  constructor(
    @InjectModel(IncidentReport)
    private readonly report_model: typeof IncidentReport,
  ) {}

  find_by_id_and_tenant(
    id: string,
    tenant_id: string,
    tx?: Transaction,
  ): Promise<IncidentReport | null> {
    return this.report_model.findOne({
      where: { id, tenant_id },
      transaction: tx,
    });
  }

  find_all_by_tenant(
    tenant_id: string,
    user_id?: string,
  ): Promise<IncidentReport[]> {
    const where: Record<string, string> = { tenant_id };
    if (user_id) {
      where.user_id = user_id;
    }

    return this.report_model.findAll({
      where,
      order: [['created_at', 'DESC']],
    });
  }

  create(
    data: Partial<IncidentReport>,
    tx?: Transaction,
  ): Promise<IncidentReport> {
    return this.report_model.create(data as IncidentReport, {
      transaction: tx,
    });
  }
}
