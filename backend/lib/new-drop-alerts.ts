import { logger } from './logger';
import { supabase } from './supabase';

export type AlertType = 'new_product_drop';

interface ProductRow {
  id: string;
  brand_id: string;
  name: string;
  product_url: string | null;
  image_urls: string[];
  price_amount: number | null;
  currency_code: string;
  created_at: string;
}

interface BrandRow {
  id: string;
  name: string;
  domain: string;
}

interface FollowRow {
  user_id: string;
  brand_id: string;
}

export interface NewDropAlert {
  alertType: AlertType;
  userId: string;
  brandId: string;
  brandName: string;
  brandDomain: string;
  productId: string;
  productName: string;
  productUrl: string | null;
  productImageUrl: string | null;
  priceAmount: number | null;
  currencyCode: string;
  productCreatedAt: string;
}

export interface PrepareNewDropAlertsInput {
  sinceMinutes: number;
  domains?: string[];
  productLimit?: number;
}

export interface PrepareNewDropAlertsSummary {
  sinceIso: string;
  productsScanned: number;
  followerMatches: number;
  alertsPrepared: number;
}

export interface PrepareNewDropAlertsResult {
  summary: PrepareNewDropAlertsSummary;
  alerts: NewDropAlert[];
}

async function loadActiveBrands(domainFilters?: string[]): Promise<BrandRow[]> {
  let query = supabase
    .from('brands')
    .select('id, name, domain')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (domainFilters && domainFilters.length > 0) {
    query = query.in('domain', domainFilters);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load active brands: ${error.message}`);
  }

  return (data ?? []) as BrandRow[];
}

async function loadRecentProducts(sinceIso: string, productLimit: number): Promise<ProductRow[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id, brand_id, name, product_url, image_urls, price_amount, currency_code, created_at')
    .eq('is_active', true)
    .eq('availability', true)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(productLimit);

  if (error) {
    throw new Error(`Failed to load recent products: ${error.message}`);
  }

  return (data ?? []) as ProductRow[];
}

async function loadFollowsForBrands(brandIds: string[]): Promise<FollowRow[]> {
  if (brandIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('user_brand_follows')
    .select('user_id, brand_id')
    .in('brand_id', brandIds);

  if (error) {
    throw new Error(`Failed to load user follows: ${error.message}`);
  }

  return (data ?? []) as FollowRow[];
}

export async function prepareNewDropAlerts(
  input: PrepareNewDropAlertsInput
): Promise<PrepareNewDropAlertsResult> {
  const sinceMinutes = Number.isFinite(input.sinceMinutes) ? Math.max(1, Math.floor(input.sinceMinutes)) : 60;
  const productLimit = Number.isFinite(input.productLimit) ? Math.max(1, Math.floor(input.productLimit)) : 500;
  const sinceIso = new Date(Date.now() - sinceMinutes * 60_000).toISOString();
  const domainFilters = (input.domains ?? []).map((domain) => domain.trim().toLowerCase()).filter(Boolean);

  logger.info(
    `Preparing new drop alerts (since=${sinceIso}, product_limit=${productLimit}${
      domainFilters.length > 0 ? `, domains=${domainFilters.join(', ')}` : ''
    })`
  );

  const brands = await loadActiveBrands(domainFilters);
  if (brands.length === 0) {
    return {
      summary: { sinceIso, productsScanned: 0, followerMatches: 0, alertsPrepared: 0 },
      alerts: [],
    };
  }

  const brandById = new Map<string, BrandRow>(brands.map((brand) => [brand.id, brand]));
  const products = await loadRecentProducts(sinceIso, productLimit);
  const recentProducts = products.filter((product) => brandById.has(product.brand_id));

  if (recentProducts.length === 0) {
    return {
      summary: { sinceIso, productsScanned: 0, followerMatches: 0, alertsPrepared: 0 },
      alerts: [],
    };
  }

  const follows = await loadFollowsForBrands(Array.from(new Set(recentProducts.map((product) => product.brand_id))));
  const followsByBrand = new Map<string, FollowRow[]>();
  for (const follow of follows) {
    const existing = followsByBrand.get(follow.brand_id);
    if (existing) {
      existing.push(follow);
    } else {
      followsByBrand.set(follow.brand_id, [follow]);
    }
  }

  const alerts: NewDropAlert[] = [];
  let followerMatches = 0;

  for (const product of recentProducts) {
    const brand = brandById.get(product.brand_id);
    if (!brand) {
      continue;
    }

    const brandFollows = followsByBrand.get(product.brand_id) ?? [];
    followerMatches += brandFollows.length;

    for (const follow of brandFollows) {
      alerts.push({
        alertType: 'new_product_drop',
        userId: follow.user_id,
        brandId: brand.id,
        brandName: brand.name,
        brandDomain: brand.domain,
        productId: product.id,
        productName: product.name,
        productUrl: product.product_url,
        productImageUrl: product.image_urls?.[0] ?? null,
        priceAmount: product.price_amount,
        currencyCode: product.currency_code,
        productCreatedAt: product.created_at,
      });
    }
  }

  return {
    summary: {
      sinceIso,
      productsScanned: recentProducts.length,
      followerMatches,
      alertsPrepared: alerts.length,
    },
    alerts,
  };
}
