import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { IncidentReport } from './entities/report.entity';
import { ReportRepository } from './repositories/report.repository';
import { ReportService } from './services/report.service';
import { ReportController } from './controllers/report.controller';

@Module({
  imports: [SequelizeModule.forFeature([IncidentReport])],
  controllers: [ReportController],
  providers: [ReportRepository, ReportService],
  exports: [ReportService, ReportRepository],
})
export class ReportsModule {}
