import { getFlag, normalizeDomain } from '../lib/cli-args';
import { logger } from '../lib/logger';
import { sendNewDropPushAlerts } from '../lib/push-new-drop-alerts';

function parseDomains(argv: string[]): string[] {
  const raw = getFlag(argv, 'domain');
  if (!raw) {
    return [];
  }

  return raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .map((value) => normalizeDomain(value));
}

function parsePositiveNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const sinceMinutes = parsePositiveNumber(getFlag(argv, 'since-minutes'), 60);
  const productLimit = parsePositiveNumber(getFlag(argv, 'limit-products'), 500);
  const domains = parseDomains(argv);

  logger.info(
    `Starting new drop push send (since_minutes=${sinceMinutes}, product_limit=${productLimit}${
      domains.length > 0 ? `, domains=${domains.join(', ')}` : ''
    })`
  );

  const summary = await sendNewDropPushAlerts({
    sinceMinutes,
    productLimit,
    domains,
  });

  logger.info(
    `New drop push summary: alerts_prepared=${summary.alertsPrepared}, alerts_with_token=${summary.alertsWithToken}, messages_sent=${summary.messagesSent}, ticket_failures=${summary.ticketsFailed}`
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  logger.error(`push:new-drop failed: ${message}`);
  process.exit(1);
});
