import { FindDataRequestDto } from '../utils/dtos/find.data.request.dto';

export class URLHandler {
  public static parseQueries(url: string, opts?: FindDataRequestDto) {
    if (!opts) return url;
    const opt_size = Object.entries(opts).length;
    const opts_has_many_queries = opt_size > 1;
    let count = 0;
    if (opt_size) url += '?';
    for (const query in opts) {
      if (Object.prototype.hasOwnProperty.call(opts, query)) {
        const value = opts[query];
        url +=
          (opts_has_many_queries && !count) || !opts_has_many_queries
            ? `${query}=${value}`
            : `&${query}=${value}`;
      }
      count++;
    }
    return url;
  }
}
