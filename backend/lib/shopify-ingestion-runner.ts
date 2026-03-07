import { logger } from './logger';
import { supabase } from './supabase';
import {
  BrandRecord,
  ProductUpsertRow,
  fetchAllShopifyProducts,
  normalizeShopifyProduct,
} from './shopify';

const UPSERT_BATCH_SIZE = 100;
const UPDATE_CONCURRENCY = 20;

export interface ShopifyIngestionSummary {
  brandsProcessed: number;
  productsInserted: number;
  productsUpdated: number;
  failures: number;
}

interface ProductWriteCounts {
  inserted: number;
  updated: number;
}

async function updateProductsInParallel(products: Array<ProductUpsertRow & { id: string }>): Promise<number> {
  let updated = 0;

  for (let i = 0; i < products.length; i += UPDATE_CONCURRENCY) {
    const chunk = products.slice(i, i + UPDATE_CONCURRENCY);

    const results = await Promise.all(
      chunk.map(async (product) => {
        const { id, ...updatePayload } = product;
        const { error: updateError } = await supabase.from('products').update(updatePayload).eq('id', id);
        if (updateError) {
          throw new Error(`Product update failed: ${updateError.message}`);
        }
      })
    );

    void results;
    updated += chunk.length;
  }

  return updated;
}

function parseDomainFilters(argv: string[]): string[] {
  return argv
    .flatMap((arg) => arg.split(','))
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
}

async function loadBrands(domainFilters: string[]): Promise<BrandRecord[]> {
  let query = supabase
    .from('brands')
    .select('id, name, domain')
    .eq('source_type', 'shopify')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (domainFilters.length > 0) {
    query = query.in('domain', domainFilters);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load Shopify brands: ${error.message}`);
  }

  return (data ?? []) as BrandRecord[];
}

async function writeProducts(products: ProductUpsertRow[]): Promise<ProductWriteCounts> {
  if (products.length === 0) {
    return { inserted: 0, updated: 0 };
  }

  const brandId = products[0].brand_id;
  let inserted = 0;
  let updated = 0;

  for (let i = 0; i < products.length; i += UPSERT_BATCH_SIZE) {
    const batchNumber = Math.floor(i / UPSERT_BATCH_SIZE) + 1;
    const batch = products.slice(i, i + UPSERT_BATCH_SIZE);
    const externalIds = batch.map((item) => item.external_product_id);

    const { data: existingRows, error: existingRowsError } = await supabase
      .from('products')
      .select('id, external_product_id')
      .eq('brand_id', brandId)
      .in('external_product_id', externalIds);

    if (existingRowsError) {
      throw new Error(`Failed to query existing products: ${existingRowsError.message}`);
    }

    const existingByExternalId = new Map<string, string>();
    for (const row of existingRows ?? []) {
      if (row.external_product_id) {
        existingByExternalId.set(row.external_product_id, row.id);
      }
    }

    const toInsert: ProductUpsertRow[] = [];
    const toUpdate: Array<ProductUpsertRow & { id: string }> = [];

    for (const product of batch) {
      const existingId = existingByExternalId.get(product.external_product_id);
      if (existingId) {
        toUpdate.push({ ...product, id: existingId });
      } else {
        toInsert.push(product);
      }
    }

    if (toInsert.length > 0) {
      const { error: insertError } = await supabase.from('products').insert(toInsert);
      if (insertError) {
        throw new Error(`Product insert failed: ${insertError.message}`);
      }
      inserted += toInsert.length;
    }

    if (toUpdate.length > 0) {
      updated += await updateProductsInParallel(toUpdate);
    }

    logger.info(
      `Write batch ${batchNumber}: inserted=${toInsert.length}, updated=${toUpdate.length}, cumulative_inserted=${inserted}, cumulative_updated=${updated}`
    );
  }

  return { inserted, updated };
}

async function ingestBrand(brand: BrandRecord, defaultCurrency: string): Promise<ProductWriteCounts> {
  logger.info(`Ingesting Shopify catalog for ${brand.name} (${brand.domain})`);

  const rawProducts = await fetchAllShopifyProducts(brand.domain);
  logger.info(`Fetched ${rawProducts.length} products from ${brand.domain}`);

  const normalizedProducts = rawProducts
    .map((product) => normalizeShopifyProduct({ brand, product, defaultCurrency }))
    .filter((product): product is ProductUpsertRow => product !== null);

  if (normalizedProducts.length === 0) {
    logger.warn(`No valid products to write for ${brand.name}`);
    return { inserted: 0, updated: 0 };
  }

  const counts = await writeProducts(normalizedProducts);
  logger.info(
    `Brand completed ${brand.name}: inserted=${counts.inserted}, updated=${counts.updated}, total=${
      counts.inserted + counts.updated
    }`
  );

  return counts;
}

export async function runShopifyIngestionRunner(options?: {
  domains?: string[];
  currency?: string;
}): Promise<ShopifyIngestionSummary> {
  const domainFilters = options?.domains ?? [];
  const defaultCurrency = (options?.currency ?? process.env.SHOPIFY_DEFAULT_CURRENCY ?? 'USD').toUpperCase();

  logger.info(`Starting Shopify ingestion runner (currency=${defaultCurrency})`);
  if (domainFilters.length > 0) {
    logger.info(`Domain filter active: ${domainFilters.join(', ')}`);
  }

  const brands = await loadBrands(domainFilters);
  if (brands.length === 0) {
    logger.warn('No Shopify brands found for ingestion.');
    return { brandsProcessed: 0, productsInserted: 0, productsUpdated: 0, failures: 0 };
  }

  const summary: ShopifyIngestionSummary = {
    brandsProcessed: 0,
    productsInserted: 0,
    productsUpdated: 0,
    failures: 0,
  };

  for (const brand of brands) {
    summary.brandsProcessed += 1;

    try {
      const counts = await ingestBrand(brand, defaultCurrency);
      summary.productsInserted += counts.inserted;
      summary.productsUpdated += counts.updated;
      logger.info(`SUCCESS ${brand.name} (${brand.domain})`);
    } catch (error: unknown) {
      summary.failures += 1;
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`FAILURE ${brand.name} (${brand.domain}): ${message}`);
    }
  }

  logger.info(
    `Shopify ingestion summary: brands_processed=${summary.brandsProcessed}, products_inserted=${summary.productsInserted}, products_updated=${summary.productsUpdated}, failures=${summary.failures}`
  );

  return summary;
}

export function parseDomainArgs(argv: string[]): string[] {
  return parseDomainFilters(argv);
}
