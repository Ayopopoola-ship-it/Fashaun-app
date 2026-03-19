export type BrandSourceType = 'shopify' | 'unknown';

export interface Brand {
  id: string;
  name: string;
  slug: string;
  domain: string;
  source_type: BrandSourceType;
  description: string | null;
  logo_url: string | null;
  category: string | null;
  country: string | null;
  external_store_link: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  brand_id: string;
  external_product_id: string | null;
  name: string;
  description: string | null;
  image_urls: string[];
  sizes: string[];
  colors: string[];
  collection: string | null;
  availability: boolean;
  product_url: string | null;
  price_amount: number | null;
  currency_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserBrandFollow {
  id: string;
  user_id: string;
  brand_id: string;
  created_at: string;
}

export type InteractionType = 'view' | 'click' | 'save' | 'purchase';

export interface UserInteraction {
  id: string;
  user_id: string;
  brand_id: string;
  product_id: string;
  interaction_type: InteractionType;
  source: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type PurchaseStatus = 'pending' | 'confirmed' | 'cancelled' | 'refunded';

export interface Purchase {
  id: string;
  user_id: string;
  brand_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  currency_code: string;
  status: PurchaseStatus;
  return_session_id: string | null;
  purchased_at: string;
  created_at: string;
  updated_at: string;
}
