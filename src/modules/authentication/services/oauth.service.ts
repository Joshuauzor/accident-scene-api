import { Redis } from 'ioredis';
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { sign } from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { configs } from 'config/config.env';
import { AuthService } from './auth.service';
import { AesEncryption } from 'src/shared/utils/encryption';
import { EmailUtils } from 'src/shared/utils/email.utils';

interface AppleIdTokenPayload {
  iss: string;
  aud: string;
  exp?: number;
  sub: string;
  email?: string;
  name?: { firstName?: string; lastName?: string };
}

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);
  private readonly aes_encryption = new AesEncryption(
    configs.ENCRYPTION_PRIVATE_KEY,
  );
  private readonly state_expiry_seconds = 600;
  private readonly apple_jwt_expiry_seconds = 3600;
  private readonly google_oauth_client = new OAuth2Client();

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis_client: Redis,
    private readonly http_service: HttpService,
    private readonly auth_service: AuthService,
  ) {}

  private validate_platform(platform?: string): 'web' | 'mobile' {
    return platform === 'mobile' || platform === 'web' ? platform : 'web';
  }

  private async store_oauth_state(
    state: string,
    platform: 'web' | 'mobile',
    provider: string,
  ): Promise<void> {
    await this.redis_client.set(
      `oauth:state:${state}`,
      JSON.stringify({ platform, provider }),
      'EX',
      this.state_expiry_seconds,
    );
  }

  private async get_oauth_state(state: string): Promise<{
    platform: 'web' | 'mobile';
    provider: string;
  }> {
    const state_data = await this.redis_client.get(`oauth:state:${state}`);
    if (!state_data) {
      throw new HttpException(
        'Invalid or expired state parameter',
        HttpStatus.BAD_REQUEST,
      );
    }
    return JSON.parse(state_data);
  }

  private async clear_oauth_state(state: string): Promise<void> {
    await this.redis_client.del(`oauth:state:${state}`);
  }

  private get_google_redirect_uri(): string {
    return configs.GOOGLE_OAUTH_REDIRECT;
  }

  private get_apple_redirect_uri(): string {
    return configs.APPLE_REDIRECT_URI;
  }

  private build_web_redirect_response(
    result: {
      user: any;
      tokens?: { access_token: string };
      access_token?: string;
    },
    provider: string,
  ): {
    response_type: 'redirect';
    redirect_url: string;
    service_message: string;
  } {
    const frontend_url = configs.FRONTEND_URL || 'http://www.cliqmit.com';
    const token =
      result.tokens?.access_token ?? (result as any).access_token ?? '';
    return {
      response_type: 'redirect',
      redirect_url: `${frontend_url}/?token=${encodeURIComponent(
        token,
      )}&provider=${provider}`,
      service_message: `${provider} authentication successful`,
    };
  }

  private oauth_mobile_success(result: any, service_message: string) {
    return { ...result, platform: 'mobile' as const, service_message };
  }

  get_google_client_id(platform?: string): {
    client_id: string;
    platform: string;
  } {
    const valid_platform = this.validate_platform(platform);
    return {
      client_id:
        valid_platform === 'mobile'
          ? configs.GOOGLE_CLIENT_ID_MOBILE || configs.GOOGLE_CLIENT_ID
          : configs.GOOGLE_CLIENT_ID,
      platform: valid_platform,
    };
  }

  async verify_google_id_token(id_token: string): Promise<any> {
    const token = (id_token ?? '').trim();
    if (!token) {
      throw new HttpException(
        'Google ID token is required',
        HttpStatus.BAD_REQUEST,
      );
    }
    const client_ids = [
      configs.GOOGLE_CLIENT_ID_MOBILE,
      configs.GOOGLE_CLIENT_ID,
    ].filter(Boolean);
    if (client_ids.length === 0) {
      throw new HttpException(
        'Google OAuth client ID not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    let ticket;
    try {
      ticket = await this.google_oauth_client.verifyIdToken({
        idToken: token,
        audience: client_ids,
      });
    } catch {
      throw new HttpException(
        'Invalid or expired Google ID token',
        HttpStatus.UNAUTHORIZED,
      );
    }
    const p = ticket.getPayload();
    if (!p?.sub || !p.email) {
      throw new HttpException(
        'Invalid Google ID token payload',
        HttpStatus.UNAUTHORIZED,
      );
    }
    const result = await this.auth_service.handle_oauth_login({
      email: p.email,
      first_name: p.given_name,
      last_name: p.family_name,
      provider: 'google',
      provider_id: p.sub,
      image: p.picture,
    });
    return this.oauth_mobile_success(
      result,
      'Google authentication successful',
    );
  }

  get_google_auth_url(): {
    service_message: string;
    url: string;
    state: string;
  } {
    const state = this.aes_encryption.generate_state('google', 'gl');
    this.store_oauth_state(state, 'web', 'google');

    const redirect_uri = this.get_google_redirect_uri();
    const { client_id } = this.get_google_client_id('web');

    const params = new URLSearchParams({
      redirect_uri,
      client_id,
      access_type: 'offline',
      response_type: 'code',
      prompt: 'consent',
      state,
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
      ].join(' '),
    });

    return {
      service_message: 'Redirecting to Google for authentication',
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      state,
    };
  }

  async handle_google_callback(
    code: string,
    state: string,
  ): Promise<{
    response_type: 'redirect';
    redirect_url: string;
    service_message: string;
  }> {
    if (!code || !state) {
      throw new HttpException(
        'Missing authorization code or state parameter',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const { provider } = await this.get_oauth_state(state);

      if (provider !== 'google') {
        throw new HttpException(
          'Invalid state provider',
          HttpStatus.BAD_REQUEST,
        );
      }

      const redirect_uri = this.get_google_redirect_uri();
      const { client_id } = this.get_google_client_id('web');

      const { data: token_data } = await lastValueFrom(
        this.http_service.post(
          'https://oauth2.googleapis.com/token',
          {
            code,
            client_id,
            client_secret: configs.GOOGLE_CLIENT_SECRET,
            redirect_uri,
            grant_type: 'authorization_code',
          },
          {
            timeout: 30000,
          },
        ),
      );

      const { data: profile } = await lastValueFrom(
        this.http_service.get('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { authorization: `Bearer ${token_data.access_token}` },
          timeout: 30000,
        }),
      );

      await Promise.race([
        this.clear_oauth_state(state),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]).catch(() => undefined);

      const result = await this.auth_service.handle_oauth_login({
        email: profile.email,
        first_name: profile.given_name,
        last_name: profile.family_name,
        provider: 'google',
        provider_id: profile.id,
        image: profile.picture,
      });

      return this.build_web_redirect_response(result, 'google');
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        (error as Error)?.message || 'Failed to handle Google callback',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async get_apple_auth_url(): Promise<{
    service_message: string;
    url: string;
    state: string;
  }> {
    const state = this.aes_encryption.generate_state('apple', 'ap');
    await this.store_oauth_state(state, 'web', 'apple');

    const redirect_uri = this.get_apple_redirect_uri();

    const params = new URLSearchParams({
      response_type: 'code',
      response_mode: 'form_post',
      client_id: configs.APPLE_CLIENT_ID,
      redirect_uri,
      state,
      scope: 'name email',
    });

    return {
      service_message: 'Redirecting to Apple for authentication',
      url: `https://appleid.apple.com/auth/authorize?${params.toString()}`,
      state,
    };
  }

  async handle_apple_callback(
    code: string,
    state: string,
  ): Promise<{
    response_type: 'redirect';
    redirect_url: string;
    service_message: string;
  }> {
    if (!code || !state) {
      throw new HttpException(
        'Missing authorization code or state parameter',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const { provider } = await this.get_oauth_state(state);

      if (provider !== 'apple') {
        throw new HttpException(
          'Invalid state provider',
          HttpStatus.BAD_REQUEST,
        );
      }

      const redirect_uri = this.get_apple_redirect_uri();

      const { data: token_data } = await lastValueFrom(
        this.http_service.post(
          'https://appleid.apple.com/auth/token',
          new URLSearchParams({
            code,
            client_id: configs.APPLE_CLIENT_ID,
            client_secret: this.generate_apple_client_secret(),
            grant_type: 'authorization_code',
            redirect_uri,
          }),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          },
        ),
      );

      if (!token_data.id_token) {
        throw new HttpException(
          'Missing ID token from Apple',
          HttpStatus.BAD_REQUEST,
        );
      }

      const decoded = this.decode_apple_id_token(token_data.id_token);
      await this.clear_oauth_state(state);

      const result = await this.auth_service.handle_oauth_login({
        email: decoded.email,
        first_name: decoded.name?.firstName,
        last_name: decoded.name?.lastName,
        provider: 'apple',
        provider_id: decoded.sub,
      });

      return this.build_web_redirect_response(result, 'apple');
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        (error as Error)?.message || 'Failed to handle Apple callback',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private generate_apple_client_secret(): string {
    const required_configs = [
      'APPLE_TEAM_ID',
      'APPLE_KEY_ID',
      'APPLE_CLIENT_ID',
      'APPLE_PRIVATE_KEY',
    ];

    const missing = required_configs.filter(
      (key) => !configs[key] || configs[key].trim() === '',
    );

    if (missing.length > 0) {
      throw new HttpException(
        `Apple OAuth configuration incomplete. Missing: ${missing.join(', ')}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    try {
      const private_key = configs.APPLE_PRIVATE_KEY.replace(/\\n/g, '\n');
      const now = Math.floor(Date.now() / 1000);

      return sign(
        {
          iss: configs.APPLE_TEAM_ID,
          iat: now,
          exp: now + this.apple_jwt_expiry_seconds,
          aud: 'https://appleid.apple.com',
          sub: configs.APPLE_CLIENT_ID,
        },
        private_key,
        {
          algorithm: 'ES256',
          keyid: configs.APPLE_KEY_ID,
        },
      );
    } catch (error) {
      throw new HttpException(
        'Failed to generate Apple client secret',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private decode_apple_id_token(id_token: string): AppleIdTokenPayload {
    const parts = id_token.trim().split('.');
    if (parts.length !== 3) {
      throw new HttpException(
        'Invalid Apple ID token format',
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      const raw = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = raw + '=='.slice(0, (4 - (raw.length % 4)) % 4);
      const json = Buffer.from(padded, 'base64').toString('utf-8');
      return JSON.parse(json) as AppleIdTokenPayload;
    } catch {
      throw new HttpException(
        'Invalid Apple ID token format',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  get_apple_client_id(): { client_id: string; platform: string } {
    return {
      client_id: configs.APPLE_CLIENT_ID,
      platform: 'mobile',
    };
  }

  async verify_apple_id_token(
    id_token: string,
    user_identifier?: string,
  ): Promise<any> {
    const decoded = this.decode_apple_id_token(id_token);

    if (decoded.aud !== configs.APPLE_CLIENT_ID) {
      throw new HttpException(
        `Apple ID token was issued for a different app. Set APPLE_CLIENT_ID to: ${decoded.aud}`,
        HttpStatus.UNAUTHORIZED,
      );
    }
    if (
      decoded.iss !== 'https://appleid.apple.com' ||
      (decoded.exp != null && decoded.exp < Math.floor(Date.now() / 1000))
    ) {
      throw new HttpException(
        decoded.iss !== 'https://appleid.apple.com'
          ? 'Invalid token issuer'
          : 'Apple ID token has expired',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const email = EmailUtils.normalize_email(decoded.email ?? user_identifier);
    if (!email) {
      throw new HttpException(
        'Apple ID token must include email or send user_identifier in the request body',
        HttpStatus.BAD_REQUEST,
      );
    }

    const result = await this.auth_service.handle_oauth_login({
      email,
      first_name: decoded.name?.firstName,
      last_name: decoded.name?.lastName,
      provider: 'apple',
      provider_id: decoded.sub,
    });
    return this.oauth_mobile_success(result, 'Apple authentication successful');
  }
}
