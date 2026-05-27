/* eslint-disable @typescript-eslint/naming-convention */
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import * as Axios from 'axios';

import { FindDataRequestDto } from '../utils/dtos/find.data.request.dto';
import { URLHandler } from './url.handler';
import { RequestConfigs, ServiceInstance } from '../interfaces/request-handler';

export class HttpRequestHandler {
  static errors = {
    tryAgain: 'Could not fetch data. Please try again',
    failConn: 'ECONNREFUSED',
    sthWrong: 'Something went wrong. Please contact support',
  };

  private _service: ServiceInstance;
  private _baseURL: string = null;
  static logger = new Logger(HttpRequestHandler.name);

  private api: Axios.AxiosInstance;

  static async fetch(
    requestConfigs: RequestConfigs,
    queries?: FindDataRequestDto,
  ) {
    const { method = 'GET', headers, url, data, ...configs } = requestConfigs;
    try {
      if (!url) {
        throw new HttpException(
          'HttpRequestHandler fetch requires "url" to work properly.',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      const endpoint = queries ? URLHandler.parseQueries(url, queries) : url;
      const { data: res } = await Axios.default({
        url: endpoint,
        method: method.toLowerCase(),
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        data,
      });

      Logger.debug({ endpoint, url, method });

      if (!res) {
        throw new Error(HttpRequestHandler.errors.tryAgain);
      }
      return res.data;
    } catch (e) {
      HttpRequestHandler.logger.error(
        'response',
        e?.response?.data || e?.response || e,
      );
    }
  }
}
