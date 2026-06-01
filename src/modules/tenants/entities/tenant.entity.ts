import {
  Table,
  Column,
  Model,
  DataType,
  HasMany,
  CreatedAt,
  UpdatedAt,
  PrimaryKey,
  Default,
  Unique,
} from 'sequelize-typescript';
import User from 'src/modules/users/entities/user.entity';
import { IncidentReport } from 'src/modules/reports/entities/report.entity';

@Table({ tableName: 'gle_tenants', underscored: true })
export class Tenant extends Model<Tenant> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declareid: string;

  @Column({ type: DataType.STRING, allowNull: false })
  name: string;

  @Unique
  @Column({ type: DataType.STRING, allowNull: false })
  slug: string;

  @HasMany(() => User)
  users: User[];

  @HasMany(() => IncidentReport)
  reports: IncidentReport[];

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
