import { Product } from '../types';
import { supabase } from './supabaseClient';

interface FetchProductsByFollowedBrandsOptions {
  userId: string;
  limit?: number;
}

export interface ProductDetailsItem extends Product {
  brand_name: string;
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

  const { data: liveBrands, error: liveBrandsError } = await supabase
    .from('brands')
    .select('id')
    .in('id', brandIds)
    .eq('status', 'live');

  if (liveBrandsError) {
    throw new Error(`Failed to fetch live followed brands: ${liveBrandsError.message}`);
  }

  const liveBrandIds = (liveBrands ?? []).map((row: { id: string }) => row.id);
  if (liveBrandIds.length === 0) {
    return [];
  }

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('*')
    .in('brand_id', liveBrandIds)
    .eq('status', 'live')
    .eq('availability', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (productsError) {
    throw new Error(`Failed to fetch products by followed brands: ${productsError.message}`);
  }

  return (products ?? []) as Product[];
}

export async function fetchProductsByBrandId(brandId: string, limit = 50): Promise<Product[]> {
  const { data: brand, error: brandError } = await supabase
    .from('brands')
    .select('id')
    .eq('id', brandId)
    .eq('status', 'live')
    .maybeSingle();

  if (brandError) {
    throw new Error(`Failed to validate brand status: ${brandError.message}`);
  }

  if (!brand) {
    return [];
  }

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('brand_id', brandId)
    .eq('status', 'live')
    .eq('availability', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch products by brand: ${error.message}`);
  }

  return (data ?? []) as Product[];
}

export async function fetchProductDetailsById(productId: string): Promise<ProductDetailsItem> {
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .eq('status', 'live')
    .single();

  if (productError) {
    throw new Error(`Failed to fetch product details: ${productError.message}`);
  }

  const { data: brand, error: brandError } = await supabase
    .from('brands')
    .select('name')
    .eq('id', product.brand_id)
    .eq('status', 'live')
    .single();

  if (brandError) {
    throw new Error(`Failed to fetch brand details for product: ${brandError.message}`);
  }

  return {
    ...(product as Product),
    brand_name: brand.name,
  };
}
