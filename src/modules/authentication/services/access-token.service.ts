import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { configs } from '../../../../config/config.env';
import { AesEncryption } from 'src/shared/utils/encryption';
import { JwtPayload } from '../jwt/jwt-payload.model';

@Injectable()
export class AccessTokenService {
  private readonly aes_encrypt = new AesEncryption(
    configs.ENCRYPTION_PRIVATE_KEY,
  );

  encrypt(payload: JwtPayload): string {
    return this.aes_encrypt.encrypt(JSON.stringify(payload));
  }

  decrypt(token: string): string {
    return this.aes_encrypt.decrypt(token);
  }

  parse_email_from_authorization(authorization: string): string {
    return this.parse_email_from_access_token(
      this.extract_bearer_token(authorization),
    );
  }

  parse_email_from_access_token(token: string): string {
    const decrypted = this.decrypt(token?.trim());
    if (!decrypted) {
      throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
    }

    const payload = this.parse_payload(decrypted);
    const email = payload.user?.email?.trim();
    if (!email) {
      throw new HttpException(
        'Invalid token. Missing user',
        HttpStatus.UNAUTHORIZED,
      );
    }

    return email;
  }

  private extract_bearer_token(authorization: string): string {
    if (!authorization?.trim() || !authorization.includes('Bearer')) {
      throw new HttpException('Please provide token', HttpStatus.UNAUTHORIZED);
    }

    const token = authorization.split('Bearer')[1]?.trim();
    if (!token) {
      throw new HttpException('Please provide token', HttpStatus.UNAUTHORIZED);
    }

    return token;
  }

  private parse_payload(decrypted: string): JwtPayload {
    try {
      const payload = JSON.parse(decrypted) as JwtPayload;
      if (!payload?.user) {
        throw new HttpException(
          'Invalid token. Missing user',
          HttpStatus.UNAUTHORIZED,
        );
      }
      return payload;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
    }
  }
}
