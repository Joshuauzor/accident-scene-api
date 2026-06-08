import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ReportRepository } from '../repositories/report.repository';
import { ReportStepOneDto, ReportStepTwoDto } from '../dtos/report.dto';
import Users from 'src/modules/users/entities/user.entity';
import { ReportStatus, UserRole } from 'src/shared/enums/roles';
import { IncidentReport } from '../entities/report.entity';

@Injectable()
export class ReportService {
  constructor(private readonly report_repo: ReportRepository) {}

  async create_step_one(
    user: Users,
    dto: ReportStepOneDto,
  ): Promise<IncidentReport> {
    if (!user.tenant_id) {
      throw new HttpException('Missing tenant.', HttpStatus.PRECONDITION_FAILED);
    }

    return this.report_repo.create({
      tenant_id: user.tenant_id,
      user_id: user.id,
      first_name: dto.first_name,
      last_name: dto.last_name,
      location: dto.location,
      status: ReportStatus.STEP_1,
      intervention_type: null,
    });
  }

  async complete_step_two(
    user: Users,
    report_id: string,
    dto: ReportStepTwoDto,
  ): Promise<IncidentReport> {
    if (!user.tenant_id) {
      throw new HttpException('Missing tenant.', HttpStatus.PRECONDITION_FAILED);
    }

    const report = await this.report_repo.find_by_id_and_tenant(
      report_id,
      user.tenant_id,
    );

    if (!report) {
      throw new HttpException('Report not found.', HttpStatus.NOT_FOUND);
    }

    if (user.role !== UserRole.ADMIN && report.user_id !== user.id) {
      throw new HttpException('FORBIDDEN', HttpStatus.FORBIDDEN);
    }

    if (report.status === ReportStatus.COMPLETED) {
      throw new HttpException('Report already completed.', HttpStatus.CONFLICT);
    }

    await report.update({
      intervention_type: dto.intervention_type,
      status: ReportStatus.COMPLETED,
    });

    return report;
  }

  async find_one(user: Users, report_id: string): Promise<IncidentReport> {
    if (!user.tenant_id) {
      throw new HttpException('Missing tenant.', HttpStatus.PRECONDITION_FAILED);
    }

    const report = await this.report_repo.find_by_id_and_tenant(
      report_id,
      user.tenant_id,
    );

    if (!report) {
      throw new HttpException('Report not found.', HttpStatus.NOT_FOUND);
    }

    if (user.role !== UserRole.ADMIN && report.user_id !== user.id) {
      throw new HttpException('FORBIDDEN', HttpStatus.FORBIDDEN);
    }

    return report;
  }

  async find_all(user: Users): Promise<IncidentReport[]> {
    if (!user.tenant_id) {
      throw new HttpException('Missing tenant.', HttpStatus.PRECONDITION_FAILED);
    }

    if (user.role === UserRole.ADMIN) {
      return this.report_repo.find_all_by_tenant(user.tenant_id);
    }

    return this.report_repo.find_all_by_tenant(user.tenant_id, user.id);
  }
}
