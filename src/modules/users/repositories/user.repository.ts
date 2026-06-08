import { InjectModel } from '@nestjs/sequelize';
import Users from '../entities/user.entity';
import { calculate_pagination_data } from 'src/shared/utils/pagination';
import { Transaction } from 'sequelize';
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

  find_by_email(email: string, transaction?: Transaction): Promise<Users> {
    return this.find_one(
      {
        where: { email },
        attributes: ['id', 'email', 'role', 'tenant_id'],
      },
      transaction,
    );
  }

  async find_all_records(find_opts): Promise<any> {
    const take = Number(find_opts.take || '10');
    const skip = Number(find_opts.skip || '0');

    const users = await this.user.findAndCountAll({
      ...find_opts,
      attributes: {
        exclude: ['password'],
      },
      take,
      skip,
    });
    return calculate_pagination_data(users, skip, take);
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

  async destroy_by_id(id: string): Promise<number> {
    const [affected] = await this.user.update(
      { deleted_at: new Date() } as Partial<Users>,
      { where: { id } },
    );
    return affected;
  }

  async save(user: Partial<Users>, transaction?: Transaction): Promise<any> {
    const created_user = await this.user.create(user as Users, { transaction });
    const plain = created_user.get({ plain: true }) as unknown as Record<
      string,
      unknown
    >;
    delete plain.password;
    return plain;
  }
}
