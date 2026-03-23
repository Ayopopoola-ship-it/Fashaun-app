export function isAdminUser(email?: string | null): boolean {
  const raw = import.meta.env.VITE_ADMIN_EMAILS;
  if (!raw || !email) {
    return false;
  }

  const allowed = raw
    .split(',')
    .map((value: string) => value.trim().toLowerCase())
    .filter(Boolean);

  return allowed.includes(email.toLowerCase());
}
