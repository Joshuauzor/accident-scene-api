import {
  ExecutionContext,
  HttpException,
  HttpStatus,
  createParamDecorator,
} from '@nestjs/common';
import { configs } from '../../../../config/config.env';
import { AesEncryption } from 'src/shared/utils/encryption';

const aes_encrypt = new AesEncryption(configs.ENCRYPTION_PRIVATE_KEY);

export const GETSIGNUSER = createParamDecorator(
  async (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();

    if (
      !request.headers['authorization'] ||
      !request.headers['authorization'].includes('Bearer')
    ) {
      throw new HttpException('Missing token', HttpStatus.UNAUTHORIZED);
    }

    const token = request.headers['authorization'].split('Bearer')[1].trim();
    const user = aes_encrypt.decrypt(token);

    // const User = new JwtService({
    //   secret: configs.JWT_SECRET,
    // }).decode(token);

    if (!user) {
      throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
    }

    if (!JSON.parse(user)?.user) {
      throw new HttpException(
        'Invalid token. Missing User',
        HttpStatus.UNAUTHORIZED,
      );
    }
    return JSON.parse(user)?.user;
  },
);
