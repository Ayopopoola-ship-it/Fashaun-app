import type { BrandRequestStatus, BrandSourceType, DifficultyTag, EstimatedOnboardingTime } from './types';

export const REQUEST_STATUS_THRESHOLDS = {
  queued: 10,
  priority: 50,
  urgent: 100,
} as const;

export interface BrandSourceClassification {
  sourceType: BrandSourceType;
  sourceUrl: string | null;
  normalizedDomain: string | null;
  instagramHandle: string | null;
  confidenceScore: number;
}

export function normalizeBrandName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
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

export function difficultyFromSourceType(sourceType: BrandSourceType): DifficultyTag {
  if (sourceType === 'shopify') {
    return 'easy';
  }

  if (sourceType === 'generic_site') {
    return 'medium';
  }

  if (sourceType === 'instagram') {
    return 'hard';
  }

  return 'unknown';
}

export function onboardingTimeFromDifficulty(difficulty: DifficultyTag): EstimatedOnboardingTime {
  if (difficulty === 'easy') {
    return '1_to_3_days';
  }

  if (difficulty === 'medium') {
    return '3_to_7_days';
  }

  if (difficulty === 'hard') {
    return '1_to_3_weeks';
  }

  return 'unknown';
}

export function sourceTypeLabel(sourceType: BrandSourceType): string {
  if (sourceType === 'shopify') {
    return 'Shopify';
  }

  if (sourceType === 'generic_site') {
    return 'Generic Site';
  }

  if (sourceType === 'instagram') {
    return 'Instagram';
  }

  return 'Unknown';
}

export function brandRequestStatusLabel(status: BrandRequestStatus): string {
  if (status === 'requested') {
    return 'Requested';
  }

  if (status === 'queued') {
    return 'Queued';
  }

  if (status === 'priority') {
    return 'Priority';
  }

  if (status === 'urgent') {
    return 'Urgent';
  }

  if (status === 'live') {
    return 'Now Live';
  }

  return 'Rejected';
}

export function deriveRequestStatus(voteCount: number, isLive: boolean, isRejected = false): BrandRequestStatus {
  if (isLive) {
    return 'live';
  }

  if (isRejected) {
    return 'rejected';
  }

  if (voteCount >= REQUEST_STATUS_THRESHOLDS.urgent) {
    return 'urgent';
  }

  if (voteCount >= REQUEST_STATUS_THRESHOLDS.priority) {
    return 'priority';
  }

  if (voteCount >= REQUEST_STATUS_THRESHOLDS.queued) {
    return 'queued';
  }

  return 'requested';
}

export async function classifyBrandSource(input: {
  websiteUrl?: string | null;
  instagramUrl?: string | null;
}): Promise<BrandSourceClassification> {
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
