import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const { method } = req;
    const { url } = req;
    const now = new Date().toISOString();
    const start = Date.now();
    const req_log_data = {
      method,
      url,
      time: now,
      body: JSON.stringify(req.body),
      query: JSON.stringify(req.query),
      ip: req.ip,
    };
    Logger.verbose(JSON.stringify(req_log_data), LoggingInterceptor.name);
    return next.handle().pipe(
      tap((res) => {
        const res_log_data = {
          method,
          url,
          time: now,
          body: JSON.stringify(res),
        };
        Logger.verbose(JSON.stringify(res_log_data), LoggingInterceptor.name);
        Logger.log(
          `${method} ${url} ${Date.now() - start}ms`,
          context.getClass().name,
        );
      }),
    );
  }
}
