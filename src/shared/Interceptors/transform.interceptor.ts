/* eslint-disable class-methods-use-this */
import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ResponseWrapper<T> {
  data: T;
  custom_message?: string;
}

enum HttpMethod {
  DELETE = 'DELETE',
  PUT = 'PUT',
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, any> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((controller_return: T | ResponseWrapper<T>) => {
        const ctx = context.switchToHttp();
        const response = ctx.getResponse<any>();
        const request = ctx.getRequest<Request>();

        // Unpack custom_message if provided (and optional top-level pagination for meta)
        let payload_data: any;
        let custom_message: string | undefined;
        let wrapper_pagination: any;
        if (
          controller_return &&
          typeof controller_return === 'object' &&
          'custom_message' in controller_return
        ) {
          payload_data = (controller_return as any).data;
          custom_message = (controller_return as any).custom_message;
          wrapper_pagination = (controller_return as any).pagination;
        } else {
          payload_data = controller_return;
        }

        // Base response structure
        const resp_data: any = {
          status_code: response.statusCode,
          status: 'Success',
          message: '', // filled below
          time: new Date().toISOString(),
          data: payload_data,
        };

        // 1) Controller override wins (wrapper can also provide top-level meta via pagination)
        if (custom_message) {
          resp_data.message = custom_message;
          if (wrapper_pagination != null) {
            resp_data.meta = wrapper_pagination;
          }
        }
        // 2) service_message in payload
        else if (payload_data && payload_data.service_message) {
          resp_data.message = payload_data.service_message;
          // delete payload_data.service_message;
        }
        // 3) Pagination responses
        else if (
          payload_data &&
          typeof payload_data === 'object' &&
          'pagination' in payload_data
        ) {
          const { pagination, records } = payload_data as any;
          resp_data.data = records;
          resp_data.meta = pagination;
          resp_data.message = 'Records fetched successfully';
        }
        // 4) Status-based defaults
        else if (response.status_code === HttpStatus.CREATED) {
          resp_data.message = 'Record(s) created successfully';
        } else if (response.status_code === HttpStatus.OK && !payload_data) {
          resp_data.message = 'Record not found';
        } else if (request.method === HttpMethod.DELETE) {
          resp_data.message = 'Record(s) deleted successfully';
        } else if (request.method === HttpMethod.PUT) {
          resp_data.message = 'Record(s) updated successfully';
        } else {
          resp_data.message = 'Record(s) fetched successfully';
        }

        // 5) String payload override
        if (payload_data && typeof payload_data === 'string') {
          resp_data.message = payload_data;
          resp_data.data = null;
        }

        return {
          ...resp_data,
          request: {
            method: request.method,
            path: request.url,
          },
        };
      }),
    );
  }
}
