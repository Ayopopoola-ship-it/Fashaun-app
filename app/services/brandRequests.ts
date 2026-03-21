import { trackAnalyticsEvent } from './analytics';
import { supabase } from './supabaseClient';
import {
  Brand,
  BrandRequest,
  BrandRequestStatus,
  BrandSourceType,
  DifficultyTag,
  EstimatedOnboardingTime,
} from '../types';
import {
  BrandSourceClassification,
  buildBrandRequestShareLink,
  classifyBrandSource,
  deriveRequestStatus,
  difficultyFromSourceType,
  normalizeBrandName,
  normalizeDomain,
  normalizeInstagramHandle,
  onboardingTimeFromDifficulty,
} from './brandRequestUtils';

export interface BrandRequestListItem extends BrandRequest {
  has_user_voted: boolean;
  linked_brand?: Pick<Brand, 'id' | 'name' | 'domain'> | null;
}

export interface SubmitBrandRequestInput {
  userId?: string | null;
  name: string;
  websiteUrl?: string | null;
  instagramUrl?: string | null;
  category?: string | null;
}

export interface SubmitBrandRequestResult {
  request: BrandRequest | null;
  created: boolean;
  duplicateType?: 'existing_request' | 'live_brand';
  liveBrandId?: string | null;
}

type RequestRow = BrandRequest & {
  linked_brand?: Pick<Brand, 'id' | 'name' | 'domain'> | null;
};

function toShareSlug(name: string): string {
  const base = normalizeBrandName(name).replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 40) || 'brand';
  return `${base}-${Date.now().toString(36)}`;
}

async function fetchUserVoteIds(userId: string | undefined | null, requestIds: string[]): Promise<Set<string>> {
  if (!userId || requestIds.length === 0) {
    return new Set<string>();
  }

  const { data, error } = await supabase
    .from('brand_request_votes')
    .select('brand_request_id')
    .eq('user_id', userId)
    .in('brand_request_id', requestIds);

  if (error) {
    throw new Error(`Failed to fetch brand request votes: ${error.message}`);
  }

  return new Set((data ?? []).map((row: { brand_request_id: string }) => row.brand_request_id));
}

function toRequestListItems(rows: RequestRow[], votedIds: Set<string>): BrandRequestListItem[] {
  return rows.map((row) => ({
    ...row,
    has_user_voted: votedIds.has(row.id),
  }));
}

async function findLiveBrandDuplicate(input: {
  name: string;
  normalizedDomain: string | null;
  instagramHandle: string | null;
}): Promise<Brand | null> {
  const conditions: Brand[] = [];

  if (input.normalizedDomain) {
    const { data, error } = await supabase
      .from('brands')
      .select('*')
      .eq('domain', input.normalizedDomain)
      .eq('status', 'live')
      .limit(1);

    if (error) {
      throw new Error(`Failed to check live brand duplicates: ${error.message}`);
    }

    if (data?.[0]) {
      conditions.push(data[0] as Brand);
    }
  }

  if (input.instagramHandle) {
    const { data, error } = await supabase
      .from('brands')
      .select('*')
      .eq('instagram_handle', input.instagramHandle)
      .eq('status', 'live')
      .limit(1);

    if (error) {
      throw new Error(`Failed to check Instagram duplicates: ${error.message}`);
    }

    if (data?.[0]) {
      conditions.push(data[0] as Brand);
    }
  }

  const { data: namedBrands, error: nameError } = await supabase
    .from('brands')
    .select('*')
    .ilike('name', input.name.trim())
    .eq('status', 'live')
    .limit(1);

  if (nameError) {
    throw new Error(`Failed to check brand name duplicates: ${nameError.message}`);
  }

  if (namedBrands?.[0]) {
    conditions.push(namedBrands[0] as Brand);
  }

  return conditions[0] ?? null;
}

async function findExistingRequest(input: {
  normalizedName: string;
  normalizedDomain: string | null;
  normalizedInstagramHandle: string | null;
}): Promise<BrandRequest | null> {
  const { data: byName, error: byNameError } = await supabase
    .from('brand_requests')
    .select('*')
    .eq('normalized_name', input.normalizedName)
    .limit(1);

  if (byNameError) {
    throw new Error(`Failed to check existing request by name: ${byNameError.message}`);
  }

  if (byName?.[0]) {
    return byName[0] as BrandRequest;
  }

  if (input.normalizedDomain) {
    const { data, error } = await supabase
      .from('brand_requests')
      .select('*')
      .eq('normalized_domain', input.normalizedDomain)
      .limit(1);

    if (error) {
      throw new Error(`Failed to check existing request by domain: ${error.message}`);
    }

    if (data?.[0]) {
      return data[0] as BrandRequest;
    }
  }

  if (input.normalizedInstagramHandle) {
    const { data, error } = await supabase
      .from('brand_requests')
      .select('*')
      .eq('normalized_instagram_handle', input.normalizedInstagramHandle)
      .limit(1);

    if (error) {
      throw new Error(`Failed to check existing request by Instagram: ${error.message}`);
    }

    if (data?.[0]) {
      return data[0] as BrandRequest;
    }
  }

  return null;
}

async function fetchRequestRowById(requestId: string): Promise<RequestRow> {
  const { data, error } = await supabase
    .from('brand_requests')
    .select('*, linked_brand:linked_brand_id(id, name, domain)')
    .eq('id', requestId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch brand request: ${error.message}`);
  }

  return data as RequestRow;
}

export async function submitBrandRequest(input: SubmitBrandRequestInput): Promise<SubmitBrandRequestResult> {
  const trimmedName = input.name.trim();
  if (!trimmedName) {
    throw new Error('Brand name is required.');
  }

  const normalizedName = normalizeBrandName(trimmedName);
  const classification = await classifyBrandSource({
    websiteUrl: input.websiteUrl,
    instagramUrl: input.instagramUrl,
  });
  const normalizedInstagramHandle = normalizeInstagramHandle(input.instagramUrl);

  const duplicateRequest = await findExistingRequest({
    normalizedName,
    normalizedDomain: classification.normalizedDomain,
    normalizedInstagramHandle,
  });

  if (duplicateRequest) {
    return {
      request: duplicateRequest,
      created: false,
      duplicateType: 'existing_request',
    };
  }

  const liveBrand = await findLiveBrandDuplicate({
    name: trimmedName,
    normalizedDomain: classification.normalizedDomain,
    instagramHandle: normalizedInstagramHandle,
  });

  if (liveBrand) {
    return {
      request: null,
      created: false,
      duplicateType: 'live_brand',
      liveBrandId: liveBrand.id,
    };
  }

  const difficulty = difficultyFromSourceType(classification.sourceType);
  const estimatedOnboardingTime = onboardingTimeFromDifficulty(difficulty);
  const shareSlug = toShareSlug(trimmedName);

  const { data, error } = await supabase
    .from('brand_requests')
    .insert({
      submitted_by_user_id: input.userId ?? null,
      name: trimmedName,
      normalized_name: normalizedName,
      website_url: input.websiteUrl?.trim() || null,
      instagram_url: input.instagramUrl?.trim() || null,
      normalized_domain: classification.normalizedDomain,
      instagram_handle: normalizedInstagramHandle,
      normalized_instagram_handle: normalizedInstagramHandle,
      category: input.category?.trim() || null,
      source_type: classification.sourceType,
      source_url: classification.sourceUrl,
      difficulty_tag: difficulty,
      estimated_onboarding_time: estimatedOnboardingTime,
      share_slug: shareSlug,
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to submit brand request: ${error.message}`);
  }

  const request = data as BrandRequest;

  trackAnalyticsEvent('brand_request_submitted', {
    request_id: request.id,
    user_id: input.userId ?? null,
    source_type: classification.sourceType,
    difficulty_tag: difficulty,
  });

  if (input.userId) {
    await voteForBrandRequest({
      requestId: request.id,
      userId: input.userId,
      silentIfAlreadyVoted: true,
    });
  }

  return {
    request: await fetchRequestRowById(request.id),
    created: true,
  };
}

export async function searchBrandRequests(query: string, userId?: string | null): Promise<BrandRequestListItem[]> {
  const trimmed = query.trim();

  let requestQuery = supabase
    .from('brand_requests')
    .select('*, linked_brand:linked_brand_id(id, name, domain)')
    .order('vote_count', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(trimmed ? 30 : 20);

  if (trimmed) {
    const normalized = normalizeBrandName(trimmed);
    const normalizedDomain = normalizeDomain(trimmed);
    const normalizedHandle = normalizeInstagramHandle(trimmed);
    const filters = [`name.ilike.%${trimmed}%`, `normalized_name.ilike.%${normalized}%`];

    if (normalizedDomain) {
      filters.push(`normalized_domain.eq.${normalizedDomain}`);
    }

    if (normalizedHandle) {
      filters.push(`normalized_instagram_handle.eq.${normalizedHandle}`);
    }

    requestQuery = requestQuery.or(filters.join(','));
  }

  const { data, error } = await requestQuery;
  if (error) {
    throw new Error(`Failed to search brand requests: ${error.message}`);
  }

  const rows = (data ?? []) as RequestRow[];
  const votedIds = await fetchUserVoteIds(userId, rows.map((row) => row.id));
  return toRequestListItems(rows, votedIds);
}

export async function fetchLeaderboard(userId?: string | null, limit = 10): Promise<BrandRequestListItem[]> {
  const { data, error } = await supabase
    .from('brand_requests')
    .select('*, linked_brand:linked_brand_id(id, name, domain)')
    .neq('status', 'rejected')
    .order('vote_count', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch request leaderboard: ${error.message}`);
  }

  const rows = (data ?? []) as RequestRow[];
  const votedIds = await fetchUserVoteIds(userId, rows.map((row) => row.id));
  return toRequestListItems(rows, votedIds);
}

export async function fetchUserVotedBrandRequests(
  userId: string,
  limit = 20
): Promise<BrandRequestListItem[]> {
  const { data: votes, error: votesError } = await supabase
    .from('brand_request_votes')
    .select('brand_request_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (votesError) {
    throw new Error(`Failed to fetch your voted requests: ${votesError.message}`);
  }

  const requestIds = (votes ?? []).map((vote: { brand_request_id: string }) => vote.brand_request_id);
  if (requestIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('brand_requests')
    .select('*, linked_brand:linked_brand_id(id, name, domain)')
    .in('id', requestIds);

  if (error) {
    throw new Error(`Failed to fetch your voted request details: ${error.message}`);
  }

  const rows = (data ?? []) as RequestRow[];
  const votedIds = new Set(requestIds);
  const rowMap = new Map(rows.map((row) => [row.id, row]));

  return requestIds
    .map((requestId) => rowMap.get(requestId))
    .filter((row): row is RequestRow => Boolean(row))
    .map((row) => ({
      ...row,
      has_user_voted: votedIds.has(row.id),
    }));
}

export async function fetchRequestedBrandsNowLive(userId?: string | null, limit = 10): Promise<BrandRequestListItem[]> {
  const { data, error } = await supabase
    .from('brand_requests')
    .select('*, linked_brand:linked_brand_id(id, name, domain)')
    .eq('status', 'live')
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch requested brands now live: ${error.message}`);
  }

  const rows = (data ?? []) as RequestRow[];
  const votedIds = await fetchUserVoteIds(userId, rows.map((row) => row.id));
  return toRequestListItems(rows, votedIds);
}

export async function fetchBrandRequestById(requestId: string, userId?: string | null): Promise<BrandRequestListItem> {
  const row = await fetchRequestRowById(requestId);
  const votedIds = await fetchUserVoteIds(userId, [requestId]);
  return {
    ...row,
    has_user_voted: votedIds.has(requestId),
  };
}

export async function voteForBrandRequest(input: {
  requestId: string;
  userId: string;
  silentIfAlreadyVoted?: boolean;
}): Promise<BrandRequestListItem> {
  const { error } = await supabase.from('brand_request_votes').insert({
    brand_request_id: input.requestId,
    user_id: input.userId,
  });

  if (error && !input.silentIfAlreadyVoted) {
    throw new Error(`Failed to vote for brand request: ${error.message}`);
  }

  const request = await fetchBrandRequestById(input.requestId, input.userId);

  if (!request.has_user_voted) {
    return request;
  }

  trackAnalyticsEvent('brand_request_voted', {
    request_id: request.id,
    user_id: input.userId,
    vote_count: request.vote_count,
    status: request.status,
  });

  return request;
}

export async function unvoteBrandRequest(input: { requestId: string; userId: string }): Promise<BrandRequestListItem> {
  const { error } = await supabase
    .from('brand_request_votes')
    .delete()
    .eq('brand_request_id', input.requestId)
    .eq('user_id', input.userId);

  if (error) {
    throw new Error(`Failed to remove vote: ${error.message}`);
  }

  return fetchBrandRequestById(input.requestId, input.userId);
}

export function getBrandRequestMeta(request: Pick<BrandRequest, 'source_type' | 'difficulty_tag' | 'estimated_onboarding_time'>): {
  sourceType: BrandSourceType;
  difficulty: DifficultyTag;
  onboardingTime: EstimatedOnboardingTime;
} {
  return {
    sourceType: request.source_type,
    difficulty: request.difficulty_tag,
    onboardingTime: request.estimated_onboarding_time,
  };
}

export { buildBrandRequestShareLink, classifyBrandSource, deriveRequestStatus };
