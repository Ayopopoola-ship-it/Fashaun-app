import { Brand } from '../types';
import { supabase } from './supabaseClient';

export interface SavedProductItem {
  productId: string;
  brandId: string;
  brandName: string;
  productName: string;
  productImageUrl: string | null;
  productUrl: string | null;
  priceAmount: number | null;
  currencyCode: string;
  savedAt: string;
}

export interface SavedBrandItem {
  brandId: string;
  brandName: string;
  domain: string;
  followedAt: string;
}

interface SavedInteractionRow {
  product_id: string;
  brand_id: string;
  created_at: string;
}

export async function fetchSavedProducts(userId: string): Promise<SavedProductItem[]> {
  const { data: interactions, error: interactionsError } = await supabase
    .from('user_interactions')
    .select('product_id, brand_id, created_at')
    .eq('user_id', userId)
    .eq('interaction_type', 'save')
    .order('created_at', { ascending: false });

  if (interactionsError) {
    throw new Error(`Failed to fetch saved products: ${interactionsError.message}`);
  }

  const rows = (interactions ?? []) as SavedInteractionRow[];
  if (rows.length === 0) {
    return [];
  }

  // Keep latest save event per product.
  const latestByProductId = new Map<string, SavedInteractionRow>();
  for (const row of rows) {
    if (!latestByProductId.has(row.product_id)) {
      latestByProductId.set(row.product_id, row);
    }
  }

  const dedupedRows = Array.from(latestByProductId.values());
  const productIds = dedupedRows.map((row) => row.product_id);
  const brandIds = Array.from(new Set(dedupedRows.map((row) => row.brand_id)));

  const [{ data: products, error: productsError }, { data: brands, error: brandsError }] =
    await Promise.all([
      supabase
        .from('products')
        .select('id, name, image_urls, product_url, price_amount, currency_code')
        .in('id', productIds),
      supabase.from('brands').select('id, name').in('id', brandIds),
    ]);

  if (productsError) {
    throw new Error(`Failed to fetch products for saved list: ${productsError.message}`);
  }

  if (brandsError) {
    throw new Error(`Failed to fetch brands for saved list: ${brandsError.message}`);
  }

  const productById = new Map(
    (products ?? []).map((product) => [product.id, product])
  );
  const brandNameById = new Map(
    (brands ?? []).map((brand) => [brand.id, brand.name])
  );

  return dedupedRows
    .map((row) => {
      const product = productById.get(row.product_id);
      if (!product) {
        return null;
      }

      return {
        productId: row.product_id,
        brandId: row.brand_id,
        brandName: brandNameById.get(row.brand_id) ?? 'Unknown Brand',
        productName: product.name,
        productImageUrl: product.image_urls?.[0] ?? null,
        productUrl: product.product_url ?? null,
        priceAmount: product.price_amount,
        currencyCode: product.currency_code,
        savedAt: row.created_at,
      } as SavedProductItem;
    })
    .filter((item): item is SavedProductItem => item !== null);
}

export async function fetchSavedBrands(userId: string): Promise<SavedBrandItem[]> {
  const { data: follows, error: followsError } = await supabase
    .from('user_brand_follows')
    .select('brand_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (followsError) {
    throw new Error(`Failed to fetch saved brands: ${followsError.message}`);
  }

  const followRows = (follows ?? []) as Array<{ brand_id: string; created_at: string }>;
  if (followRows.length === 0) {
    return [];
  }

  const brandIds = Array.from(new Set(followRows.map((row) => row.brand_id)));
  const { data: brands, error: brandsError } = await supabase
    .from('brands')
    .select('*')
    .in('id', brandIds);

  if (brandsError) {
    throw new Error(`Failed to fetch brand metadata: ${brandsError.message}`);
  }

  const brandById = new Map<string, Brand>((brands ?? []).map((brand) => [brand.id, brand as Brand]));

  return followRows
    .map((row) => {
      const brand = brandById.get(row.brand_id);
      if (!brand) {
        return null;
      }

      return {
        brandId: brand.id,
        brandName: brand.name,
        domain: brand.domain,
        followedAt: row.created_at,
      } as SavedBrandItem;
    })
    .filter((item): item is SavedBrandItem => item !== null);
}
