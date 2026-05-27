import {
  Table,
  Column,
  Model,
  DataType,
  Scopes,
  ForeignKey,
  HasOne,
  BelongsToMany,
} from 'sequelize-typescript';
import moment from 'moment';
import { AccountType, AccountStatus } from 'src/shared/enums/roles';

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
export default class Users extends Model<Users> {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
    allowNull: false,
  })
  declare id: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  full_name: string;

  @Column({
    type: DataType.STRING,
    unique: true,
  })
  email: string;

  @Column({
    type: DataType.STRING,
  })
  password?: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  username: string;

  @Column({
    type: DataType.STRING,
    defaultValue: 'direct',
    allowNull: true,
  })
  source: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    defaultValue: () =>
      `https://api.dicebear.com/7.x/pixel-art/svg?seed=user-${Math.random()
        .toString(36)
        .substring(7)}`,
  })
  image: string;

  @Column({
    type: DataType.STRING,
  })
  phone_number: string;

  @Column({
    type: DataType.STRING,
  })
  bio: string;

  @Column({
    type: DataType.STRING,
  })
  oauth_provider: string;

  @Column({
    type: DataType.STRING,
  })
  provider_id: string;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  is_active: boolean;

  @Column({
    type: DataType.ENUM,
    values: ['user', 'organizer'],
    defaultValue: 'user',
  })
  role: string;

  @Column({
    type: DataType.ENUM,
    values: [AccountType.REGULAR, AccountType.CREATOR],
    defaultValue: AccountType.REGULAR,
    allowNull: false,
  })
  account_type: AccountType;

  @Column({
    type: DataType.ENUM,
    values: [
      AccountStatus.ACTIVE,
      AccountStatus.PENDING_VERIFICATION,
      AccountStatus.PENDING_PROFILE,
      AccountStatus.SUSPENDED,
      AccountStatus.DEACTIVATED,
    ],
    defaultValue: AccountStatus.ACTIVE,
    allowNull: false,
  })
  account_status?: AccountStatus;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  suspended_at: Date;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  suspension_reason: string;

  @ForeignKey(() => Users)
  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  suspended_by_id: string;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    defaultValue: () => moment().add(1, 'hours').toDate(),
  })
  last_login_at: Date;

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

  @Column({
    type: DataType.FLOAT,
    allowNull: true,
  })
  latitude: number;

  @Column({
    type: DataType.FLOAT,
    allowNull: true,
  })
  longitude: number;
}
