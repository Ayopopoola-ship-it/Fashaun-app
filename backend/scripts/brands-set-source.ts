import { getFlag, normalizeDomain } from '../lib/cli-args';
import { logger } from '../lib/logger';
import { supabase } from '../lib/supabase';

const ALLOWED_SOURCES = new Set(['shopify', 'unknown']);

async function main(): Promise<void> {
  const domainArg = getFlag(process.argv.slice(2), 'domain');
  const sourceArg = getFlag(process.argv.slice(2), 'source');

  if (!domainArg) {
    throw new Error('Missing required flag: --domain=<domain>');
  }
  if (!sourceArg) {
    throw new Error('Missing required flag: --source=<shopify|unknown>');
  }

  const source = sourceArg.trim().toLowerCase();
  if (!ALLOWED_SOURCES.has(source)) {
    throw new Error(`Invalid source type: ${source}. Allowed: shopify, unknown`);
  }

  const domain = normalizeDomain(domainArg);

  const { data, error } = await supabase
    .from('brands')
    .update({ source_type: source })
    .eq('domain', domain)
    .select('id, name, domain, source_type');

  if (error) {
    throw new Error(`Failed to set source_type for ${domain}: ${error.message}`);
  }

  if (!data || data.length === 0) {
    logger.warn(`No brand found for domain: ${domain}`);
    return;
  }

  logger.info(`Updated source_type: ${data[0].name} (${data[0].domain}) -> ${data[0].source_type}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  logger.error(`brands:set-source failed: ${message}`);
  process.exit(1);
});
