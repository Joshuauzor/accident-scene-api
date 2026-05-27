import * as Axios from 'axios';
import { FindDataRequestDto } from '../utils/dtos/find.data.request.dto';

export type RequestConfigs = Axios.AxiosRequestConfig & {
  method?: Axios.Method;
  headers?: Axios.AxiosHeaders | any;
  extractData?: boolean;
};

export type ServiceInstance = new (...args: any[]) => any;

export type RequestHandlerOptions = {
  token: string;
  opts: FindDataRequestDto;
};

export interface IRequestHandler {
  event(ev: string, options: RequestHandlerOptions): any;
}
