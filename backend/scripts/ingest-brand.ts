import { getFlag, normalizeDomain } from '../lib/cli-args';
import { logger } from '../lib/logger';
import { runShopifyIngestionRunner } from '../lib/shopify-ingestion-runner';

async function main(): Promise<void> {
  const domainArg = getFlag(process.argv.slice(2), 'domain');
  if (!domainArg) {
    throw new Error('Missing required flag: --domain=<domain>');
  }

  const domain = normalizeDomain(domainArg);
  const summary = await runShopifyIngestionRunner({ domains: [domain] });

  if (summary.brandsProcessed === 0) {
    logger.warn(`No active Shopify brand matched domain: ${domain}`);
    return;
  }

  if (summary.failures > 0) {
    logger.warn(`Ingest brand completed with ${summary.failures} failure(s).`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  logger.error(`ingest:brand failed: ${message}`);
  process.exit(1);
});
