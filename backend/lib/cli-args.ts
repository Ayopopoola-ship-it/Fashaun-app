export function getFlag(argv: string[], key: string): string | undefined {
  const prefix = `--${key}=`;
  const match = argv.find((arg) => arg.startsWith(prefix));
  if (!match) {
    return undefined;
  }
  return match.slice(prefix.length).trim();
}

export function normalizeDomain(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.+$/, '');
}
