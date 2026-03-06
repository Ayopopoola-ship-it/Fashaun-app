import { logger } from '../lib/logger';
import { supabase } from '../lib/supabase';

async function main(): Promise<void> {
  logger.info('Shopify ingestion scaffold is set up. Ingestion logic not implemented yet.');
  void supabase;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  logger.error(`ingest:shopify failed: ${message}`);
  process.exit(1);
});
