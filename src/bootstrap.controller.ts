import { Controller, Get } from '@nestjs/common';
import { BootService } from './bootstrap.service';

@Controller('bootstrap')
export class BootController {
  constructor(private readonly boot_service: BootService) {}

  @Get('status')
  get_health_talk(): string {
    return this.boot_service.exe_health_talk();
  }
}
