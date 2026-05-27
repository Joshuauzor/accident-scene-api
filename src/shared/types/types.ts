export type RecordId = string | number;

export type SecurityConfig = {
  jwt_secret: string;
};

export type KafkaConfig = {
  brokers: string[];
  groupId: string;
};

export type GenderOptions = 'male' | 'female' | 'others';

export interface RequestPasswordResponse {
  message: string;
}

export interface ValidationError {
  error: string;
  message: string;
}

export interface SortConfig {
  default_field?: string;
  default_order?: 'ASC' | 'DESC';
  allowed_fields?: string[];
}

export interface IncludeModelConfig {
  model_name: string;
  search_fields?: string[];
  allowed_fields?: string[];
  field_config?: Record<string, any>;
  nested_models?: IncludeModelConfig[];
}
export interface SearchFilterOptions {
  user_id?: string;
  referrer_id?: string;
  event_id?: string;
  allowed_fields: string[];
  search_fields: string[];
  field_config?: Record<string, any>;
  sort_config?: SortConfig;
  include_models?: IncludeModelConfig[];
}

export interface FilterConfig {
  allowed_fields: string[];
  field_operators?: {
    [field: string]: {
      type?: 'string' | 'number' | 'boolean' | 'date' | 'array';
      operators?: (
        | 'eq'
        | 'ne'
        | 'gt'
        | 'gte'
        | 'lt'
        | 'lte'
        | 'like'
        | 'ilike'
        | 'in'
        | 'between'
        | 'contains'
        | 'overlap'
      )[];
      allowed_values?: any[];
    };
  };
}
export interface FilterParams {
  [key: string]: any;
  sort_by?: string;
  sort_order?: 'ASC' | 'DESC';
}

export interface CalcPaginationType {
  limit: number;
  offset: number;
}

export interface ResultSetMeta {
  limit: number;
  offset: number;
  page: number;
  date1?: any;
  date2?: any;
}

export interface IAuthUser {
  sub: number;
  email: string;
  iat: number;
  exp: number;
}
