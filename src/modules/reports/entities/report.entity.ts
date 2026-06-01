import {
  Table,
  Column,
  Model,
  DataType,
  BelongsTo,
  ForeignKey,
  CreatedAt,
  UpdatedAt,
  PrimaryKey,
  Default,
} from 'sequelize-typescript';
import { Tenant } from 'src/modules/tenants/entities/tenant.entity';
import User from 'src/modules/users/entities/user.entity';
import { InterventionType } from 'src/shared/enums/roles';

@Table({ tableName: 'gle_incident_reports', underscored: true })
export class IncidentReport extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Tenant)
  @Column({ type: DataType.UUID, allowNull: false })
  tenantId: string;

  @BelongsTo(() => Tenant)
  tenant: Tenant;

  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false })
  userId: string;

  @BelongsTo(() => User)
  user: User;

  @Column({ type: DataType.STRING, allowNull: false })
  firstName: string;

  @Column({ type: DataType.STRING, allowNull: false })
  lastName: string;

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
    allowNull: false,
  })
  interventionType: InterventionType;

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
