import { launchBrands, LaunchBrandSeed } from '../config/launch-brands';
import { logger } from '../lib/logger';
import { supabase } from '../lib/supabase';

function normalizeDomain(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.+$/, '');
}

function toSlug(seed: LaunchBrandSeed): string {
  return normalizeDomain(seed.domain).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function main(): Promise<void> {
  logger.info(`Starting brand seed for ${launchBrands.length} launch brands`);

  const rows = launchBrands.map((seed) => {
    const domain = normalizeDomain(seed.domain);

    return {
      name: seed.name.trim(),
      domain,
      slug: toSlug(seed),
      is_active: seed.active,
      source_type: seed.source_type,
    };
  });

  let inserted = 0;
  let updated = 0;

  for (const row of rows) {
    const { data: existingRows, error: selectError } = await supabase
      .from('brands')
      .select('id')
      .eq('domain', row.domain)
      .limit(1);

    if (selectError) {
      throw new Error(`Failed to check existing brand (${row.domain}): ${selectError.message}`);
    }

    const existing = existingRows?.[0];
    if (!existing) {
      const { error: insertError } = await supabase.from('brands').insert(row);
      if (insertError) {
        throw new Error(`Failed to insert brand (${row.domain}): ${insertError.message}`);
      }
      inserted += 1;
      continue;
    }

    const { error: updateError } = await supabase
      .from('brands')
      .update({
        name: row.name,
        slug: row.slug,
        source_type: row.source_type,
        is_active: row.is_active,
      })
      .eq('id', existing.id);

    if (updateError) {
      throw new Error(`Failed to update brand (${row.domain}): ${updateError.message}`);
    }
    updated += 1;
  }

  logger.info(`Brand seed complete. inserted=${inserted}, updated=${updated}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  logger.error(`seed:brands failed: ${message}`);
  process.exit(1);
});
