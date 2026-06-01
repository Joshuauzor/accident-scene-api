import {
  Table,
  Column,
  PrimaryKey,
  Model,
  DataType,
  Scopes,
  ForeignKey,
  BelongsTo,
  HasMany,
} from 'sequelize-typescript';
import moment from 'moment';
import { UserRole } from 'src/shared/enums/roles';
import { Tenant } from 'src/modules/tenants/entities/tenant.entity';
import { IncidentReport } from 'src/modules/reports/entities/report.entity';

@Table({
  timestamps: true,
  underscored: true,
  paranoid: true,
  tableName: 'gle_users',
})
@Scopes(() => ({
  safe_user: {
    attributes: {
      exclude: ['password', 'createdAt', 'updatedAt', 'deleted_at'],
    },
  },
  with_sensitive_data: {
    attributes: { include: ['password'] },
    exclude: ['createdAt', 'updatedAt', 'deleted_at'],
  },
}))
export default class User extends Model<User> {
  @PrimaryKey
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
    allowNull: false,
  })
  declare id: string;

  @ForeignKey(() => Tenant)
  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  tenant_id: string;

  @BelongsTo(() => Tenant)
  tenant: Tenant;

  @Column({
    type: DataType.STRING,
    unique: true,
  })
  email: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  password?: string;

  @Column({
    type: DataType.ENUM,
    values: [UserRole.ADMIN, UserRole.AGENT],
    defaultValue: UserRole.AGENT,
    allowNull: false,
  })
  role?: UserRole;

  @HasMany(() => IncidentReport)
  reports: IncidentReport[];

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: () => moment().add(1, 'hours').toDate(),
  })
  created_at: Date;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: () => moment().add(1, 'hours').toDate(),
  })
  updated_at: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  deleted_at: Date;
}
