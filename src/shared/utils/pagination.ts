import { BadRequestException } from '@nestjs/common';
import { literal, Op, WhereOptions } from 'sequelize';
import { CalcPaginationType, PaginationData } from '../types/pagination';
import {
  FilterConfig,
  FilterParams,
  SearchFilterOptions,
  SortConfig,
} from '../types/types';

export const calculate_pagination = (
  page: number,
  size: number,
): CalcPaginationType => {
  const limit = size ? +size : 10;
  const offset = page ? page * limit : 0;
  return {
    limit,
    offset,
  };
};

export const calculate_pagination_data = (
  data: { count; rows: any[] },
  page: number,
  limit: number,
): PaginationData => {
  const { count: total_items, rows: records } = data;
  const current_page = page ? +page : 0;
  const total_pages = Math.ceil(total_items / limit);
  const pagination = calculate_pagination(page, limit);

  return {
    records,
    pagination: {
      total_items,
      total_pages,
      current_page,
      ...pagination,
    },
  };
};

const add_search_conditions = (
  where_clause: WhereOptions,
  search_conditions: any[],
): WhereOptions => {
  if (search_conditions.length === 0) return where_clause;

  if (Object.keys(where_clause).length > 0) {
    return {
      [Op.and]: [where_clause, { [Op.or]: search_conditions }],
    };
  } else {
    return {
      [Op.or]: search_conditions,
    };
  }
};

export const build_filter_conditions = (
  params: FilterParams,
  config: FilterConfig,
): WhereOptions => {
  const where: WhereOptions = {};
  const { allowed_fields, field_operators = {} } = config;

  validate_filter_params(params, allowed_fields);

  for (const [field, value] of Object.entries(params)) {
    const field_config = field_operators[field] || {};
    const { type, operators = [], allowed_values } = field_config;

    try {
      if (value === '' || !value) continue;

      let processed_value = value;
      switch (type) {
        case 'number':
          processed_value = Number(value);
          if (isNaN(processed_value)) throw new Error('Invalid number');
          break;
        case 'boolean':
          processed_value = value === 'true';
          break;
        case 'date':
          processed_value = new Date(value);
          if (isNaN(processed_value.getTime())) throw new Error('Invalid date');
          break;
        case 'array':
          if (Array.isArray(value)) {
            processed_value = value;
          } else if (typeof value === 'string') {
            processed_value = value
              .split(',')
              .map((v) => v.trim())
              .filter((v) => v !== '');
          } else {
            processed_value = [value];
          }
          break;
      }

      if (allowed_values) {
        if (type === 'array') {
          const invalid_values = processed_value.filter(
            (v) => !allowed_values.includes(v),
          );
          if (invalid_values.length > 0) {
            throw new Error(
              `${invalid_values.join(
                ', ',
              )}. Allowed values: ${allowed_values.join(', ')}`,
            );
          }
        } else if (!allowed_values.includes(processed_value)) {
          throw new Error(
            `${processed_value}. Allowed values: ${allowed_values.join(', ')}`,
          );
        }
      }

      // Build Sequelize operators - FIXED VERSION
      if (type === 'array') {
        if (operators.includes('contains')) {
          where[field] = literal(
            `JSON_CONTAINS(${field}, '["${processed_value}"]')`,
          );
        } else if (operators.includes('overlap')) {
          where[field] = { [Op.overlap]: processed_value };
        } else {
          where[field] = { [Op.in]: processed_value };
        }
      } else {
        // Handle operator syntax (e.g., field[operator]=value)
        if (typeof processed_value === 'string' && operators.includes('like')) {
          where[field] = { [Op.like]: `%${processed_value}%` };
        } else if (operators.length > 0) {
          // Handle bracket operators (e.g., price[gte]=100)
          const operator_keys = Object.keys(value);
          if (operator_keys.length > 0 && operator_keys[0] in Op) {
            const operator = operator_keys[0] as keyof typeof Op;
            where[field] = { [Op[operator]]: value[operator] };
          } else {
            // Use first operator from config or default to equality
            const [operator] = operators;
            where[field] = operator
              ? { [Op[operator]]: processed_value }
              : processed_value;
          }
        } else {
          // Default to equality
          where[field] = processed_value;
        }
      }
    } catch (error) {
      throw new BadRequestException(
        `Invalid value for ${field}: ${error.message}`,
      );
    }
  }

  return where;
};

export const validate_filter_params = (
  params: FilterParams,
  allowed_fields: string[],
): void => {
  const invalid_params = Object.keys(params).filter(
    (key) => !allowed_fields.includes(key),
  );

  if (invalid_params.length > 0) {
    throw new BadRequestException(
      `Invalid filter parameters: ${invalid_params.join(', ')}.`,
    );
  }
};

export const build_sort_order = (
  params: FilterParams,
  sort_config?: SortConfig,
): [string, string][] => {
  const { sort_by, sort_order } = params;

  const {
    default_field = 'createdAt',
    default_order = 'DESC',
    allowed_fields = [],
  } = sort_config || {};

  const effective_allowed_fields =
    allowed_fields.length > 0
      ? allowed_fields
      : [
          'createdAt',
          'created_at',
          'updatedAt',
          'purchased_at',
          // Common nested fields (will work if associations exist)
          // 'EventTickets.name',
        ];

  if (
    sort_by &&
    effective_allowed_fields.length > 0 &&
    !effective_allowed_fields.includes(sort_by)
  ) {
    throw new BadRequestException(
      `Invalid sort field '${sort_by}'. Allowed fields: ${effective_allowed_fields.join(
        ', ',
      )}`,
    );
  }

  if (sort_order && !['ASC', 'DESC'].includes(sort_order.toUpperCase())) {
    throw new BadRequestException(
      'Invalid sort order. Allowed values: ASC, DESC',
    );
  }

  const field = sort_by || default_field;
  const order = (sort_order?.toUpperCase() || default_order) as 'ASC' | 'DESC';

  return [[field, order]];
};

export const search_filter = (
  query_params: Record<string, any>,
  options: SearchFilterOptions,
) => {
  const {
    allowed_fields,
    field_config = {},
    user_id,
    referrer_id,
    search_fields = [],
    sort_config,
    include_models = [],
  } = options;

  const {
    take = 10,
    skip = 0,
    search,
    sort_by,
    sort_order,
    usepaginate,
    ...filter_params
  } = query_params;
  void usepaginate;

  const parsed_take = Math.max(1, Number(take)) || 10;
  const parsed_skip = Math.max(0, Number(skip)) || 0;

  if (isNaN(parsed_take))
    throw new BadRequestException('Invalid take parameter');
  if (isNaN(parsed_skip))
    throw new BadRequestException('Invalid skip parameter');

  const main_filters: Record<string, any> = {};
  const nested_filters: Record<string, Record<string, any>> = {};
  const double_nested_filters: Record<
    string,
    Record<string, Record<string, any>>
  > = {};

  Object.entries(filter_params).forEach(([key, value]) => {
    // Skip only undefined/null, but allow empty strings to pass through validation
    if (value === null || value === undefined) {
      return;
    }

    // Allow empty strings to pass through - they'll be handled in build_filter_conditions
    const parts = key.split('.');

    if (parts.length === 1) {
      // Main model field (e.g., status)
      main_filters[key] = value;
    } else if (parts.length === 2) {
      // First-level nested model (e.g., EventTickets.name)
      const [model_name, field_name] = parts;
      if (!nested_filters[model_name]) {
        nested_filters[model_name] = {};
      }
      nested_filters[model_name][field_name] = value;
    } else if (parts.length === 3) {
      // Double nested model (e.g., Users.full_name)
      const [parent_model, nested_model, field_name] = parts;
      if (!double_nested_filters[parent_model]) {
        double_nested_filters[parent_model] = {};
      }
      if (!double_nested_filters[parent_model][nested_model]) {
        double_nested_filters[parent_model][nested_model] = {};
      }
      double_nested_filters[parent_model][nested_model][field_name] = value;
    }
  });

  // Validate main model filter parameters
  validate_filter_params(main_filters, allowed_fields);

  // Build base where conditions for main model
  const filter_config: FilterConfig = {
    allowed_fields,
    field_operators: field_config,
  };
  const where = build_filter_conditions(main_filters, filter_config);

  if (user_id) where['user_id'] = user_id;
  if (referrer_id) where['referrer_id'] = referrer_id;

  const include: any[] = [];

  if (search && search_fields.length) {
    const search_conditions = search_fields.map((field) => ({
      [field]: { [Op.iLike]: `%${search}%` },
    }));
    where[Op.or] = search_conditions;
  }

  include_models.forEach((model_config) => {
    const {
      model_name,
      search_fields: model_search_fields = [],
      allowed_fields: model_allowed_fields = [],
      field_config: model_field_config = {},
      nested_models = [],
    } = model_config;

    let model_where: WhereOptions = {};

    // Add nested model filters
    if (nested_filters[model_name]) {
      const nested_filter_config: FilterConfig = {
        allowed_fields: model_allowed_fields,
        field_operators: model_field_config,
      };
      Object.assign(
        model_where,
        build_filter_conditions(
          nested_filters[model_name],
          nested_filter_config,
        ),
      );
    }

    // Add search conditions for nested model
    if (search && model_search_fields.length) {
      const model_search_conditions = model_search_fields.map((field) => ({
        [field]: { [Op.iLike]: `%${search}%` },
      }));
      model_where = add_search_conditions(model_where, model_search_conditions);
    }

    // Process double nested models (e.g., event_managers -> user_details)
    const nested_includes: any[] = [];
    nested_models.forEach((nested_config) => {
      const {
        model_name: nested_model_name,
        search_fields: nested_search_fields = [],
        allowed_fields: nested_allowed_fields = [],
        field_config: nested_field_config = {},
      } = nested_config;

      let nested_where: WhereOptions = {};

      // Add double nested filters
      if (
        double_nested_filters[model_name] &&
        double_nested_filters[model_name][nested_model_name]
      ) {
        const nested_filter_config: FilterConfig = {
          allowed_fields: nested_allowed_fields,
          field_operators: nested_field_config,
        };
        Object.assign(
          nested_where,
          build_filter_conditions(
            double_nested_filters[model_name][nested_model_name],
            nested_filter_config,
          ),
        );
      }

      // Add search conditions for double nested model
      if (search && nested_search_fields.length) {
        const nested_search_conditions = nested_search_fields.map((field) => ({
          [field]: { [Op.iLike]: `%${search}%` },
        }));
        nested_where = add_search_conditions(
          nested_where,
          nested_search_conditions,
        );
      }

      nested_includes.push({
        model: nested_model_name,
        where: Object.keys(nested_where).length > 0 ? nested_where : undefined,
        required: false,
      });
    });

    include.push({
      model: model_name,
      where: Object.keys(model_where).length > 0 ? model_where : undefined,
      required: false,
      include: nested_includes.length > 0 ? nested_includes : undefined,
    });
  });

  const order = build_sort_order({ sort_by, sort_order }, sort_config);

  const sequelize_pagination = calculate_pagination(parsed_skip, parsed_take);

  return {
    where,
    include,
    search,
    order,
    ...sequelize_pagination,
    pagination: {
      take: parsed_take,
      skip: parsed_skip,
    },
  };
};
