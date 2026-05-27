export class EmailUtils {
  static normalize_email(email?: string | null): string {
    return typeof email === 'string' ? email.trim().toLowerCase() : '';
  }

  static is_email(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}
