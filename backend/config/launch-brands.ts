export type LaunchBrandSourceType = 'shopify' | 'unknown';

export interface LaunchBrandSeed {
  name: string;
  domain: string;
  active: boolean;
  source_type: LaunchBrandSourceType;
}

// Edit this list to manage launch brands.
export const launchBrands: LaunchBrandSeed[] = [
  {
    name: 'Nike',
    domain: 'nike.com',
    active: true,
    source_type: 'unknown',
  },
  {
    name: 'Shopify Test Brand',
    domain: 'allbirds.com',
    active: true,
    source_type: 'shopify',
  },
];
