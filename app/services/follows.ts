import { supabase } from './supabaseClient';

interface FollowBrandInput {
  userId: string;
  brandId: string;
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
