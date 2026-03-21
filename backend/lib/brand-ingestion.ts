import { captureIngestionEvent } from './ingestion-analytics';
import { logger } from './logger';
import { fetchAllShopifyProducts, ShopifyProduct } from './shopify';
import { classifyBrandSource, normalizeDomain, SourceType } from './source-classification';
import { supabase } from './supabase';

export type IngestionStatus = 'pending' | 'in_progress' | 'needs_review' | 'live' | 'failed';

export interface BrandIngestionRecord {
  id: string;
  name: string;
  domain: string;
  instagram_handle: string | null;
  source_type: SourceType;
  source_url: string | null;
  ingestion_status: IngestionStatus;
  confidence_score: number | null;
  is_verified: boolean;
  last_synced_at: string | null;
}

export interface IngestBrandProductsResult {
  brandId: string;
  sourceType: SourceType;
  ingestionStatus: IngestionStatus;
  productsProcessed: number;
  confidenceScore: number | null;
}

function stripHtml(html: string | null): string | null {
  if (!html) {
    return null;
  }

  const plain = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return plain.length > 0 ? plain : null;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function parsePrice(product: ShopifyProduct): number | null {
  const prices = (product.variants ?? [])
    .map((variant) => Number.parseFloat(variant.price ?? ''))
    .filter((value) => Number.isFinite(value));

  if (prices.length === 0) {
    return null;
  }

  return Number(Math.min(...prices).toFixed(2));
}

function extractImages(product: ShopifyProduct): string[] {
  return uniqueStrings([
    ...(product.images ?? []).map((image) => image?.src ?? ''),
    product.image?.src ?? '',
  ]);
}

function extractOptions(product: ShopifyProduct): { sizes: string[]; colors: string[]; variants: Record<string, unknown>[] } {
  const sizes: string[] = [];
  const colors: string[] = [];
  const optionNames = new Map<number, string>();

  for (const option of product.options ?? []) {
    optionNames.set(option.position, option.name.toLowerCase());

    if (option.name.toLowerCase().includes('size')) {
      sizes.push(...option.values);
    }

    if (option.name.toLowerCase().includes('color') || option.name.toLowerCase().includes('colour')) {
      colors.push(...option.values);
    }
  }

  const variants = (product.variants ?? []).map((variant) => {
    const variantOptions: Record<string, unknown> = {
      id: variant.id,
      price: variant.price,
      available: variant.available,
    };

    const values = [variant.option1, variant.option2, variant.option3];
    values.forEach((value, index) => {
      if (!value) {
        return;
      }

      const optionName = optionNames.get(index + 1) ?? `option_${index + 1}`;
      variantOptions[optionName] = value;

      if (optionName.includes('size')) {
        sizes.push(value);
      }

      if (optionName.includes('color') || optionName.includes('colour')) {
        colors.push(value);
      }
    });

    return variantOptions;
  });

  return {
    sizes: uniqueStrings(sizes),
    colors: uniqueStrings(colors),
    variants,
  };
}

function computeProductConfidence(product: {
  description: string | null;
  imageUrls: string[];
  priceAmount: number | null;
  productUrl: string;
  category: string | null;
  variants: Record<string, unknown>[];
}): number {
  let score = 0.65;

  if (product.description) {
    score += 0.08;
  }
  if (product.imageUrls.length > 0) {
    score += 0.08;
  }
  if (product.priceAmount !== null) {
    score += 0.07;
  }
  if (product.productUrl) {
    score += 0.05;
  }
  if (product.category) {
    score += 0.03;
  }
  if (product.variants.length > 0) {
    score += 0.04;
  }

  return Number(Math.min(score, 0.98).toFixed(3));
}

async function updateBrandState(brandId: string, values: Partial<BrandIngestionRecord>): Promise<void> {
  const { error } = await supabase.from('brands').update(values).eq('id', brandId);
  if (error) {
    throw new Error(`Failed to update brand state: ${error.message}`);
  }
}

async function fetchBrand(brandId: string): Promise<BrandIngestionRecord> {
  const { data, error } = await supabase.from('brands').select('*').eq('id', brandId).single();
  if (error) {
    throw new Error(`Failed to load brand for ingestion: ${error.message}`);
  }

  return data as BrandIngestionRecord;
}

export async function ingestBrandProducts(brandId: string): Promise<IngestBrandProductsResult> {
  const brand = await fetchBrand(brandId);
  const classification = await classifyBrandSource({
    websiteUrl: brand.source_url ?? `https://${normalizeDomain(brand.domain) ?? brand.domain}`,
    instagramUrl: brand.instagram_handle ? `https://instagram.com/${brand.instagram_handle}` : null,
  });

  await updateBrandState(brand.id, {
    source_type: classification.sourceType,
    source_url: classification.sourceUrl,
    confidence_score: classification.confidenceScore,
    ingestion_status: 'in_progress',
    last_synced_at: new Date().toISOString(),
  });

  logger.info(`Ingestion started for ${brand.name} (${brand.domain}) as ${classification.sourceType}`);
  await captureIngestionEvent({
    event: 'ingestion_started',
    distinctId: brand.id,
    properties: {
      brand_id: brand.id,
      brand_name: brand.name,
      source_type: classification.sourceType,
    },
  });

  if (classification.sourceType !== 'shopify') {
    await updateBrandState(brand.id, {
      source_type: classification.sourceType,
      source_url: classification.sourceUrl,
      confidence_score: classification.confidenceScore,
      ingestion_status: 'needs_review',
      last_synced_at: new Date().toISOString(),
    });

    return {
      brandId: brand.id,
      sourceType: classification.sourceType,
      ingestionStatus: 'needs_review',
      productsProcessed: 0,
      confidenceScore: classification.confidenceScore,
    };
  }

  try {
    const rawProducts = await fetchAllShopifyProducts(brand.domain);
    let processed = 0;
    let totalConfidence = 0;

    for (const rawProduct of rawProducts) {
      if (!rawProduct.id || !rawProduct.title || !rawProduct.handle) {
        continue;
      }

      const imageUrls = extractImages(rawProduct);
      const optionData = extractOptions(rawProduct);
      const description = stripHtml(rawProduct.body_html);
      const productUrl = `https://${normalizeDomain(brand.domain)}/products/${rawProduct.handle}`;
      const priceAmount = parsePrice(rawProduct);
      const category = rawProduct.product_type?.trim() || null;
      const confidenceScore = computeProductConfidence({
        description,
        imageUrls,
        priceAmount,
        productUrl,
        category,
        variants: optionData.variants,
      });

      const { data: rawSourceRow, error: rawSourceError } = await supabase
        .from('raw_source_records')
        .insert({
          brand_id: brand.id,
          source_type: 'shopify',
          source_url: productUrl,
          raw_payload: rawProduct,
        })
        .select('id')
        .single();

      if (rawSourceError) {
        throw new Error(`Failed to store raw source record: ${rawSourceError.message}`);
      }

      const { data: upsertedProduct, error: productError } = await supabase
        .from('products')
        .upsert(
          {
            brand_id: brand.id,
            external_product_id: String(rawProduct.id),
            title: rawProduct.title.trim(),
            name: rawProduct.title.trim(),
            description,
            image_urls: imageUrls,
            sizes: optionData.sizes,
            colors: optionData.colors,
            collection: category,
            category,
            variants: optionData.variants,
            availability: (rawProduct.variants ?? []).some((variant) => variant.available),
            product_url: productUrl,
            price_amount: priceAmount,
            currency_code: 'USD',
            source_type: 'shopify',
            confidence_score: confidenceScore,
            raw_source_id: rawSourceRow.id,
            is_active: true,
          },
          {
            onConflict: 'brand_id,external_product_id',
            ignoreDuplicates: false,
          }
        )
        .select('id')
        .single();

      if (productError) {
        throw new Error(`Failed to upsert product: ${productError.message}`);
      }

      const { error: rawUpdateError } = await supabase
        .from('raw_source_records')
        .update({ product_id: upsertedProduct.id })
        .eq('id', rawSourceRow.id);

      if (rawUpdateError) {
        throw new Error(`Failed to attach raw source record to product: ${rawUpdateError.message}`);
      }

      processed += 1;
      totalConfidence += confidenceScore;
    }

    const averageConfidence = processed > 0 ? Number((totalConfidence / processed).toFixed(3)) : classification.confidenceScore;
    const ingestionStatus: IngestionStatus = processed > 0 ? 'needs_review' : 'failed';

    await updateBrandState(brand.id, {
      source_type: 'shopify',
      source_url: classification.sourceUrl ?? `https://${brand.domain}`,
      confidence_score: averageConfidence,
      ingestion_status: ingestionStatus,
      last_synced_at: new Date().toISOString(),
    });

    await captureIngestionEvent({
      event: 'ingestion_succeeded',
      distinctId: brand.id,
      properties: {
        brand_id: brand.id,
        brand_name: brand.name,
        source_type: 'shopify',
        products_processed: processed,
        confidence_score: averageConfidence,
        ingestion_status: ingestionStatus,
      },
    });

    logger.info(`Ingestion finished for ${brand.name}: processed=${processed}, status=${ingestionStatus}`);

    return {
      brandId: brand.id,
      sourceType: 'shopify',
      ingestionStatus,
      productsProcessed: processed,
      confidenceScore: averageConfidence,
    };
  } catch (error: unknown) {
    await updateBrandState(brand.id, {
      source_type: classification.sourceType,
      source_url: classification.sourceUrl,
      confidence_score: classification.confidenceScore,
      ingestion_status: 'failed',
      last_synced_at: new Date().toISOString(),
    });

    await captureIngestionEvent({
      event: 'ingestion_failed',
      distinctId: brand.id,
      properties: {
        brand_id: brand.id,
        brand_name: brand.name,
        source_type: classification.sourceType,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    throw error;
  }
}

export async function loadIngestionCandidateBrands(domainFilters: string[] = []): Promise<BrandIngestionRecord[]> {
  let query = supabase
    .from('brands')
    .select('*')
    .in('source_type', ['shopify', 'generic_site', 'instagram', 'unknown'])
    .eq('is_active', true)
    .order('updated_at', { ascending: false });

  if (domainFilters.length > 0) {
    query = query.in('domain', domainFilters);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load ingestion candidate brands: ${error.message}`);
  }

  return (data ?? []) as BrandIngestionRecord[];
}
