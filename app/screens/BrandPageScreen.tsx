import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '../components/EmptyState';
import { FadeInImage } from '../components/FadeInImage';
import { HeartButton } from '../components/HeartButton';
import { LoadingState } from '../components/LoadingState';
import { ScreenContainer } from '../components/ScreenContainer';
import { SectionLabel } from '../components/SectionLabel';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../providers/AuthProvider';
import { fetchBrandById } from '../services/brands';
import { fetchFollowedBrandIds, followBrand, unfollowBrand } from '../services/follows';
import { trackProductEvent } from '../services/interactions';
import { fetchProductsByBrandId } from '../services/products';
import { theme } from '../theme/theme';
import { Brand, Product } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'BrandPage'>;

function formatPrice(amount: number | null, currencyCode: string): string {
  if (amount === null) {
    return 'Price unavailable';
  }

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currencyCode} ${amount.toFixed(2)}`;
  }
}

export function BrandPageScreen({ route, navigation }: Props) {
  const { brandId } = route.params;
  const { user } = useAuth();

  const [brand, setBrand] = useState<Brand | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [updatingFollow, setUpdatingFollow] = useState(false);

  async function onProductPress(item: Product): Promise<void> {
    if (user) {
      try {
        await trackProductEvent({
          event: 'product_click',
          userId: user.id,
          brandId: item.brand_id,
          productId: item.id,
          metadata: {
            screen: 'brand_page',
          },
        });
      } catch (trackError: unknown) {
        console.warn('Failed to track product_click from brand_page', trackError);
      }
    }

    navigation.navigate('ProductDetails', { productId: item.id });
  }

  const loadData = useCallback(async () => {
    if (!user) {
      setError('You must be signed in to view brand details.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [brandData, productData, followedBrandIds] = await Promise.all([
        fetchBrandById(brandId),
        fetchProductsByBrandId(brandId, 50),
        fetchFollowedBrandIds(user.id),
      ]);

      setBrand(brandData);
      setProducts(productData);
      setIsFollowing(followedBrandIds.includes(brandId));
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load brand page');
    } finally {
      setLoading(false);
    }
  }, [brandId, user]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function toggleFollow(): Promise<void> {
    if (!user) {
      return;
    }

    setUpdatingFollow(true);
    setError(null);

    try {
      if (isFollowing) {
        await unfollowBrand({ userId: user.id, brandId });
        setIsFollowing(false);
      } else {
        await followBrand({ userId: user.id, brandId });
        setIsFollowing(true);
      }
    } catch (followError: unknown) {
      setError(followError instanceof Error ? followError.message : 'Failed to update follow state');
    } finally {
      setUpdatingFollow(false);
    }
  }

  return (
    <ScreenContainer>
      {loading ? (
        <LoadingState label="Loading brand" variant="cards" cardCount={2} />
      ) : error ? (
        <View style={styles.centerState}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => void loadData()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : brand ? (
        <>
          <View style={styles.headerCard}>
            <View style={styles.brandHeaderRow}>
              <View style={styles.brandHeaderTextWrap}>
                <SectionLabel>Fashion House</SectionLabel>
                <Text style={styles.brandName}>{brand.name}</Text>
                <Text style={styles.brandMeta}>{brand.domain}</Text>
              </View>
              {updatingFollow ? (
                <ActivityIndicator color={theme.colors.primary} />
              ) : (
                <HeartButton active={isFollowing} onPress={() => void toggleFollow()} />
              )}
            </View>
          </View>

          {products.length === 0 ? (
            <View style={styles.centerState}>
              <EmptyState title="No products available" subtitle="This brand has no active products yet." />
            </View>
          ) : (
            <FlatList
              data={products}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.productCard}
                  onPress={() => void onProductPress(item)}
                >
                  <View style={styles.productImageWrap}>
                    <FadeInImage uri={item.image_urls?.[0] ?? null} style={styles.productImage} />
                  </View>
                  <View style={styles.productBody}>
                    <Text style={styles.productName}>{item.name}</Text>
                    <Text style={styles.productPrice}>{formatPrice(item.price_amount, item.currency_code)}</Text>
                  </View>
                </Pressable>
              )}
            />
          )}
        </>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  centerStateText: {
    marginTop: theme.spacing.sm,
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.typography.body,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  retryButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  retryButtonText: {
    color: theme.colors.surface,
    fontWeight: '700',
    fontSize: theme.typography.caption,
  },
  headerCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  brandHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandHeaderTextWrap: {
    flexShrink: 1,
    paddingRight: theme.spacing.md,
  },
  brandName: {
    fontSize: theme.typography.heading,
    color: theme.colors.text,
    fontWeight: '700',
    marginBottom: 2,
  },
  brandMeta: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted,
  },
  listContent: {
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.smd,
  },
  productCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
  },
  productImageWrap: {
    height: 180,
    backgroundColor: theme.colors.surfaceMuted,
  },
  productImage: {
    flex: 1,
  },
  productBody: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  productName: {
    color: theme.colors.text,
    fontSize: theme.typography.body,
    fontWeight: '700',
    marginBottom: theme.spacing.xs,
  },
  productPrice: {
    color: theme.colors.text,
    fontSize: theme.typography.caption,
    fontWeight: '600',
  },
});
