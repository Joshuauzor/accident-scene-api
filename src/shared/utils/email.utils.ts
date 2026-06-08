export class EmailUtils {
  static is_email(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  static normalize_email(email?: string): string {
    return (email ?? '').toLowerCase().trim();
  }
}
