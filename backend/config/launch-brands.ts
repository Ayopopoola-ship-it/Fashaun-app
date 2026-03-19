export type LaunchBrandSourceType = 'shopify' | 'unknown';

export interface LaunchBrandSeed {
  name: string;
  domain: string;
  active: boolean;
  source_type: LaunchBrandSourceType;
  logo_url?: string;
  category?: string;
  country?: string;
  external_store_link?: string;
}

// Edit this list to manage launch brands.
export const launchBrands: LaunchBrandSeed[] = [
  {
    name: 'Nike',
    domain: 'nike.com',
    active: true,
    source_type: 'unknown',
    category: 'Sportswear',
    country: 'USA',
    external_store_link: 'https://www.nike.com',
  },
  {
    name: 'Shopify Test Brand',
    domain: 'allbirds.com',
    active: true,
    source_type: 'shopify',
    category: 'Footwear',
    country: 'USA',
    external_store_link: 'https://www.allbirds.com',
  },
];
