export function isAdminUser(email?: string | null): boolean {
  const raw = process.env.EXPO_PUBLIC_ADMIN_EMAILS;
  if (!raw || !email) {
    return false;
  }

  const allowed = raw
    .split(',')
    .map((value: string) => value.trim().toLowerCase())
    .filter(Boolean);

  return allowed.includes(email.toLowerCase());
}
