import { trackProductEvent } from './interactions';
import { supabase } from './supabaseClient';

interface SaveProductInput {
  userId: string;
  brandId: string;
  productId: string;
}

interface UnsaveProductInput {
  userId: string;
  productId: string;
}

export async function fetchSavedProductIds(userId: string, productIds: string[]): Promise<string[]> {
  if (productIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('user_interactions')
    .select('product_id')
    .eq('user_id', userId)
    .eq('interaction_type', 'save')
    .in('product_id', productIds);

  if (error) {
    throw new Error(`Failed to fetch saved products: ${error.message}`);
  }

  return Array.from(new Set((data ?? []).map((row: { product_id: string }) => row.product_id)));
}

export async function isProductSaved(input: UnsaveProductInput): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_interactions')
    .select('id')
    .eq('user_id', input.userId)
    .eq('product_id', input.productId)
    .eq('interaction_type', 'save')
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch save state: ${error.message}`);
  }

  return (data ?? []).length > 0;
}

export async function saveProduct(input: SaveProductInput): Promise<void> {
  await trackProductEvent({
    event: 'product_save',
    userId: input.userId,
    brandId: input.brandId,
    productId: input.productId,
    metadata: {
      screen: 'product_details',
    },
  });
}

export async function unsaveProduct(input: UnsaveProductInput): Promise<void> {
  const { error } = await supabase
    .from('user_interactions')
    .delete()
    .eq('user_id', input.userId)
    .eq('product_id', input.productId)
    .eq('interaction_type', 'save');

  if (error) {
    throw new Error(`Failed to unsave product: ${error.message}`);
  }
}
