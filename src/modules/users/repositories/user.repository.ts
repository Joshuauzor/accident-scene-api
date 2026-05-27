import { InjectModel } from '@nestjs/sequelize';
import Users from '../entities/user.entity';
import { UserDto } from '../dtos/user.dto';
import { calculate_pagination_data } from 'src/shared/utils/pagination';
import { Op, Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';

export class UserRepository {
  constructor(
    @InjectModel(Users)
    private readonly user: typeof Users,
    private readonly sequelize: Sequelize,
  ) {}

  find_one(find_opts, tx?: Transaction): Promise<Users> {
    return this.user.findOne({ ...find_opts, transaction: tx });
  }

  async find_or_create(user_dto: Partial<UserDto>): Promise<Users> {
    const user: Users | null = await this.find_one_by_email(user_dto.email);
    if (user) return user;
    return this.save(user);
  }

  find_one_by_email(email: string): Promise<Users> {
    return this.find_one({
      where: { email },
    });
  }

  find_one_by_email_including_deleted(
    email: string,
    tx?: Transaction,
  ): Promise<Users | null> {
    return this.user.findOne({
      where: { email },
      transaction: tx,
      paranoid: false,
    });
  }

  find_by_phone(phone_number: string): Promise<Users> {
    return this.find_one({
      where: { phone_number },
    });
  }

  find_by_email_or_username(
    email_or_username: string,
    transaction?: Transaction,
  ): Promise<Users> {
    return this.find_one(
      {
        where: {
          [Op.or]: [
            { email: email_or_username },
            { username: email_or_username },
          ],
        },
        attributes: ['id', 'email', 'username', 'full_name'],
      },
      transaction,
    );
  }

  search_user(
    user_dto: Partial<Pick<Users, 'email' | 'username' | 'phone_number'>>,
    exclude_user_id?: string,
    transaction?: Transaction,
  ): Promise<Users | null> {
    const or_conditions = [
      ...(user_dto?.email ? [{ email: user_dto.email }] : []),
      ...(user_dto?.username ? [{ username: user_dto.username }] : []),
      ...(user_dto?.phone_number
        ? [{ phone_number: user_dto.phone_number }]
        : []),
    ];
    if (or_conditions.length === 0) return Promise.resolve(null);
    const where: any = {
      [Op.and]: [
        ...(exclude_user_id ? [{ id: { [Op.not]: exclude_user_id } }] : []),
        { [Op.or]: or_conditions },
      ],
    };
    return this.find_one(
      {
        where,
        attributes: {
          exclude: ['password', 'createdAt', 'updatedAt', 'deletedAt'],
        },
        raw: true,
      },
      transaction,
    );
  }

  find_x_user(find_opts: Users): Promise<Users> {
    return this.find_one(find_opts);
  }

  async find_all_records(find_opts): Promise<any> {
    const take = Number(find_opts.take || '10');
    const skip = Number(find_opts.skip || '0');

    const users = await this.user.findAndCountAll({
      ...find_opts,
      attributes: {
        exclude: ['password', 'passcode'],
      },
      take,
      skip,
    });
    return calculate_pagination_data(users, skip, take);
  }

  update_one(id: string, updates: Partial<Users>): Promise<any> {
    return this.user.update(updates, { where: { id } });
  }

  async update_one_including_deleted(
    id: string,
    updates: Partial<Users>,
    tx?: Transaction,
  ): Promise<number> {
    const [affected] = await this.user.update(updates, {
      where: { id },
      transaction: tx,
      paranoid: false,
    });
    return affected;
  }

  async destroy_by_id(id: string): Promise<number> {
    const [affected] = await this.user.update(
      { deleted_at: new Date() } as Partial<Users>,
      { where: { id } },
    );
    return affected;
  }

  update_by_email(
    email: string,
    updates: Partial<Users>,
    transaction?: Transaction,
  ): Promise<any> {
    return this.user.update(updates, {
      where: { email },
      ...(transaction && { transaction }),
    });
  }

  async save(user: Partial<Users>, transaction?: Transaction): Promise<any> {
    const created_user = await this.user.create(user, { transaction });
    const plain = created_user.get({ plain: true }) as unknown as Record<
      string,
      unknown
    >;
    delete plain.password;
    return plain;
  }
}
