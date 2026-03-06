import { Brand } from '../types';
import { supabase } from './supabaseClient';

interface FetchBrandsOptions {
  activeOnly?: boolean;
}

export async function fetchBrands(options: FetchBrandsOptions = {}): Promise<Brand[]> {
  const activeOnly = options.activeOnly ?? true;

  let query = supabase.from('brands').select('*').order('name', { ascending: true });

  if (activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch brands: ${error.message}`);
  }

  return (data ?? []) as Brand[];
}
