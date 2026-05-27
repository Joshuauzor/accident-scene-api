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

export interface PaginationData {
  records?: any[];
  pagination: {
    total_items: number;
    total_pages: number;
    current_page: number;
    limit: number;
    offset: number;
  };
}
