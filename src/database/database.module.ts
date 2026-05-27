const dataSource = require('./sequelize/datasource');
import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';

@Module({
  imports: [SequelizeModule.forRoot(dataSource)],
  exports: [SequelizeModule],
})
export class DatabaseModule {}
