import { getFlag, normalizeDomain } from '../lib/cli-args';
import { logger } from '../lib/logger';
import { supabase } from '../lib/supabase';

async function main(): Promise<void> {
  const domainArg = getFlag(process.argv.slice(2), 'domain');
  if (!domainArg) {
    throw new Error('Missing required flag: --domain=<domain>');
  }

  const domain = normalizeDomain(domainArg);

  const { data, error } = await supabase
    .from('brands')
    .update({ is_active: true })
    .eq('domain', domain)
    .select('id, name, domain, is_active');

  if (error) {
    throw new Error(`Failed to enable brand (${domain}): ${error.message}`);
  }

  if (!data || data.length === 0) {
    logger.warn(`No brand found for domain: ${domain}`);
    return;
  }

  logger.info(`Enabled brand: ${data[0].name} (${data[0].domain})`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  logger.error(`brands:enable failed: ${message}`);
  process.exit(1);
});
