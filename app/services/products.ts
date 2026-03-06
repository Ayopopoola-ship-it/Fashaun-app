import { Product } from '../types';
import { supabase } from './supabaseClient';

interface FetchProductsByFollowedBrandsOptions {
  userId: string;
  limit?: number;
}

export async function fetchProductsByFollowedBrands(
  options: FetchProductsByFollowedBrandsOptions
): Promise<Product[]> {
  const { userId, limit = 50 } = options;

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

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('*')
    .in('brand_id', brandIds)
    .eq('is_active', true)
    .eq('availability', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (productsError) {
    throw new Error(`Failed to fetch products by followed brands: ${productsError.message}`);
  }

  return (products ?? []) as Product[];
}
