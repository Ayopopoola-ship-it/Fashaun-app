export type SourceType = 'shopify' | 'generic_site' | 'instagram' | 'unknown';

export interface SourceClassificationResult {
  sourceType: SourceType;
  sourceUrl: string | null;
  normalizedDomain: string | null;
  instagramHandle: string | null;
  confidenceScore: number;
}

export function normalizeDomain(input: string): string | null {
  const raw = input.trim();
  if (!raw) {
    return null;
  }

  const candidate = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;

  try {
    const url = new URL(candidate);
    return url.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return raw.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '') || null;
  }
}

export function normalizeInstagramHandle(input?: string | null): string | null {
  if (!input) {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const direct = trimmed.replace(/^@/, '');
  if (!direct.includes('/')) {
    return direct.toLowerCase();
  }

  const match = trimmed.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  return match?.[1]?.toLowerCase() ?? null;
}

export async function classifyBrandSource(input: {
  websiteUrl?: string | null;
  instagramUrl?: string | null;
}): Promise<SourceClassificationResult> {
  const instagramHandle = normalizeInstagramHandle(input.instagramUrl);
  if (instagramHandle) {
    return {
      sourceType: 'instagram',
      sourceUrl: input.instagramUrl?.trim() ?? `https://instagram.com/${instagramHandle}`,
      normalizedDomain: null,
      instagramHandle,
      confidenceScore: 0.97,
    };
  }

  const normalizedDomain = normalizeDomain(input.websiteUrl ?? '');
  if (!normalizedDomain) {
    return {
      sourceType: 'unknown',
      sourceUrl: null,
      normalizedDomain: null,
      instagramHandle: null,
      confidenceScore: 0.2,
    };
  }

  const sourceUrl = input.websiteUrl?.trim().startsWith('http')
    ? input.websiteUrl.trim()
    : `https://${normalizedDomain}`;

  if (normalizedDomain.includes('myshopify.com')) {
    return {
      sourceType: 'shopify',
      sourceUrl,
      normalizedDomain,
      instagramHandle: null,
      confidenceScore: 0.96,
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);

    const [homeResponse, productsResponse] = await Promise.allSettled([
      fetch(sourceUrl, { signal: controller.signal }),
      fetch(`https://${normalizedDomain}/products.json?limit=1`, { signal: controller.signal }),
    ]);

    clearTimeout(timeout);

    if (productsResponse.status === 'fulfilled' && productsResponse.value.ok) {
      const payload = (await productsResponse.value.json()) as { products?: unknown[] };
      if (Array.isArray(payload.products)) {
        return {
          sourceType: 'shopify',
          sourceUrl,
          normalizedDomain,
          instagramHandle: null,
          confidenceScore: 0.92,
        };
      }
    }

    if (homeResponse.status === 'fulfilled' && homeResponse.value.ok) {
      const html = await homeResponse.value.text();
      const lower = html.toLowerCase();

      if (
        lower.includes('cdn.shopify.com') ||
        lower.includes('shopify.theme') ||
        lower.includes('shopify-payment-button') ||
        lower.includes('myshopify.com')
      ) {
        return {
          sourceType: 'shopify',
          sourceUrl,
          normalizedDomain,
          instagramHandle: null,
          confidenceScore: 0.88,
        };
      }
    }
  } catch {
    return {
      sourceType: 'generic_site',
      sourceUrl,
      normalizedDomain,
      instagramHandle: null,
      confidenceScore: 0.45,
    };
  }

  return {
    sourceType: 'generic_site',
    sourceUrl,
    normalizedDomain,
    instagramHandle: null,
    confidenceScore: 0.62,
  };
}
