import { supabase } from './supabaseClient';

interface InteractionRow {
  id: string;
  product_id: string;
  brand_id: string;
  interaction_type: string;
  source: string | null;
  created_at: string;
}

interface ProductRow {
  id: string;
  name: string;
  image_urls: string[];
}

interface BrandRow {
  id: string;
  name: string;
}

export interface PurchaseHistoryItem {
  interactionId: string;
  productId: string;
  brandId: string;
  brandName: string;
  productName: string;
  productImageUrl: string | null;
  trackedAt: string;
  trackingLabel: 'Buy Click' | 'Buy Flow Opened';
}

export async function fetchPurchaseHistory(userId: string, limit = 50): Promise<PurchaseHistoryItem[]> {
  const { data: interactions, error: interactionsError } = await supabase
    .from('user_interactions')
    .select('id, product_id, brand_id, interaction_type, source, created_at')
    .eq('user_id', userId)
    .or('source.eq.buy_click,source.eq.buy_flow_opened,interaction_type.eq.purchase')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (interactionsError) {
    throw new Error(`Failed to fetch purchase history interactions: ${interactionsError.message}`);
  }

  const interactionRows = (interactions ?? []) as InteractionRow[];
  if (interactionRows.length === 0) {
    return [];
  }

  const productIds = Array.from(new Set(interactionRows.map((row) => row.product_id)));
  const brandIds = Array.from(new Set(interactionRows.map((row) => row.brand_id)));

  const [{ data: products, error: productsError }, { data: brands, error: brandsError }] =
    await Promise.all([
      supabase.from('products').select('id, name, image_urls').in('id', productIds).eq('status', 'live'),
      supabase.from('brands').select('id, name').in('id', brandIds).eq('status', 'live'),
    ]);

  if (productsError) {
    throw new Error(`Failed to fetch products for purchase history: ${productsError.message}`);
  }

  if (brandsError) {
    throw new Error(`Failed to fetch brands for purchase history: ${brandsError.message}`);
  }

  const productById = new Map<string, ProductRow>((products ?? []).map((row) => [row.id, row as ProductRow]));
  const brandById = new Map<string, BrandRow>((brands ?? []).map((row) => [row.id, row as BrandRow]));

  return interactionRows
    .map((row) => {
      const product = productById.get(row.product_id);
      const brand = brandById.get(row.brand_id);
      if (!product || !brand) {
        return null;
      }

      return {
        interactionId: row.id,
        productId: row.product_id,
        brandId: row.brand_id,
        brandName: brand.name,
        productName: product.name,
        productImageUrl: product.image_urls?.[0] ?? null,
        trackedAt: row.created_at,
        trackingLabel: row.source === 'buy_flow_opened' ? 'Buy Flow Opened' : 'Buy Click',
      } as PurchaseHistoryItem;
    })
    .filter((item): item is PurchaseHistoryItem => item !== null);
}
