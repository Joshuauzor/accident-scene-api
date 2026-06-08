import {
  Table,
  Column,
  Model,
  DataType,
  BelongsTo,
  ForeignKey,
  PrimaryKey,
  Default,
} from 'sequelize-typescript';
import { Tenant } from 'src/modules/tenants/entities/tenant.entity';
import User from 'src/modules/users/entities/user.entity';
import { InterventionType, ReportStatus } from 'src/shared/enums/roles';

@Table({ tableName: 'gle_incident_reports', underscored: true })
export class IncidentReport extends Model<IncidentReport> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Tenant)
  @Column({ type: DataType.UUID, allowNull: false })
  tenant_id: string;

  @BelongsTo(() => Tenant)
  tenant: Tenant;

  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false })
  user_id: string;

  @BelongsTo(() => User)
  user: User;

  @Column({ type: DataType.STRING, allowNull: false })
  first_name: string;

  @Column({ type: DataType.STRING, allowNull: false })
  last_name: string;

  @Column({ type: DataType.STRING, allowNull: false })
  location: string;

  @Column({
    type: DataType.ENUM,
    values: [
      InterventionType.MEDICAL,
      InterventionType.FIRE,
      InterventionType.TRAFFIC,
      InterventionType.STRUCTURAL,
      InterventionType.OTHER,
    ],
    allowNull: true,
  })
  intervention_type: InterventionType | null;

  @Column({
    type: DataType.ENUM,
    values: [ReportStatus.STEP_1, ReportStatus.COMPLETED],
    allowNull: false,
    defaultValue: ReportStatus.STEP_1,
  })
  status: ReportStatus;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
  })
  created_at: Date;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
  })
  updated_at: Date;
}
