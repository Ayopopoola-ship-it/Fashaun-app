import { logger } from '../lib/logger';
import { supabase } from '../lib/supabase';

async function main(): Promise<void> {
  const { data, error } = await supabase
    .from('brands')
    .select('id, name, domain, source_type, is_active, updated_at')
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Failed to list brands: ${error.message}`);
  }

  const brands = data ?? [];
  logger.info(`Found ${brands.length} brands`);

  for (const brand of brands) {
    logger.info(
      `${brand.name} | domain=${brand.domain} | source_type=${brand.source_type} | active=${brand.is_active} | updated_at=${brand.updated_at}`
    );
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  logger.error(`brands:list failed: ${message}`);
  process.exit(1);
});
