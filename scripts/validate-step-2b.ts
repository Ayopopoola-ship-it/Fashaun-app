import {
  fetchBrands,
  fetchProductsByFollowedBrands,
  followBrand,
  unfollowBrand,
} from '../app/services';

const TEST_USER_ID = '20a39ae9-d5e7-4b20-9c03-686323bf7bd1';
const TEST_BRAND_ID = 'ff8833cc-5deb-4d2f-89f7-12a3a1434393';

function requireValue(label: string, value: string): void {
  if (!value || value.startsWith('REPLACE_WITH_')) {
    throw new Error(`Set ${label} in scripts/validate-step-2b.ts before running.`);
  }
}

async function main(): Promise<void> {
  requireValue('TEST_USER_ID', TEST_USER_ID);
  requireValue('TEST_BRAND_ID', TEST_BRAND_ID);

  console.log('Step 2B validation started');

  const brands = await fetchBrands();
  const hasTargetBrand = brands.some((brand) => brand.id === TEST_BRAND_ID);
  if (!hasTargetBrand) {
    throw new Error('fetchBrands() did not return the target brand ID.');
  }
  console.log(`PASS fetchBrands() -> ${brands.length} active brands (target brand found)`);

  await followBrand({ userId: TEST_USER_ID, brandId: TEST_BRAND_ID });
  console.log('PASS followBrand() -> follow inserted/upserted');

  const productsAfterFollow = await fetchProductsByFollowedBrands({
    userId: TEST_USER_ID,
    limit: 50,
  });
  const hasTargetBrandProduct = productsAfterFollow.some((product) => product.brand_id === TEST_BRAND_ID);
  if (!hasTargetBrandProduct) {
    throw new Error('fetchProductsByFollowedBrands() did not return a product for the followed brand.');
  }
  console.log(
    `PASS fetchProductsByFollowedBrands() -> ${productsAfterFollow.length} products (includes followed brand)`
  );

  await unfollowBrand({ userId: TEST_USER_ID, brandId: TEST_BRAND_ID });
  console.log('PASS unfollowBrand() -> follow deleted');

  const productsAfterUnfollow = await fetchProductsByFollowedBrands({
    userId: TEST_USER_ID,
    limit: 50,
  });
  const stillHasTargetBrandProduct = productsAfterUnfollow.some((product) => product.brand_id === TEST_BRAND_ID);
  if (stillHasTargetBrandProduct) {
    throw new Error('Brand still appears in feed after unfollow; expected it to be removed.');
  }
  console.log(
    `PASS post-unfollow check -> ${productsAfterUnfollow.length} products (target brand removed from followed feed)`
  );

  console.log('Step 2B validation complete: all helpers are working.');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`Step 2B validation failed: ${message}`);
  process.exit(1);
});
