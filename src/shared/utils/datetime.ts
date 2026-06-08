export class DateTime {
  static now_iso(): string {
    return new Date().toISOString();
  }

  static is_past(value: string | Date): boolean {
    return new Date(value).getTime() < Date.now();
  }
}
