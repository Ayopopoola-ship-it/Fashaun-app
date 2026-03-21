import { supabase } from './supabaseClient';

export interface HomeFeedItem {
  id: string;
  brand_id: string;
  brand_name: string;
  name: string;
  image_url: string | null;
  price_amount: number | null;
  currency_code: string;
  created_at: string;
}

interface FetchHomeFeedPageInput {
  userId: string;
  limit: number;
  offset: number;
}

export async function fetchHomeFeedPage(input: FetchHomeFeedPageInput): Promise<HomeFeedItem[]> {
  const { userId, limit, offset } = input;

  const { data: follows, error: followsError } = await supabase
    .from('user_brand_follows')
    .select('brand_id')
    .eq('user_id', userId);

  if (followsError) {
    throw new Error(`Failed to fetch followed brands: ${followsError.message}`);
  }

  const brandIds = (follows ?? []).map((row: { brand_id: string }) => row.brand_id);
  if (brandIds.length === 0) {
    return [];
  }

  const { data: liveBrands, error: liveBrandsError } = await supabase
    .from('brands')
    .select('id')
    .in('id', brandIds)
    .eq('status', 'live');

  if (liveBrandsError) {
    throw new Error(`Failed to fetch live brands for home feed: ${liveBrandsError.message}`);
  }

  const liveBrandIds = (liveBrands ?? []).map((row: { id: string }) => row.id);
  if (liveBrandIds.length === 0) {
    return [];
  }

  const rangeStart = offset;
  const rangeEnd = offset + limit - 1;

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, brand_id, name, image_urls, price_amount, currency_code, created_at')
    .in('brand_id', liveBrandIds)
    .eq('status', 'live')
    .eq('availability', true)
    .order('created_at', { ascending: false })
    .range(rangeStart, rangeEnd);

  if (productsError) {
    throw new Error(`Failed to fetch products for home feed: ${productsError.message}`);
  }

  if (!products || products.length === 0) {
    return [];
  }

  const uniqueBrandIds = Array.from(new Set(products.map((product) => product.brand_id)));
  const { data: brands, error: brandsError } = await supabase
    .from('brands')
    .select('id, name')
    .in('id', uniqueBrandIds);

  if (brandsError) {
    throw new Error(`Failed to fetch brand names for home feed: ${brandsError.message}`);
  }

  const brandNameById = new Map((brands ?? []).map((brand) => [brand.id, brand.name]));

  return products.map((product) => ({
    id: product.id,
    brand_id: product.brand_id,
    brand_name: brandNameById.get(product.brand_id) ?? 'Unknown Brand',
    name: product.name,
    image_url: product.image_urls?.[0] ?? null,
    price_amount: product.price_amount,
    currency_code: product.currency_code,
    created_at: product.created_at,
  }));
}
