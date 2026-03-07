import { logger } from './logger';

const SHOPIFY_PAGE_LIMIT = 250;
const SHOPIFY_TIMEOUT_MS = 15000;
const SHOPIFY_MAX_PAGES = 100;

export interface BrandRecord {
  id: string;
  name: string;
  domain: string;
}

export interface ShopifyVariant {
  id: number;
  price: string | null;
  available: boolean;
  option1: string | null;
  option2: string | null;
  option3: string | null;
}

export interface ShopifyOption {
  name: string;
  position: number;
  values: string[];
}

export interface ShopifyImage {
  src: string;
}

export interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  body_html: string | null;
  product_type: string | null;
  images: ShopifyImage[];
  image: ShopifyImage | null;
  options: ShopifyOption[];
  variants: ShopifyVariant[];
}

interface ShopifyProductsResponse {
  products: ShopifyProduct[];
}

export interface ProductUpsertRow {
  brand_id: string;
  external_product_id: string;
  name: string;
  description: string | null;
  image_urls: string[];
  sizes: string[];
  colors: string[];
  collection: string | null;
  availability: boolean;
  product_url: string;
  price_amount: number | null;
  currency_code: string;
  is_active: boolean;
}

function sanitizeDomain(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.+$/, '');
}

function stripHtml(html: string | null): string | null {
  if (!html) {
    return null;
  }

  const plain = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return plain.length > 0 ? plain : null;
}

function toUniqueValues(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    const cleaned = value.trim();
    if (!cleaned) {
      continue;
    }

    const key = cleaned.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(cleaned);
    }
  }

  return unique;
}

function parsePrice(variants: ShopifyVariant[]): number | null {
  const prices = variants
    .map((variant) => Number.parseFloat(variant.price ?? ''))
    .filter((price) => Number.isFinite(price));

  if (prices.length === 0) {
    return null;
  }

  const minPrice = Math.min(...prices);
  return Number(minPrice.toFixed(2));
}

function extractImages(product: ShopifyProduct): string[] {
  const urls: string[] = [];

  for (const image of product.images ?? []) {
    if (image?.src) {
      urls.push(image.src);
    }
  }

  if (product.image?.src) {
    urls.push(product.image.src);
  }

  return toUniqueValues(urls);
}

function extractSizeAndColorOptions(product: ShopifyProduct): { sizes: string[]; colors: string[] } {
  const sizes: string[] = [];
  const colors: string[] = [];

  const optionNameByPosition = new Map<number, string>();
  for (const option of product.options ?? []) {
    optionNameByPosition.set(option.position, option.name.toLowerCase());

    if (option.name.toLowerCase().includes('size')) {
      sizes.push(...option.values);
    }

    if (option.name.toLowerCase().includes('color') || option.name.toLowerCase().includes('colour')) {
      colors.push(...option.values);
    }
  }

  for (const variant of product.variants ?? []) {
    const variantValues: Array<[number, string | null]> = [
      [1, variant.option1],
      [2, variant.option2],
      [3, variant.option3],
    ];

    for (const [position, optionValue] of variantValues) {
      if (!optionValue) {
        continue;
      }

      const optionName = optionNameByPosition.get(position) ?? '';
      if (optionName.includes('size')) {
        sizes.push(optionValue);
      }
      if (optionName.includes('color') || optionName.includes('colour')) {
        colors.push(optionValue);
      }
    }
  }

  return {
    sizes: toUniqueValues(sizes),
    colors: toUniqueValues(colors),
  };
}

async function fetchShopifyPage(domain: string, page: number): Promise<ShopifyProduct[]> {
  const query = new URLSearchParams({
    limit: String(SHOPIFY_PAGE_LIMIT),
    page: String(page),
  });

  const endpoint = `https://${domain}/products.json?${query.toString()}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SHOPIFY_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as ShopifyProductsResponse;
    return Array.isArray(payload.products) ? payload.products : [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchAllShopifyProducts(domainInput: string): Promise<ShopifyProduct[]> {
  const domain = sanitizeDomain(domainInput);
  const allProducts: ShopifyProduct[] = [];
  let page = 1;
  let previousPageFirstId: number | null = null;

  while (true) {
    if (page > SHOPIFY_MAX_PAGES) {
      logger.warn(`Stopped Shopify pagination for ${domain} after ${SHOPIFY_MAX_PAGES} pages.`);
      break;
    }

    const productsPage = await fetchShopifyPage(domain, page);
    if (productsPage.length === 0) {
      break;
    }

    logger.info(`Fetched page ${page} from ${domain} (${productsPage.length} products)`);
    allProducts.push(...productsPage);

    const firstId = productsPage[0]?.id ?? null;
    if (previousPageFirstId !== null && firstId !== null && firstId === previousPageFirstId) {
      logger.warn(`Detected repeated Shopify page content for ${domain}; stopping pagination.`);
      break;
    }
    previousPageFirstId = firstId;

    if (productsPage.length < SHOPIFY_PAGE_LIMIT) {
      break;
    }
    page += 1;
  }

  return allProducts;
}

export function normalizeShopifyProduct(params: {
  brand: BrandRecord;
  product: ShopifyProduct;
  defaultCurrency: string;
}): ProductUpsertRow | null {
  const { brand, product, defaultCurrency } = params;

  if (!product.id || !product.title || !product.handle) {
    logger.warn(`Skipping invalid Shopify product for ${brand.name}: missing id/title/handle.`);
    return null;
  }

  const { sizes, colors } = extractSizeAndColorOptions(product);

  return {
    brand_id: brand.id,
    external_product_id: String(product.id),
    name: product.title.trim(),
    description: stripHtml(product.body_html),
    image_urls: extractImages(product),
    sizes,
    colors,
    collection: product.product_type?.trim() || null,
    availability: (product.variants ?? []).some((variant) => variant.available),
    product_url: `https://${sanitizeDomain(brand.domain)}/products/${product.handle}`,
    price_amount: parsePrice(product.variants ?? []),
    currency_code: defaultCurrency,
    is_active: true,
  };
}
