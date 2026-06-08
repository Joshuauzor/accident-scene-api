import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ReportService } from '../services/report.service';
import { ReportStepOneDto, ReportStepTwoDto } from '../dtos/report.dto';
import { GET_CURRENT_USER } from 'src/shared/decorators/get_current_user';
import Users from 'src/modules/users/entities/user.entity';

@Controller('reports')
export class ReportController {
  constructor(private readonly report_service: ReportService) {}

  @Post()
  create_step_one(
    @GET_CURRENT_USER() user: Users,
    @Body() dto: ReportStepOneDto,
  ) {
    return this.report_service.create_step_one(user, dto);
  }

  @Patch(':id/step-2')
  complete_step_two(
    @GET_CURRENT_USER() user: Users,
    @Param('id') report_id: string,
    @Body() dto: ReportStepTwoDto,
  ) {
    return this.report_service.complete_step_two(user, report_id, dto);
  }

  @Get()
  list_reports(@GET_CURRENT_USER() user: Users) {
    return this.report_service.find_all(user);
  }

  @Get(':id')
  get_report(
    @GET_CURRENT_USER() user: Users,
    @Param('id') report_id: string,
  ) {
    return this.report_service.find_one(user, report_id);
  }
}
