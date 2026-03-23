export type BrandSourceType = 'shopify' | 'generic_site' | 'instagram' | 'unknown';
export type IngestionStatus = 'pending' | 'in_progress' | 'needs_review' | 'live' | 'failed';
export type PublishStatus = 'draft' | 'live' | 'rejected';
export type DifficultyTag = 'easy' | 'medium' | 'hard' | 'unknown';
export type EstimatedOnboardingTime = '1_to_3_days' | '3_to_7_days' | '1_to_3_weeks' | 'unknown';
export type BrandRequestStatus = 'requested' | 'queued' | 'priority' | 'urgent' | 'live' | 'rejected';

export interface Brand {
  id: string;
  name: string;
  slug: string;
  domain: string;
  instagram_handle: string | null;
  source_type: BrandSourceType;
  source_url: string | null;
  ingestion_status: IngestionStatus;
  confidence_score: number | null;
  is_verified: boolean;
  last_synced_at: string | null;
  status: PublishStatus;
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
  title: string | null;
  name: string;
  description: string | null;
  image_urls: string[];
  sizes: string[];
  colors: string[];
  collection: string | null;
  category: string | null;
  variants: Array<Record<string, unknown>>;
  availability: boolean;
  product_url: string | null;
  price_amount: number | null;
  currency_code: string;
  source_type: BrandSourceType;
  confidence_score: number | null;
  raw_source_id: string | null;
  status: PublishStatus;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
