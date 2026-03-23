import type { Brand } from './types';
import { supabase } from './supabase';

export async function fetchBrandById(brandId: string): Promise<Brand> {
  const { data, error } = await supabase.from('brands').select('*').eq('id', brandId).single();

  if (error) {
    throw new Error(`Failed to fetch brand: ${error.message}`);
  }

  return data as Brand;
}
