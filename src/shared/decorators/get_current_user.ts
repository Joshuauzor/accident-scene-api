import {
  ExecutionContext,
  createParamDecorator,
  SetMetadata,
} from '@nestjs/common';

export const GET_CURRENT_USER = createParamDecorator(
  (prop: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const current_user = request?.current_user;
    if (!current_user) return null;

    return prop && prop === 'id'
      ? current_user.user_id || current_user?.[prop]
      : current_user;
  },
);

export const IS_PUBLIC_KEY = 'isPublic';
export const PUBLIC = () => SetMetadata(IS_PUBLIC_KEY, true);
