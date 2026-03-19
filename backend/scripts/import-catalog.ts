import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { logger } from '../lib/logger';
import { supabase } from '../lib/supabase';

type SourceType = 'shopify' | 'unknown';

interface BrandImportRow {
  name: string;
  domain: string;
  active?: boolean;
  source_type?: SourceType;
  logo_url?: string | null;
  category?: string | null;
  country?: string | null;
  external_store_link?: string | null;
}

interface ProductImportRow {
  brand_domain: string;
  external_product_id: string;
  name: string;
  description?: string | null;
  image_urls?: string[];
  sizes?: string[];
  colors?: string[];
  collection?: string | null;
  availability?: boolean;
  product_url?: string | null;
  price_amount?: number | null;
  currency_code?: string;
  is_active?: boolean;
}

interface CatalogImportPayload {
  brands?: BrandImportRow[];
  products?: ProductImportRow[];
}

function normalizeDomain(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.+$/, '');
}

function toSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function getArg(name: string): string | null {
  const prefix = `--${name}=`;
  const arg = process.argv.slice(2).find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length).trim() : null;
}

async function upsertBrands(rows: BrandImportRow[]): Promise<Map<string, string>> {
  const brandIdByDomain = new Map<string, string>();
  let inserted = 0;
  let updated = 0;

  for (const row of rows) {
    const domain = normalizeDomain(row.domain);
    if (!domain || !row.name?.trim()) {
      logger.warn(`Skipping invalid brand row (domain=${row.domain})`);
      continue;
    }

    const payload = {
      name: row.name.trim(),
      domain,
      slug: toSlug(domain),
      is_active: row.active ?? true,
      source_type: row.source_type ?? 'unknown',
      logo_url: row.logo_url ?? null,
      category: row.category ?? null,
      country: row.country ?? null,
      external_store_link: row.external_store_link ?? `https://${domain}`,
    };

    const { data: existing, error: selectError } = await supabase
      .from('brands')
      .select('id')
      .eq('domain', domain)
      .limit(1);

    if (selectError) {
      throw new Error(`Failed to check brand ${domain}: ${selectError.message}`);
    }

    const existingBrand = existing?.[0];
    if (existingBrand?.id) {
      const { error: updateError } = await supabase.from('brands').update(payload).eq('id', existingBrand.id);
      if (updateError) {
        throw new Error(`Failed to update brand ${domain}: ${updateError.message}`);
      }
      brandIdByDomain.set(domain, existingBrand.id);
      updated += 1;
      continue;
    }

    const { data: insertedBrand, error: insertError } = await supabase
      .from('brands')
      .insert(payload)
      .select('id')
      .single();

    if (insertError) {
      throw new Error(`Failed to insert brand ${domain}: ${insertError.message}`);
    }

    brandIdByDomain.set(domain, insertedBrand.id);
    inserted += 1;
  }

  logger.info(`Brand import complete. inserted=${inserted}, updated=${updated}`);
  return brandIdByDomain;
}

async function upsertProducts(rows: ProductImportRow[], brandIdByDomain: Map<string, string>): Promise<void> {
  const upsertRows: Array<Record<string, unknown>> = [];
  let skipped = 0;

  for (const row of rows) {
    const domain = normalizeDomain(row.brand_domain);
    const brandId = brandIdByDomain.get(domain);

    if (!brandId) {
      skipped += 1;
      logger.warn(`Skipping product with unknown brand_domain=${row.brand_domain}`);
      continue;
    }

    if (!row.external_product_id?.trim()) {
      skipped += 1;
      logger.warn(`Skipping product without external_product_id (${row.name})`);
      continue;
    }

    if (!row.name?.trim()) {
      skipped += 1;
      logger.warn(`Skipping product with empty name for brand_domain=${row.brand_domain}`);
      continue;
    }

    upsertRows.push({
      brand_id: brandId,
      external_product_id: row.external_product_id.trim(),
      name: row.name.trim(),
      description: row.description ?? null,
      image_urls: row.image_urls ?? [],
      sizes: row.sizes ?? [],
      colors: row.colors ?? [],
      collection: row.collection ?? null,
      availability: row.availability ?? true,
      product_url: row.product_url ?? null,
      price_amount: row.price_amount ?? null,
      currency_code: (row.currency_code ?? 'USD').toUpperCase(),
      is_active: row.is_active ?? true,
    });
  }

  const BATCH_SIZE = 200;
  let upserted = 0;

  for (let i = 0; i < upsertRows.length; i += BATCH_SIZE) {
    const batch = upsertRows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('products').upsert(batch, {
      onConflict: 'brand_id,external_product_id',
      ignoreDuplicates: false,
    });

    if (error) {
      throw new Error(`Failed to upsert products batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
    }
    upserted += batch.length;
  }

  logger.info(`Product import complete. upserted=${upserted}, skipped=${skipped}`);
}

async function main(): Promise<void> {
  const fileArg = getArg('file');
  const filePath = fileArg
    ? path.resolve(process.cwd(), fileArg)
    : path.resolve(process.cwd(), 'config/catalog-import.template.json');

  logger.info(`Starting catalog import from ${filePath}`);

  const raw = await readFile(filePath, 'utf-8');
  const payload = JSON.parse(raw) as CatalogImportPayload;
  const brands = payload.brands ?? [];
  const products = payload.products ?? [];

  const brandIdByDomain = await upsertBrands(brands);

  if (products.length > 0) {
    await upsertProducts(products, brandIdByDomain);
  } else {
    logger.info('No products provided in import payload.');
  }

  logger.info(`Catalog import finished. brands=${brands.length}, products=${products.length}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  logger.error(`import:catalog failed: ${message}`);
  process.exit(1);
});
