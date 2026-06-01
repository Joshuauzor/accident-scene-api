/**
 * Universal DateTime Utility
 * Provides timezone-aware date/time handling for all regions
 *
 * Usage:
 * import { DateTime, COMMON_TIMEZONES } from 'src/shared/utils/datetime';
 *
 * const now = DateTime.now();
 * const lagosTime = DateTime.now('Africa/Lagos');
 * const isPast = DateTime.is_past(event.start_date);
 */

import {
  format,
  parse,
  parseISO,
  isValid,
  isBefore,
  isAfter,
  isEqual,
  addYears,
  addMonths,
  addWeeks,
  addDays,
  addHours,
  addMinutes,
  addSeconds,
  subYears,
  subMonths,
  subWeeks,
  subDays,
  subHours,
  subMinutes,
  subSeconds,
  differenceInYears,
  differenceInMonths,
  differenceInWeeks,
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  differenceInSeconds,
  differenceInMilliseconds,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  getYear,
  getMonth,
  getDate,
  getDay,
  getHours,
  getMinutes,
  getSeconds,
  formatDistanceToNow,
  formatDistance,
  isWithinInterval,
} from 'date-fns';
import { enUS } from 'date-fns/locale';

// ============================================
// TYPES & INTERFACES
// ============================================

export type DateFormat =
  | 'YYYY-MM-DD'
  | 'DD-MM-YYYY'
  | 'MM-DD-YYYY'
  | 'DD/MM/YYYY'
  | 'MM/DD/YYYY'
  | 'YYYY/MM/DD'
  | 'DD MMM YYYY'
  | 'MMM DD, YYYY'
  | 'MMMM DD, YYYY'
  | 'DD MMMM YYYY';

export type TimeFormat =
  | 'HH:mm'
  | 'HH:mm:ss'
  | 'hh:mm a'
  | 'hh:mm:ss a'
  | 'h:mm a'
  | 'h:mm:ss a';

export type DateTimeFormat =
  | `${DateFormat} ${TimeFormat}`
  | DateFormat
  | TimeFormat;

export type TimeUnit =
  | 'year'
  | 'years'
  | 'quarter'
  | 'quarters'
  | 'month'
  | 'months'
  | 'week'
  | 'weeks'
  | 'day'
  | 'days'
  | 'hour'
  | 'hours'
  | 'minute'
  | 'minutes'
  | 'second'
  | 'seconds'
  | 'millisecond'
  | 'milliseconds';

export interface DateTimeOptions {
  timezone?: string;
  locale?: string;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface DateRangeString {
  start_date: string;
  end_date: string;
}

export interface TimeDifference {
  years: number;
  months: number;
  weeks: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total_milliseconds: number;
}

export interface FormattedDateRange {
  date: string;
  day: string;
}

export interface MonthRange {
  year: string;
  month: string;
  start_date: string;
  end_date: string;
}

export interface ParsedDate {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
  timezone: string;
  unix_timestamp: number;
  iso_string: string;
}

export interface EventDateValidation {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface RelativeTimeResult {
  text: string;
  is_past: boolean;
  is_future: boolean;
  is_now: boolean;
}

/**
 * Common timezone identifiers for quick reference
 */
export const COMMON_TIMEZONES = {
  // Africa
  africa_lagos: 'Africa/Lagos',
  africa_johannesburg: 'Africa/Johannesburg',
  africa_cairo: 'Africa/Cairo',
  africa_nairobi: 'Africa/Nairobi',
  africa_casablanca: 'Africa/Casablanca',
  africa_accra: 'Africa/Accra',

  // Europe
  europe_london: 'Europe/London',
  europe_paris: 'Europe/Paris',
  europe_berlin: 'Europe/Berlin',
  europe_amsterdam: 'Europe/Amsterdam',
  europe_stockholm: 'Europe/Stockholm',

  // Americas
  america_new_york: 'America/New_York',
  america_los_angeles: 'America/Los_Angeles',
  america_chicago: 'America/Chicago',
  america_toronto: 'America/Toronto',
  america_sao_paulo: 'America/Sao_Paulo',

  // Asia
  asia_dubai: 'Asia/Dubai',
  asia_singapore: 'Asia/Singapore',
  asia_tokyo: 'Asia/Tokyo',
  asia_shanghai: 'Asia/Shanghai',
  asia_mumbai: 'Asia/Kolkata',

  // Australia & Pacific
  australia_sydney: 'Australia/Sydney',
  pacific_auckland: 'Pacific/Auckland',

  // UTC
  utc: 'UTC',
} as const;

export type CommonTimezone =
  (typeof COMMON_TIMEZONES)[keyof typeof COMMON_TIMEZONES];

/**
 * Country to timezone mapping (primary timezone for each country)
 */
export const COUNTRY_TIMEZONES: Record<string, string> = {
  ng: 'Africa/Lagos',
  za: 'Africa/Johannesburg',
  eg: 'Africa/Cairo',
  ke: 'Africa/Nairobi',
  gh: 'Africa/Accra',
  gb: 'Europe/London',
  fr: 'Europe/Paris',
  de: 'Europe/Berlin',
  nl: 'Europe/Amsterdam',
  se: 'Europe/Stockholm',
  us: 'America/New_York',
  ca: 'America/Toronto',
  br: 'America/Sao_Paulo',
  ae: 'Asia/Dubai',
  sg: 'Asia/Singapore',
  jp: 'Asia/Tokyo',
  cn: 'Asia/Shanghai',
  in: 'Asia/Kolkata',
  au: 'Australia/Sydney',
  nz: 'Pacific/Auckland',
};

// ============================================
// DATETIME UTILITY CLASS
// ============================================

const DEFAULT_TIMEZONE = COMMON_TIMEZONES.utc;
const DEFAULT_LOCALE = enUS;

/**
 * Universal DateTime utility class with static methods
 */
export class DateTime {
  // ============================================
  // CORE DATE OPERATIONS
  // ============================================

  /**
   * Get current date/time in UTC or specified timezone
   */
  static now(timezone?: string): Date {
    const date = new Date();
    if (timezone) {
      return DateTime.to_timezone(date, timezone);
    }
    return date;
  }

  /**
   * Get current date/time as ISO string
   */
  static now_iso(): string {
    return new Date().toISOString();
  }

  /**
   * Get current Unix timestamp (seconds)
   */
  static now_unix(): number {
    return Math.floor(Date.now() / 1000);
  }

  /**
   * Get current Unix timestamp (milliseconds)
   */
  static now_ms(): number {
    return Date.now();
  }

  /**
   * Create a Date object from various inputs
   */
  static create(
    input?: string | number | Date,
    options?: DateTimeOptions,
  ): Date {
    if (!input) {
      return DateTime.now(options?.timezone);
    }

    let date: Date;

    if (input instanceof Date) {
      date = new Date(input);
    } else if (typeof input === 'number') {
      // Assume Unix timestamp in seconds if < 10000000000, else milliseconds
      const ms = input < 10000000000 ? input * 1000 : input;
      date = new Date(ms);
    } else if (typeof input === 'string') {
      // Try ISO format first
      date = parseISO(input);
      if (!isValid(date)) {
        // Try native Date parsing
        date = new Date(input);
      }
    } else {
      date = new Date();
    }

    if (!isValid(date)) {
      throw new Error(`Invalid date input: ${input}`);
    }

    return date;
  }

  /**
   * Parse a date string with specific format
   */
  static parse(
    date_string: string,
    format_string: string,
    options?: DateTimeOptions,
  ): Date {
    const reference_date = DateTime.now(options?.timezone);
    const date = parse(date_string, format_string, reference_date);

    if (!isValid(date)) {
      throw new Error(
        `Invalid date string: "${date_string}" for format: "${format_string}"`,
      );
    }

    return date;
  }

  /**
   * Parse an ISO date string
   */
  static parse_iso(iso_string: string): Date {
    const date = parseISO(iso_string);
    if (!isValid(date)) {
      throw new Error(`Invalid ISO date string: ${iso_string}`);
    }
    return date;
  }

  // ============================================
  // TIMEZONE OPERATIONS
  // ============================================

  /**
   * Convert date to specific timezone (returns Date object adjusted)
   */
  static to_timezone(date: Date | string, timezone: string): Date {
    const d = typeof date === 'string' ? DateTime.parse_iso(date) : date;

    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    };

    const formatter = new Intl.DateTimeFormat('en-CA', options);
    const parts = formatter.formatToParts(d);

    const date_parts: Record<string, string> = {};
    parts.forEach((part) => {
      date_parts[part.type] = part.value;
    });

    return new Date(
      parseInt(date_parts.year),
      parseInt(date_parts.month) - 1,
      parseInt(date_parts.day),
      parseInt(date_parts.hour),
      parseInt(date_parts.minute),
      parseInt(date_parts.second),
    );
  }

  /**
   * Convert date from one timezone to another
   */
  static convert_timezone(
    date: Date | string,
    from_timezone: string,
    to_timezone: string,
  ): Date {
    const d = typeof date === 'string' ? DateTime.parse_iso(date) : date;

    const from_offset = DateTime.get_timezone_offset(d, from_timezone);
    const to_offset = DateTime.get_timezone_offset(d, to_timezone);

    const diff_ms = (from_offset - to_offset) * 60 * 1000;
    return new Date(d.getTime() + diff_ms);
  }

  /**
   * Get timezone offset in minutes for a specific timezone
   */
  static get_timezone_offset(date: Date, timezone: string): number {
    const utc_date = new Date(
      date.toLocaleString('en-US', { timeZone: 'UTC' }),
    );
    const tz_date = new Date(
      date.toLocaleString('en-US', { timeZone: timezone }),
    );
    return (utc_date.getTime() - tz_date.getTime()) / (60 * 1000);
  }

  /**
   * Get timezone for a country code
   */
  static get_timezone_by_country(country_code: string): string {
    return (
      COUNTRY_TIMEZONES[country_code.toLowerCase()] || COMMON_TIMEZONES.utc
    );
  }

  /**
   * Format timezone offset as string (e.g., "+01:00", "-05:00")
   */
  static format_timezone_offset(date: Date, timezone: string): string {
    const offset = -DateTime.get_timezone_offset(date, timezone);
    const hours = Math.floor(Math.abs(offset) / 60);
    const minutes = Math.abs(offset) % 60;
    const sign = offset >= 0 ? '+' : '-';
    return `${sign}${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}`;
  }

  // ============================================
  // FORMATTING
  // ============================================

  /**
   * Format date with custom format string (uses date-fns format tokens)
   */
  static format(
    date: Date | string,
    format_string: string,
    options?: DateTimeOptions,
  ): string {
    let d = typeof date === 'string' ? DateTime.parse_iso(date) : date;

    if (options?.timezone) {
      d = DateTime.to_timezone(d, options.timezone);
    }

    return format(d, format_string);
  }

  /**
   * Format date as ISO string
   */
  static format_iso(date: Date | string): string {
    const d = typeof date === 'string' ? DateTime.parse_iso(date) : date;
    return d.toISOString();
  }

  /**
   * Format date for database storage (always UTC)
   */
  static format_for_db(date: Date | string): string {
    const d = typeof date === 'string' ? DateTime.parse_iso(date) : date;
    return d.toISOString();
  }

  /**
   * Format date for display (localized)
   */
  static format_for_display(
    date: Date | string,
    timezone?: string,
    format_str = 'PPpp', // e.g., "Apr 29, 2021, 10:30 AM"
  ): string {
    let d = typeof date === 'string' ? DateTime.parse_iso(date) : date;

    if (timezone) {
      d = DateTime.to_timezone(d, timezone);
    }

    return format(d, format_str, { locale: DEFAULT_LOCALE });
  }

  /**
   * Format date as relative time (e.g., "2 hours ago", "in 3 days")
   */
  static format_relative(
    date: Date | string,
    options?: { addSuffix?: boolean; baseDate?: Date },
  ): string {
    const d = typeof date === 'string' ? DateTime.parse_iso(date) : date;

    if (options?.baseDate) {
      return formatDistance(d, options.baseDate, {
        addSuffix: options.addSuffix ?? true,
        locale: DEFAULT_LOCALE,
      });
    }

    return formatDistanceToNow(d, {
      addSuffix: options?.addSuffix ?? true,
      locale: DEFAULT_LOCALE,
    });
  }

  /**
   * Get relative time with additional context
   */
  static get_relative_time(date: Date | string): RelativeTimeResult {
    const d = typeof date === 'string' ? DateTime.parse_iso(date) : date;
    const now = new Date();

    const diff = d.getTime() - now.getTime();
    const threshold = 60000; // 1 minute threshold for "now"

    return {
      text: DateTime.format_relative(d),
      is_past: diff < -threshold,
      is_future: diff > threshold,
      is_now: Math.abs(diff) <= threshold,
    };
  }

  // ============================================
  // DATE ARITHMETIC
  // ============================================

  /**
   * Add time to a date
   */
  static add(date: Date | string, amount: number, unit: TimeUnit): Date {
    const d =
      typeof date === 'string' ? DateTime.parse_iso(date) : new Date(date);
    const normalized_unit = unit.replace(/s$/, '') as string;

    switch (normalized_unit) {
      case 'year':
        return addYears(d, amount);
      case 'month':
        return addMonths(d, amount);
      case 'week':
        return addWeeks(d, amount);
      case 'day':
        return addDays(d, amount);
      case 'hour':
        return addHours(d, amount);
      case 'minute':
        return addMinutes(d, amount);
      case 'second':
        return addSeconds(d, amount);
      case 'millisecond':
        return new Date(d.getTime() + amount);
      default:
        throw new Error(`Invalid time unit: ${unit}`);
    }
  }

  /**
   * Subtract time from a date
   */
  static subtract(date: Date | string, amount: number, unit: TimeUnit): Date {
    const d =
      typeof date === 'string' ? DateTime.parse_iso(date) : new Date(date);
    const normalized_unit = unit.replace(/s$/, '') as string;

    switch (normalized_unit) {
      case 'year':
        return subYears(d, amount);
      case 'month':
        return subMonths(d, amount);
      case 'week':
        return subWeeks(d, amount);
      case 'day':
        return subDays(d, amount);
      case 'hour':
        return subHours(d, amount);
      case 'minute':
        return subMinutes(d, amount);
      case 'second':
        return subSeconds(d, amount);
      case 'millisecond':
        return new Date(d.getTime() - amount);
      default:
        throw new Error(`Invalid time unit: ${unit}`);
    }
  }

  // ============================================
  // DATE COMPARISONS
  // ============================================

  /**
   * Check if date is valid
   */
  static is_valid(date: Date | string): boolean {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return isValid(d);
  }

  /**
   * Check if date1 is before date2
   */
  static is_before(date1: Date | string, date2: Date | string): boolean {
    const d1 = typeof date1 === 'string' ? DateTime.parse_iso(date1) : date1;
    const d2 = typeof date2 === 'string' ? DateTime.parse_iso(date2) : date2;
    return isBefore(d1, d2);
  }

  /**
   * Check if date1 is after date2
   */
  static is_after(date1: Date | string, date2: Date | string): boolean {
    const d1 = typeof date1 === 'string' ? DateTime.parse_iso(date1) : date1;
    const d2 = typeof date2 === 'string' ? DateTime.parse_iso(date2) : date2;
    return isAfter(d1, d2);
  }

  /**
   * Check if dates are equal
   */
  static is_equal(date1: Date | string, date2: Date | string): boolean {
    const d1 = typeof date1 === 'string' ? DateTime.parse_iso(date1) : date1;
    const d2 = typeof date2 === 'string' ? DateTime.parse_iso(date2) : date2;
    return isEqual(d1, d2);
  }

  /**
   * Check if date is in the past
   */
  static is_past(date: Date | string): boolean {
    return DateTime.is_before(date, new Date());
  }

  /**
   * Check if date is in the future
   */
  static is_future(date: Date | string): boolean {
    return DateTime.is_after(date, new Date());
  }

  /**
   * Check if date is today
   */
  static is_today(date: Date | string, timezone?: string): boolean {
    let d = typeof date === 'string' ? DateTime.parse_iso(date) : date;
    let now = new Date();

    if (timezone) {
      d = DateTime.to_timezone(d, timezone);
      now = DateTime.to_timezone(now, timezone);
    }

    return (
      getYear(d) === getYear(now) &&
      getMonth(d) === getMonth(now) &&
      getDate(d) === getDate(now)
    );
  }

  /**
   * Check if date is within a range
   */
  static is_within_range(
    date: Date | string,
    start: Date | string,
    end: Date | string,
  ): boolean {
    const d = typeof date === 'string' ? DateTime.parse_iso(date) : date;
    const s = typeof start === 'string' ? DateTime.parse_iso(start) : start;
    const e = typeof end === 'string' ? DateTime.parse_iso(end) : end;

    return isWithinInterval(d, { start: s, end: e });
  }

  // ============================================
  // DATE DIFFERENCES
  // ============================================

  /**
   * Get difference between two dates
   */
  static difference(
    date1: Date | string,
    date2: Date | string,
  ): TimeDifference {
    const d1 = typeof date1 === 'string' ? DateTime.parse_iso(date1) : date1;
    const d2 = typeof date2 === 'string' ? DateTime.parse_iso(date2) : date2;

    return {
      years: differenceInYears(d1, d2),
      months: differenceInMonths(d1, d2),
      weeks: differenceInWeeks(d1, d2),
      days: differenceInDays(d1, d2),
      hours: differenceInHours(d1, d2),
      minutes: differenceInMinutes(d1, d2),
      seconds: differenceInSeconds(d1, d2),
      total_milliseconds: differenceInMilliseconds(d1, d2),
    };
  }

  /**
   * Get difference in specific unit
   */
  static difference_in(
    date1: Date | string,
    date2: Date | string,
    unit: TimeUnit,
  ): number {
    const d1 = typeof date1 === 'string' ? DateTime.parse_iso(date1) : date1;
    const d2 = typeof date2 === 'string' ? DateTime.parse_iso(date2) : date2;
    const normalized_unit = unit.replace(/s$/, '') as string;

    switch (normalized_unit) {
      case 'year':
        return differenceInYears(d1, d2);
      case 'month':
        return differenceInMonths(d1, d2);
      case 'week':
        return differenceInWeeks(d1, d2);
      case 'day':
        return differenceInDays(d1, d2);
      case 'hour':
        return differenceInHours(d1, d2);
      case 'minute':
        return differenceInMinutes(d1, d2);
      case 'second':
        return differenceInSeconds(d1, d2);
      case 'millisecond':
        return differenceInMilliseconds(d1, d2);
      default:
        throw new Error(`Invalid time unit: ${unit}`);
    }
  }

  // ============================================
  // DATE BOUNDARIES
  // ============================================

  /**
   * Get start of day
   */
  static start_of_day(date: Date | string, timezone?: string): Date {
    let d =
      typeof date === 'string' ? DateTime.parse_iso(date) : new Date(date);
    if (timezone) {
      d = DateTime.to_timezone(d, timezone);
    }
    return startOfDay(d);
  }

  /**
   * Get end of day
   */
  static end_of_day(date: Date | string, timezone?: string): Date {
    let d =
      typeof date === 'string' ? DateTime.parse_iso(date) : new Date(date);
    if (timezone) {
      d = DateTime.to_timezone(d, timezone);
    }
    return endOfDay(d);
  }

  /**
   * Get start of week
   */
  static start_of_week(date: Date | string, timezone?: string): Date {
    let d =
      typeof date === 'string' ? DateTime.parse_iso(date) : new Date(date);
    if (timezone) {
      d = DateTime.to_timezone(d, timezone);
    }
    return startOfWeek(d, { weekStartsOn: 1 }); // Monday
  }

  /**
   * Get end of week
   */
  static end_of_week(date: Date | string, timezone?: string): Date {
    let d =
      typeof date === 'string' ? DateTime.parse_iso(date) : new Date(date);
    if (timezone) {
      d = DateTime.to_timezone(d, timezone);
    }
    return endOfWeek(d, { weekStartsOn: 1 }); // Sunday
  }

  /**
   * Get start of month
   */
  static start_of_month(date: Date | string, timezone?: string): Date {
    let d =
      typeof date === 'string' ? DateTime.parse_iso(date) : new Date(date);
    if (timezone) {
      d = DateTime.to_timezone(d, timezone);
    }
    return startOfMonth(d);
  }

  /**
   * Get end of month
   */
  static end_of_month(date: Date | string, timezone?: string): Date {
    let d =
      typeof date === 'string' ? DateTime.parse_iso(date) : new Date(date);
    if (timezone) {
      d = DateTime.to_timezone(d, timezone);
    }
    return endOfMonth(d);
  }

  /**
   * Get start of year
   */
  static start_of_year(date: Date | string, timezone?: string): Date {
    let d =
      typeof date === 'string' ? DateTime.parse_iso(date) : new Date(date);
    if (timezone) {
      d = DateTime.to_timezone(d, timezone);
    }
    return startOfYear(d);
  }

  /**
   * Get end of year
   */
  static end_of_year(date: Date | string, timezone?: string): Date {
    let d =
      typeof date === 'string' ? DateTime.parse_iso(date) : new Date(date);
    if (timezone) {
      d = DateTime.to_timezone(d, timezone);
    }
    return endOfYear(d);
  }

  // ============================================
  // DATE PARTS
  // ============================================

  /**
   * Get parsed date components
   */
  static get_parts(date: Date | string, timezone?: string): ParsedDate {
    let d = typeof date === 'string' ? DateTime.parse_iso(date) : date;

    if (timezone) {
      d = DateTime.to_timezone(d, timezone);
    }

    return {
      year: getYear(d),
      month: getMonth(d) + 1, // 1-indexed
      day: getDate(d),
      hour: getHours(d),
      minute: getMinutes(d),
      second: getSeconds(d),
      millisecond: d.getMilliseconds(),
      timezone: timezone || DEFAULT_TIMEZONE,
      unix_timestamp: Math.floor(d.getTime() / 1000),
      iso_string: d.toISOString(),
    };
  }

  /**
   * Get day of week (0 = Sunday, 1 = Monday, etc.)
   */
  static get_day_of_week(date: Date | string): number {
    const d = typeof date === 'string' ? DateTime.parse_iso(date) : date;
    return getDay(d);
  }

  /**
   * Get day name
   */
  static get_day_name(
    date: Date | string,
    format_type: 'long' | 'short' = 'long',
  ): string {
    const d = typeof date === 'string' ? DateTime.parse_iso(date) : date;
    return DateTime.format(d, format_type === 'long' ? 'EEEE' : 'EEE');
  }

  /**
   * Get month name
   */
  static get_month_name(
    date: Date | string,
    format_type: 'long' | 'short' = 'long',
  ): string {
    const d = typeof date === 'string' ? DateTime.parse_iso(date) : date;
    return DateTime.format(d, format_type === 'long' ? 'MMMM' : 'MMM');
  }

  // ============================================
  // RANGE GENERATORS
  // ============================================

  /**
   * Get last N days
   */
  static get_last_n_days(n: number, timezone?: string): FormattedDateRange[] {
    const dates: FormattedDateRange[] = [];
    const now = timezone
      ? DateTime.to_timezone(new Date(), timezone)
      : new Date();

    for (let i = n - 1; i >= 0; i--) {
      const date = DateTime.subtract(now, i, 'days');
      dates.push({
        date: DateTime.format(date, 'yyyy-MM-dd'),
        day: DateTime.format(date, 'EEEE'),
      });
    }

    return dates;
  }

  /**
   * Get last N months with date ranges
   */
  static get_last_n_months(n: number, timezone?: string): MonthRange[] {
    const months: MonthRange[] = [];
    const now = timezone
      ? DateTime.to_timezone(new Date(), timezone)
      : new Date();

    for (let i = n - 1; i >= 0; i--) {
      const month_date = DateTime.subtract(now, i, 'months');
      const start = DateTime.start_of_month(month_date);
      const end = DateTime.end_of_month(month_date);

      months.push({
        year: DateTime.format(month_date, 'yyyy'),
        month: DateTime.format(month_date, 'MMMM'),
        start_date: DateTime.format(start, 'yyyy-MM-dd'),
        end_date: DateTime.format(end, 'yyyy-MM-dd'),
      });
    }

    return months;
  }

  /**
   * Get date range between two dates
   */
  static get_date_range(
    start: Date | string,
    end: Date | string,
    interval: 'day' | 'week' | 'month' = 'day',
  ): DateRangeString[] {
    const s =
      typeof start === 'string' ? DateTime.parse_iso(start) : new Date(start);
    const e = typeof end === 'string' ? DateTime.parse_iso(end) : new Date(end);
    const ranges: DateRangeString[] = [];

    let current = s;
    while (DateTime.is_before(current, e) || DateTime.is_equal(current, e)) {
      let period_end: Date;

      switch (interval) {
        case 'week':
          period_end = DateTime.end_of_week(current);
          break;
        case 'month':
          period_end = DateTime.end_of_month(current);
          break;
        default:
          period_end = DateTime.end_of_day(current);
      }

      // Don't exceed the end date
      if (DateTime.is_after(period_end, e)) {
        period_end = e;
      }

      ranges.push({
        start_date: DateTime.format(current, 'yyyy-MM-dd'),
        end_date: DateTime.format(period_end, 'yyyy-MM-dd'),
      });

      // Move to next period
      current = DateTime.add(period_end, 1, 'days');
    }

    return ranges;
  }

  // ============================================
  // EVENT-SPECIFIC VALIDATIONS
  // ============================================

  /**
   * Validate event dates
   */
  static validate_event_dates(data: {
    start_date: Date | string;
    end_date: Date | string;
    timezone?: string;
    allow_past_start?: boolean;
  }): EventDateValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    const start =
      typeof data.start_date === 'string'
        ? DateTime.parse_iso(data.start_date)
        : data.start_date;
    const end =
      typeof data.end_date === 'string'
        ? DateTime.parse_iso(data.end_date)
        : data.end_date;

    // Check valid dates
    if (!DateTime.is_valid(start)) {
      errors.push('Start date is invalid');
    }
    if (!DateTime.is_valid(end)) {
      errors.push('End date is invalid');
    }

    if (errors.length > 0) {
      return { is_valid: false, errors, warnings };
    }

    // Check end is after start
    if (!DateTime.is_after(end, start)) {
      errors.push('End date must be after start date');
    }

    // Check if start is not in the past (unless explicitly allowed)
    if (!data.allow_past_start && DateTime.is_past(start)) {
      errors.push('Start date cannot be in the past');
    }

    // Warning for very long events (> 7 days)
    const days_diff = DateTime.difference_in(end, start, 'days');
    if (days_diff > 7) {
      warnings.push(
        `Event duration is ${days_diff} days. Consider if this is intended.`,
      );
    }

    // Warning for events more than 1 year in the future
    const years_diff = DateTime.difference_in(start, new Date(), 'years');
    if (years_diff >= 1) {
      warnings.push('Event is scheduled more than 1 year in the future');
    }

    return {
      is_valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate ticket sales dates
   */
  static validate_sales_dates(data: {
    sales_start: Date | string;
    sales_end: Date | string;
    event_start: Date | string;
    event_end: Date | string;
  }): EventDateValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    const sales_start =
      typeof data.sales_start === 'string'
        ? DateTime.parse_iso(data.sales_start)
        : data.sales_start;
    const sales_end =
      typeof data.sales_end === 'string'
        ? DateTime.parse_iso(data.sales_end)
        : data.sales_end;
    const event_start =
      typeof data.event_start === 'string'
        ? DateTime.parse_iso(data.event_start)
        : data.event_start;
    const event_end =
      typeof data.event_end === 'string'
        ? DateTime.parse_iso(data.event_end)
        : data.event_end;

    // Validate all dates
    if (!DateTime.is_valid(sales_start))
      errors.push('Sales start date is invalid');
    if (!DateTime.is_valid(sales_end)) errors.push('Sales end date is invalid');
    if (!DateTime.is_valid(event_start))
      errors.push('Event start date is invalid');
    if (!DateTime.is_valid(event_end)) errors.push('Event end date is invalid');

    if (errors.length > 0) {
      return { is_valid: false, errors, warnings };
    }

    // Sales end must be after sales start
    if (!DateTime.is_after(sales_end, sales_start)) {
      errors.push('Sales end date must be after sales start date');
    }

    // Sales end should typically be before or at event end
    if (DateTime.is_after(sales_end, event_end)) {
      warnings.push('Sales end date is after event end date');
    }

    // Sales start should be before event start
    if (DateTime.is_after(sales_start, event_start)) {
      warnings.push('Sales start date is after event start date');
    }

    return {
      is_valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Check if event is currently active (within check-in window)
   */
  static is_event_active(
    event_start: Date | string,
    event_end: Date | string,
    options?: {
      hoursBeforeStart?: number;
      hoursAfterEnd?: number;
    },
  ): boolean {
    const start =
      typeof event_start === 'string'
        ? DateTime.parse_iso(event_start)
        : event_start;
    const end =
      typeof event_end === 'string' ? DateTime.parse_iso(event_end) : event_end;
    const now = new Date();

    const hours_before_start = options?.hoursBeforeStart ?? 4;
    const hours_after_end = options?.hoursAfterEnd ?? 6;

    const check_in_start = DateTime.subtract(
      start,
      hours_before_start,
      'hours',
    );
    const check_in_end = DateTime.add(end, hours_after_end, 'hours');

    return DateTime.is_within_range(now, check_in_start, check_in_end);
  }

  /**
   * Get time until event starts
   */
  static get_time_until_event(event_start: Date | string): {
    is_past: boolean;
    text: string;
    days: number;
    hours: number;
    minutes: number;
  } {
    const start =
      typeof event_start === 'string'
        ? DateTime.parse_iso(event_start)
        : event_start;
    const now = new Date();
    const diff = DateTime.difference(start, now);

    return {
      is_past: DateTime.is_past(start),
      text: DateTime.format_relative(start),
      days: Math.abs(diff.days),
      hours: Math.abs(diff.hours) % 24,
      minutes: Math.abs(diff.minutes) % 60,
    };
  }
}
