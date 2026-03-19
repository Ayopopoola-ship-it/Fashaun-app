import { trackAnalyticsEvent } from './analytics';
import { supabase } from './supabaseClient';

interface FollowBrandInput {
  userId: string;
  brandId: string;
}

export async function fetchFollowedBrandIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('user_brand_follows')
    .select('brand_id')
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to fetch followed brands: ${error.message}`);
  }

  return (data ?? []).map((row: { brand_id: string }) => row.brand_id);
}

export async function followBrand(input: FollowBrandInput): Promise<void> {
  const { userId, brandId } = input;

  const { error } = await supabase
    .from('user_brand_follows')
    .upsert(
      {
        user_id: userId,
        brand_id: brandId,
      },
      { onConflict: 'user_id,brand_id', ignoreDuplicates: true }
    );

  if (error) {
    throw new Error(`Failed to follow brand: ${error.message}`);
  }

  trackAnalyticsEvent('brand_follow', {
    user_id: userId,
    brand_id: brandId,
  });
}

export async function unfollowBrand(input: FollowBrandInput): Promise<void> {
  const { userId, brandId } = input;

  const { error } = await supabase
    .from('user_brand_follows')
    .delete()
    .eq('user_id', userId)
    .eq('brand_id', brandId);

  if (error) {
    throw new Error(`Failed to unfollow brand: ${error.message}`);
  }
}

export async function saveUserBrandFollows(userId: string, selectedBrandIds: string[]): Promise<void> {
  const existingBrandIds = await fetchFollowedBrandIds(userId);
  const selectedSet = new Set(selectedBrandIds);
  const existingSet = new Set(existingBrandIds);

  const toFollow = selectedBrandIds.filter((brandId) => !existingSet.has(brandId));
  const toUnfollow = existingBrandIds.filter((brandId) => !selectedSet.has(brandId));

  for (const brandId of toFollow) {
    await followBrand({ userId, brandId });
  }

  for (const brandId of toUnfollow) {
    await unfollowBrand({ userId, brandId });
  }
}
