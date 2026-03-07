import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { ScreenContainer } from '../components/ScreenContainer';
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
        <View style={styles.centerState}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.centerStateText}>Loading brand...</Text>
        </View>
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
            <Text style={styles.brandName}>{brand.name}</Text>
            <Text style={styles.brandMeta}>{brand.domain}</Text>
            <Pressable
              style={[styles.followButton, isFollowing ? styles.followButtonActive : undefined]}
              onPress={() => void toggleFollow()}
              disabled={updatingFollow}
            >
              {updatingFollow ? (
                <ActivityIndicator color={isFollowing ? theme.colors.text : theme.colors.surface} />
              ) : (
                <Text style={[styles.followButtonText, isFollowing ? styles.followButtonTextActive : undefined]}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              )}
            </Pressable>
          </View>

          {products.length === 0 ? (
            <View style={styles.centerState}>
              <Text style={styles.emptyTitle}>No products available</Text>
              <Text style={styles.emptySubtitle}>This brand has no active products yet.</Text>
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
                    {item.image_urls?.[0] ? (
                      <Image source={{ uri: item.image_urls[0] }} style={styles.productImage} resizeMode="cover" />
                    ) : (
                      <View style={styles.productImageFallback}>
                        <Text style={styles.productImageFallbackText}>No Image</Text>
                      </View>
                    )}
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
  },
  centerStateText: {
    marginTop: theme.spacing.sm,
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: theme.typography.body,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  retryButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
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
    borderRadius: 14,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
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
    marginBottom: theme.spacing.md,
  },
  followButton: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  followButtonActive: {
    backgroundColor: '#DBEAFE',
  },
  followButtonText: {
    color: theme.colors.surface,
    fontSize: theme.typography.caption,
    fontWeight: '700',
  },
  followButtonTextActive: {
    color: theme.colors.primary,
  },
  listContent: {
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  productCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  productImageWrap: {
    height: 180,
    backgroundColor: '#F1F5F9',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productImageFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productImageFallbackText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
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
  emptyTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.heading,
    fontWeight: '700',
    marginBottom: theme.spacing.xs,
  },
  emptySubtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.body,
  },
});
