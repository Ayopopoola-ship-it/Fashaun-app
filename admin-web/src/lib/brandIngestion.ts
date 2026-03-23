import { trackAnalyticsEvent } from './analytics';
import { fetchBrandById } from './brands';
import { classifyBrandSource, normalizeBrandName } from './brandRequestUtils';
import { supabase } from './supabase';
import type { Brand, BrandSourceType, IngestionStatus, Product } from './types';

const SHOPIFY_PAGE_LIMIT = 250;
const SHOPIFY_TIMEOUT_MS = 15000;
const SHOPIFY_MAX_PAGES = 30;
const GENERIC_SITE_TIMEOUT_MS = 12000;
const GENERIC_SITE_MAX_PRODUCTS = 12;

type AdminSourceKind = 'shopify' | 'generic_site' | 'unsupported';

interface ShopifyVariant {
  id: number;
  title?: string;
  price: string | null;
  available: boolean;
  option1: string | null;
  option2: string | null;
  option3: string | null;
}

interface ShopifyOption {
  name: string;
  position: number;
  values: string[];
}

interface ShopifyImage {
  src: string;
}

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  body_html: string | null;
  product_type: string | null;
  images: ShopifyImage[];
  image: ShopifyImage | null;
  options: ShopifyOption[];
  variants: ShopifyVariant[];
}

interface ShopifyProductsResponse {
  products: ShopifyProduct[];
}

interface GenericExtractedProduct {
  externalId: string;
  title: string;
  description: string | null;
  imageUrls: string[];
  productUrl: string;
  priceAmount: number | null;
  currencyCode: string;
  category: string | null;
  availability: boolean;
  rawPayload: Record<string, unknown>;
  confidenceScore: number;
}

export interface IngestBrandProductsResult {
  brandId: string;
  sourceType: BrandSourceType;
  ingestionStatus: IngestionStatus;
  productsProcessed: number;
  confidenceScore: number | null;
}

export interface AdminBrandImportResult {
  brand: Brand;
  sourceKind: AdminSourceKind;
  ingestion: IngestBrandProductsResult | null;
}

export interface AdminBrandReviewItem {
  brand: Brand;
  productCount: number;
  liveProductCount: number;
  draftProductCount: number;
}

export interface AdminReviewProduct extends Product {}

export interface AdminBrandReviewDetail {
  brand: Brand;
  products: AdminReviewProduct[];
}

export interface AdminBrandImportInput {
  name: string;
  websiteUrl?: string | null;
  instagramUrl?: string | null;
  category?: string | null;
  initiatedByUserId?: string | null;
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

function normalizeDomain(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '');
}

function slugify(input: string): string {
  return normalizeBrandName(input)
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'brand';
}

async function generateUniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  let suffix = 1;

  while (true) {
    const { data, error } = await supabase.from('brands').select('id').eq('slug', candidate).limit(1);
    if (error) {
      throw new Error(`Failed to validate brand slug: ${error.message}`);
    }
    if (!data || data.length === 0) {
      return candidate;
    }
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
}

function parseShopifyPrice(product: ShopifyProduct): number | null {
  const prices = (product.variants ?? [])
    .map((variant) => Number.parseFloat(variant.price ?? ''))
    .filter((value) => Number.isFinite(value));

  if (prices.length === 0) {
    return null;
  }

  return Number(Math.min(...prices).toFixed(2));
}

function extractShopifyImages(product: ShopifyProduct): string[] {
  const urls = [...(product.images ?? []).map((image) => image?.src ?? ''), product.image?.src ?? ''];
  return uniqueStrings(urls);
}

function extractShopifyOptions(product: ShopifyProduct): {
  sizes: string[];
  colors: string[];
  variants: Record<string, unknown>[];
} {
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
  sourceType: BrandSourceType;
}): number {
  let score = product.sourceType === 'shopify' ? 0.65 : 0.42;

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

  const max = product.sourceType === 'shopify' ? 0.98 : 0.82;
  return Number(Math.min(score, max).toFixed(3));
}

async function fetchHtml(url: string, timeoutMs = GENERIC_SITE_TIMEOUT_MS): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function extractMetaContent(html: string, selectors: string[]): string | null {
  for (const selector of selectors) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const propertyMatch = html.match(
      new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, 'i')
    );
    if (propertyMatch?.[1]) {
      return propertyMatch[1].trim();
    }

    const reversedMatch = html.match(
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, 'i')
    );
    if (reversedMatch?.[1]) {
      return reversedMatch[1].trim();
    }
  }

  return null;
}

function extractTitle(html: string): string | null {
  const ogTitle = extractMetaContent(html, ['og:title', 'twitter:title']);
  if (ogTitle) {
    return ogTitle;
  }

  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  return titleMatch?.[1]?.trim() ?? null;
}

function extractAbsoluteLinks(html: string, baseUrl: string): string[] {
  const links = new Set<string>();
  const hrefPattern = /href=["']([^"'#]+)["']/gi;

  let match: RegExpExecArray | null = hrefPattern.exec(html);
  while (match) {
    try {
      const absolute = new URL(match[1], baseUrl);
      const pathname = absolute.pathname.toLowerCase();
      if (
        (pathname.includes('/product') || pathname.includes('/products/')) &&
        absolute.hostname === new URL(baseUrl).hostname
      ) {
        links.add(absolute.toString());
      }
    } catch {
      // ignore malformed links
    }
    match = hrefPattern.exec(html);
  }

  return Array.from(links).slice(0, GENERIC_SITE_MAX_PRODUCTS);
}

function parseMaybePrice(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const numeric = Number.parseFloat(value.replace(/[^0-9.]/g, ''));
  return Number.isFinite(numeric) ? Number(numeric.toFixed(2)) : null;
}

function extractCurrency(html: string): string {
  const metaCurrency =
    extractMetaContent(html, ['product:price:currency']) ??
    html.match(/"priceCurrency"\s*:\s*"([A-Z]{3})"/i)?.[1] ??
    'USD';

  return metaCurrency.toUpperCase().slice(0, 3);
}

async function fetchGenericSiteProducts(sourceUrl: string): Promise<GenericExtractedProduct[]> {
  const normalized = sourceUrl.startsWith('http') ? sourceUrl : `https://${normalizeDomain(sourceUrl)}`;
  const candidateUrls = [
    normalized,
    new URL('/collections/all', normalized).toString(),
    new URL('/shop', normalized).toString(),
    new URL('/collections', normalized).toString(),
  ];

  let productLinks: string[] = [];

  for (const candidate of candidateUrls) {
    try {
      const html = await fetchHtml(candidate, 8000);
      const links = extractAbsoluteLinks(html, candidate);
      if (links.length > 0) {
        productLinks = links;
        break;
      }
    } catch {
      // try next candidate
    }
  }

  const products: GenericExtractedProduct[] = [];
  for (const productUrl of productLinks.slice(0, GENERIC_SITE_MAX_PRODUCTS)) {
    try {
      const html = await fetchHtml(productUrl, 8000);
      const title = extractTitle(html);
      if (!title) {
        continue;
      }

      const image = extractMetaContent(html, ['og:image', 'twitter:image']);
      const description =
        extractMetaContent(html, ['description', 'og:description', 'twitter:description']) ?? null;
      const price =
        extractMetaContent(html, ['product:price:amount']) ??
        html.match(/"price"\s*:\s*"([^"]+)"/i)?.[1] ??
        null;
      const category =
        extractMetaContent(html, ['product:category']) ??
        html.match(/"category"\s*:\s*"([^"]+)"/i)?.[1] ??
        null;

      const product: GenericExtractedProduct = {
        externalId: productUrl,
        title,
        description,
        imageUrls: image ? [image] : [],
        productUrl,
        priceAmount: parseMaybePrice(price),
        currencyCode: extractCurrency(html),
        category,
        availability: !html.toLowerCase().includes('sold out'),
        rawPayload: {
          productUrl,
          html: html.slice(0, 20000),
        },
        confidenceScore: computeProductConfidence({
          description,
          imageUrls: image ? [image] : [],
          priceAmount: parseMaybePrice(price),
          productUrl,
          category,
          variants: [],
          sourceType: 'generic_site',
        }),
      };

      products.push(product);
    } catch {
      // ignore individual product failures in MVP generic crawl
    }
  }

  return products;
}

async function fetchShopifyPage(domain: string, page: number): Promise<ShopifyProduct[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SHOPIFY_TIMEOUT_MS);

  try {
    const query = new URLSearchParams({
      limit: String(SHOPIFY_PAGE_LIMIT),
      page: String(page),
    });

    const response = await fetch(`https://${domain}/products.json?${query.toString()}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as ShopifyProductsResponse;
    return Array.isArray(payload.products) ? payload.products : [];
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchAllShopifyProducts(domainInput: string): Promise<ShopifyProduct[]> {
  const domain = normalizeDomain(domainInput);
  const allProducts: ShopifyProduct[] = [];

  for (let page = 1; page <= SHOPIFY_MAX_PAGES; page += 1) {
    const pageProducts = await fetchShopifyPage(domain, page);
    if (pageProducts.length === 0) {
      break;
    }

    allProducts.push(...pageProducts);

    if (pageProducts.length < SHOPIFY_PAGE_LIMIT) {
      break;
    }
  }

  return allProducts;
}

async function updateBrandRecord(brandId: string, values: Partial<Brand>): Promise<void> {
  const { error } = await supabase.from('brands').update(values).eq('id', brandId);
  if (error) {
    throw new Error(`Failed to update brand: ${error.message}`);
  }
}

async function updateProductRows(brandId: string, values: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from('products').update(values).eq('brand_id', brandId);
  if (error) {
    throw new Error(`Failed to update products for brand: ${error.message}`);
  }
}

async function findExistingBrandForImport(input: {
  name: string;
  domain?: string | null;
  instagramHandle?: string | null;
}): Promise<Brand | null> {
  if (input.domain) {
    const { data, error } = await supabase.from('brands').select('*').eq('domain', input.domain).limit(1);
    if (error) {
      throw new Error(`Failed to look up existing brand by domain: ${error.message}`);
    }
    if (data?.[0]) {
      return data[0] as Brand;
    }
  }

  if (input.instagramHandle) {
    const { data, error } = await supabase
      .from('brands')
      .select('*')
      .eq('instagram_handle', input.instagramHandle)
      .limit(1);
    if (error) {
      throw new Error(`Failed to look up existing brand by Instagram: ${error.message}`);
    }
    if (data?.[0]) {
      return data[0] as Brand;
    }
  }

  const { data, error } = await supabase.from('brands').select('*').ilike('name', input.name.trim()).limit(1);
  if (error) {
    throw new Error(`Failed to look up existing brand by name: ${error.message}`);
  }

  return (data?.[0] as Brand | undefined) ?? null;
}

function mapAdminSourceKind(sourceType: BrandSourceType): AdminSourceKind {
  if (sourceType === 'shopify') {
    return 'shopify';
  }

  if (sourceType === 'generic_site') {
    return 'generic_site';
  }

  return 'unsupported';
}

async function linkRelatedRequestsIfLive(brand: Brand): Promise<void> {
  if (brand.status !== 'live') {
    return;
  }

  const normalizedName = normalizeBrandName(brand.name);
  const { data: requests, error: requestError } = await supabase
    .from('brand_requests')
    .select('id, status')
    .or(
      [
        `normalized_name.eq.${normalizedName}`,
        brand.domain ? `normalized_domain.eq.${brand.domain}` : '',
        brand.instagram_handle ? `normalized_instagram_handle.eq.${brand.instagram_handle}` : '',
      ]
        .filter(Boolean)
        .join(',')
    );

  if (requestError) {
    throw new Error(`Failed to link live brand requests: ${requestError.message}`);
  }

  for (const request of requests ?? []) {
    const wasLive = request.status === 'live';
    const { error } = await supabase
      .from('brand_requests')
      .update({
        linked_brand_id: brand.id,
        status: 'live',
      })
      .eq('id', request.id);

    if (error) {
      throw new Error(`Failed to mark related request live: ${error.message}`);
    }

    if (!wasLive) {
      trackAnalyticsEvent('requested_brand_went_live', {
        brand_id: brand.id,
        request_id: request.id,
      });
    }
  }
}

async function classifyAdminImportSource(input: {
  websiteUrl?: string | null;
  instagramUrl?: string | null;
}): Promise<{
  sourceType: BrandSourceType;
  sourceKind: AdminSourceKind;
  sourceUrl: string | null;
  confidenceScore: number;
  normalizedDomain: string | null;
  instagramHandle: string | null;
}> {
  const result = await classifyBrandSource(input);
  return {
    sourceType: result.sourceType,
    sourceKind: mapAdminSourceKind(result.sourceType),
    sourceUrl: result.sourceUrl,
    confidenceScore: result.confidenceScore,
    normalizedDomain: result.normalizedDomain,
    instagramHandle: result.instagramHandle,
  };
}

export async function createAdminBrandImport(input: AdminBrandImportInput): Promise<AdminBrandImportResult> {
  const trimmedName = input.name.trim();
  if (!trimmedName) {
    throw new Error('Brand name is required.');
  }

  const classification = await classifyAdminImportSource({
    websiteUrl: input.websiteUrl,
    instagramUrl: input.instagramUrl,
  });

  const existing = await findExistingBrandForImport({
    name: trimmedName,
    domain: classification.normalizedDomain,
    instagramHandle: classification.instagramHandle,
  });

  let brand: Brand;

  if (existing) {
    const nextValues: Partial<Brand> = {
      name: trimmedName,
      domain: classification.normalizedDomain ?? existing.domain,
      instagram_handle: classification.instagramHandle ?? existing.instagram_handle,
      source_type: classification.sourceType,
      source_url: classification.sourceUrl ?? existing.source_url,
      confidence_score: classification.confidenceScore,
      ingestion_status: classification.sourceKind === 'unsupported' ? 'needs_review' : 'pending',
      category: input.category?.trim() || existing.category,
      external_store_link: input.websiteUrl?.trim() || existing.external_store_link,
      status: existing.status ?? 'draft',
      is_verified: existing.is_verified ?? false,
    };

    await updateBrandRecord(existing.id, nextValues);
    brand = await fetchBrandById(existing.id);
  } else {
    const slug = await generateUniqueSlug(trimmedName);
    const insertPayload = {
      name: trimmedName,
      slug,
      domain: classification.normalizedDomain ?? `${slug}.unsupported`,
      instagram_handle: classification.instagramHandle,
      source_type: classification.sourceType,
      source_url: classification.sourceUrl,
      confidence_score: classification.confidenceScore,
      ingestion_status: classification.sourceKind === 'unsupported' ? 'needs_review' : 'pending',
      status: 'draft',
      is_verified: false,
      category: input.category?.trim() || null,
      external_store_link: input.websiteUrl?.trim() || classification.sourceUrl,
      is_active: false,
    };

    const { data, error } = await supabase.from('brands').insert(insertPayload).select('*').single();
    if (error) {
      throw new Error(`Failed to create import brand: ${error.message}`);
    }
    brand = data as Brand;
  }

  if (classification.sourceKind === 'unsupported') {
    return {
      brand,
      sourceKind: 'unsupported',
      ingestion: null,
    };
  }

  const ingestion = await ingestBrandProducts({
    brandId: brand.id,
    initiatedByUserId: input.initiatedByUserId ?? null,
  });

  return {
    brand: await fetchBrandById(brand.id),
    sourceKind: classification.sourceKind,
    ingestion,
  };
}

export async function ingestBrandProducts(input: {
  brandId: string;
  initiatedByUserId?: string | null;
}): Promise<IngestBrandProductsResult> {
  const brand = await fetchBrandById(input.brandId);
  const classification = await classifyAdminImportSource({
    websiteUrl: brand.source_url ?? brand.external_store_link ?? brand.domain,
    instagramUrl: brand.instagram_handle ? `https://instagram.com/${brand.instagram_handle}` : null,
  });

  await updateBrandRecord(brand.id, {
    source_type: classification.sourceType,
    source_url: classification.sourceUrl,
    confidence_score: classification.confidenceScore,
    ingestion_status: 'in_progress',
    last_synced_at: new Date().toISOString(),
    status: brand.status ?? 'draft',
  });

  trackAnalyticsEvent('ingestion_started', {
    brand_id: brand.id,
    initiated_by_user_id: input.initiatedByUserId ?? null,
    source_type: classification.sourceType,
  });

  if (classification.sourceKind === 'unsupported') {
    await updateBrandRecord(brand.id, {
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
    let processed = 0;
    let totalConfidence = 0;

    if (classification.sourceKind === 'shopify') {
      const rawProducts = await fetchAllShopifyProducts(brand.domain);

      for (const rawProduct of rawProducts) {
        if (!rawProduct.id || !rawProduct.title || !rawProduct.handle) {
          continue;
        }

        const imageUrls = extractShopifyImages(rawProduct);
        const optionData = extractShopifyOptions(rawProduct);
        const description = stripHtml(rawProduct.body_html);
        const productUrl = `https://${normalizeDomain(brand.domain)}/products/${rawProduct.handle}`;
        const priceAmount = parseShopifyPrice(rawProduct);
        const category = rawProduct.product_type?.trim() || null;
        const confidenceScore = computeProductConfidence({
          description,
          imageUrls,
          priceAmount,
          productUrl,
          category,
          variants: optionData.variants,
          sourceType: 'shopify',
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
          throw new Error(`Failed to store raw source payload: ${rawSourceError.message}`);
        }

        const { data: upsertedProduct, error: upsertError } = await supabase
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
              status: 'draft',
              is_active: false,
            },
            {
              onConflict: 'brand_id,external_product_id',
              ignoreDuplicates: false,
            }
          )
          .select('id')
          .single();

        if (upsertError) {
          throw new Error(`Failed to upsert Shopify product: ${upsertError.message}`);
        }

        await supabase.from('raw_source_records').update({ product_id: upsertedProduct.id }).eq('id', rawSourceRow.id);

        processed += 1;
        totalConfidence += confidenceScore;
      }
    } else {
      const genericProducts = await fetchGenericSiteProducts(
        classification.sourceUrl ?? brand.external_store_link ?? `https://${brand.domain}`
      );

      for (const extracted of genericProducts) {
        const { data: rawSourceRow, error: rawSourceError } = await supabase
          .from('raw_source_records')
          .insert({
            brand_id: brand.id,
            source_type: 'generic_site',
            source_url: extracted.productUrl,
            raw_payload: extracted.rawPayload,
          })
          .select('id')
          .single();

        if (rawSourceError) {
          throw new Error(`Failed to store raw generic payload: ${rawSourceError.message}`);
        }

        const { data: upsertedProduct, error: upsertError } = await supabase
          .from('products')
          .upsert(
            {
              brand_id: brand.id,
              external_product_id: extracted.externalId,
              title: extracted.title,
              name: extracted.title,
              description: extracted.description,
              image_urls: extracted.imageUrls,
              sizes: [],
              colors: [],
              collection: extracted.category,
              category: extracted.category,
              variants: [],
              availability: extracted.availability,
              product_url: extracted.productUrl,
              price_amount: extracted.priceAmount,
              currency_code: extracted.currencyCode,
              source_type: 'generic_site',
              confidence_score: extracted.confidenceScore,
              raw_source_id: rawSourceRow.id,
              status: 'draft',
              is_active: false,
            },
            {
              onConflict: 'brand_id,external_product_id',
              ignoreDuplicates: false,
            }
          )
          .select('id')
          .single();

        if (upsertError) {
          throw new Error(`Failed to upsert generic-site product: ${upsertError.message}`);
        }

        await supabase.from('raw_source_records').update({ product_id: upsertedProduct.id }).eq('id', rawSourceRow.id);

        processed += 1;
        totalConfidence += extracted.confidenceScore;
      }
    }

    const averageConfidence =
      processed > 0 ? Number((totalConfidence / processed).toFixed(3)) : classification.confidenceScore;
    const ingestionStatus: IngestionStatus = processed > 0 ? 'needs_review' : 'failed';

    await updateBrandRecord(brand.id, {
      source_type: classification.sourceType,
      source_url: classification.sourceUrl ?? `https://${brand.domain}`,
      confidence_score: averageConfidence,
      ingestion_status: ingestionStatus,
      last_synced_at: new Date().toISOString(),
      status: 'draft',
      is_active: false,
    });

    trackAnalyticsEvent('ingestion_succeeded', {
      brand_id: brand.id,
      initiated_by_user_id: input.initiatedByUserId ?? null,
      source_type: classification.sourceType,
      products_processed: processed,
      confidence_score: averageConfidence,
      ingestion_status: ingestionStatus,
    });

    return {
      brandId: brand.id,
      sourceType: classification.sourceType,
      ingestionStatus,
      productsProcessed: processed,
      confidenceScore: averageConfidence,
    };
  } catch (error: unknown) {
    await updateBrandRecord(brand.id, {
      source_type: classification.sourceType,
      source_url: classification.sourceUrl,
      confidence_score: classification.confidenceScore,
      ingestion_status: 'failed',
      last_synced_at: new Date().toISOString(),
      status: 'draft',
      is_active: false,
    });

    trackAnalyticsEvent('ingestion_failed', {
      brand_id: brand.id,
      initiated_by_user_id: input.initiatedByUserId ?? null,
      source_type: classification.sourceType,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw error;
  }
}

export async function fetchAdminBrandReviewItems(): Promise<AdminBrandReviewItem[]> {
  const { data, error } = await supabase.from('brands').select('*').order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch admin brand review items: ${error.message}`);
  }

  const brands = (data ?? []) as Brand[];

  const items = await Promise.all(
    brands.map(async (brand) => {
      const { data: products, error: productError } = await supabase
        .from('products')
        .select('id, status')
        .eq('brand_id', brand.id);

      if (productError) {
        throw new Error(`Failed to fetch products for ${brand.name}: ${productError.message}`);
      }

      const rows = products ?? [];

      return {
        brand,
        productCount: rows.length,
        liveProductCount: rows.filter((row) => row.status === 'live').length,
        draftProductCount: rows.filter((row) => row.status === 'draft').length,
      };
    })
  );

  return items;
}

export async function fetchAdminBrandReviewDetail(brandId: string): Promise<AdminBrandReviewDetail> {
  const brand = await fetchBrandById(brandId);

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('brand_id', brandId)
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch brand review detail: ${error.message}`);
  }

  return {
    brand,
    products: (data ?? []) as AdminReviewProduct[],
  };
}

export async function updateAdminBrand(
  brandId: string,
  input: {
    name: string;
    domain: string;
    instagramHandle?: string | null;
    category?: string | null;
    sourceUrl?: string | null;
  }
): Promise<Brand> {
  const values: Partial<Brand> = {
    name: input.name.trim(),
    domain: normalizeDomain(input.domain),
    instagram_handle: input.instagramHandle?.trim().replace(/^@/, '').toLowerCase() || null,
    category: input.category?.trim() || null,
    source_url: input.sourceUrl?.trim() || null,
  };

  await updateBrandRecord(brandId, values);
  return fetchBrandById(brandId);
}

export async function approveBrandIngestion(brandId: string): Promise<void> {
  await updateBrandRecord(brandId, {
    is_verified: true,
    ingestion_status: 'needs_review',
    status: 'draft',
    is_active: false,
  });
}

export async function rejectBrandIngestion(brandId: string): Promise<void> {
  await updateBrandRecord(brandId, {
    is_active: false,
    status: 'rejected',
    ingestion_status: 'failed',
    is_verified: false,
  });

  await updateProductRows(brandId, {
    status: 'rejected',
    is_active: false,
  });
}

export async function publishProduct(productId: string): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({
      status: 'live',
      is_active: true,
    })
    .eq('id', productId);

  if (error) {
    throw new Error(`Failed to publish product: ${error.message}`);
  }
}

export async function rejectProduct(productId: string): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({
      status: 'rejected',
      is_active: false,
    })
    .eq('id', productId);

  if (error) {
    throw new Error(`Failed to reject product: ${error.message}`);
  }
}

export async function updateAdminProduct(
  productId: string,
  input: {
    name: string;
    priceAmount: number | null;
    productUrl?: string | null;
    category?: string | null;
  }
): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({
      name: input.name.trim(),
      title: input.name.trim(),
      price_amount: input.priceAmount,
      product_url: input.productUrl?.trim() || null,
      category: input.category?.trim() || null,
      collection: input.category?.trim() || null,
    })
    .eq('id', productId);

  if (error) {
    throw new Error(`Failed to update product: ${error.message}`);
  }
}

export async function publishAllBrandProducts(brandId: string): Promise<void> {
  await updateProductRows(brandId, {
    status: 'live',
    is_active: true,
  });
}

export async function markBrandLive(brandId: string): Promise<void> {
  await updateBrandRecord(brandId, {
    status: 'live',
    is_active: true,
    is_verified: true,
    ingestion_status: 'live',
  });

  const brand = await fetchBrandById(brandId);
  await linkRelatedRequestsIfLive(brand);
}

export async function publishBrandAndProducts(brandId: string): Promise<void> {
  await publishAllBrandProducts(brandId);
  await markBrandLive(brandId);
}
