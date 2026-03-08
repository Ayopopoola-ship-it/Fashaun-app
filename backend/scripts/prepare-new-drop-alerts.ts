import { getFlag, normalizeDomain } from '../lib/cli-args';
import { logger } from '../lib/logger';
import { prepareNewDropAlerts } from '../lib/new-drop-alerts';

function parseDomains(argv: string[]): string[] {
  const domainFromFlag = getFlag(argv, 'domain');
  if (!domainFromFlag) {
    return [];
  }

  return domainFromFlag
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
  const sinceMinutes = parsePositiveNumber(getFlag(process.argv.slice(2), 'since-minutes'), 60);
  const productLimit = parsePositiveNumber(getFlag(process.argv.slice(2), 'limit-products'), 500);
  const domains = parseDomains(process.argv.slice(2));

  const result = await prepareNewDropAlerts({
    sinceMinutes,
    productLimit,
    domains,
  });

  logger.info(
    `New drop alert prep summary: since=${result.summary.sinceIso}, products_scanned=${result.summary.productsScanned}, follower_matches=${result.summary.followerMatches}, alerts_prepared=${result.summary.alertsPrepared}`
  );

  if (result.alerts.length === 0) {
    logger.warn('No alerts prepared for this run.');
    return;
  }

  const preview = result.alerts.slice(0, 5);
  for (const alert of preview) {
    logger.info(
      `ALERT ${alert.alertType} user=${alert.userId} brand=${alert.brandName} (${alert.brandDomain}) product=${alert.productName}`
    );
  }

  if (result.alerts.length > preview.length) {
    logger.info(`...and ${result.alerts.length - preview.length} more prepared alert(s).`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  logger.error(`alerts:new-drop failed: ${message}`);
  process.exit(1);
});
