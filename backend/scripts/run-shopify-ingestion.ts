import { logger } from '../lib/logger';
import { parseDomainArgs, runShopifyIngestionRunner } from '../lib/shopify-ingestion-runner';

async function main(): Promise<void> {
  const domains = parseDomainArgs(process.argv.slice(2));
  const summary = await runShopifyIngestionRunner({ domains });

  if (summary.failures > 0) {
    logger.warn(`Runner completed with ${summary.failures} brand failure(s).`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  logger.error(`run-shopify-ingestion failed: ${message}`);
  process.exit(1);
});
