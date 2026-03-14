import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { HeartButton } from '../components/HeartButton';
import { ScreenContainer } from '../components/ScreenContainer';
import { useAuth } from '../providers/AuthProvider';
import { fetchBrands } from '../services/brands';
import { fetchHomeFeedPage, HomeFeedItem } from '../services/feed';
import { fetchFollowedBrandIds, followBrand, unfollowBrand } from '../services/follows';
import { trackProductEvent } from '../services/interactions';
import { fetchSavedProductIds, saveProduct, unsaveProduct } from '../services/saves';
import { theme } from '../theme/theme';
import { Brand } from '../types';

const PAGE_SIZE = 20;

type DiscoveryTab = 'products' | 'brands';

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

export function HomeFeedScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<DiscoveryTab>('products');
  const [products, setProducts] = useState<HomeFeedItem[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [followedBrandIds, setFollowedBrandIds] = useState<string[]>([]);
  const [savedProductIds, setSavedProductIds] = useState<string[]>([]);

  const [productSearch, setProductSearch] = useState('');
  const [brandSearch, setBrandSearch] = useState('');

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const loadInitial = useCallback(async () => {
    if (!user) {
      setProducts([]);
      setBrands([]);
      setFollowedBrandIds([]);
      setSavedProductIds([]);
      setHasMore(false);
      setLoadingInitial(false);
      return;
    }

    setLoadingInitial(true);
    setError(null);

    try {
      const [firstPage, allBrands, followedIds] = await Promise.all([
        fetchHomeFeedPage({
          userId: user.id,
          limit: PAGE_SIZE,
          offset: 0,
        }),
        fetchBrands({ activeOnly: true }),
        fetchFollowedBrandIds(user.id),
      ]);

      const savedIds = await fetchSavedProductIds(
        user.id,
        firstPage.map((item) => item.id)
      );

      setProducts(firstPage);
      setBrands(allBrands);
      setFollowedBrandIds(followedIds);
      setSavedProductIds(savedIds);
      setHasMore(firstPage.length === PAGE_SIZE);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load discovery data');
    } finally {
      setLoadingInitial(false);
    }
  }, [user]);

  const loadMoreProducts = useCallback(async () => {
    if (!user || loadingMore || loadingInitial || !hasMore || followedBrandIds.length === 0) {
      return;
    }

    setLoadingMore(true);
    setError(null);

    try {
      const nextPage = await fetchHomeFeedPage({
        userId: user.id,
        limit: PAGE_SIZE,
        offset: products.length,
      });

      const savedIds = await fetchSavedProductIds(
        user.id,
        nextPage.map((item) => item.id)
      );

      setProducts((prev) => [...prev, ...nextPage]);
      setSavedProductIds((prev) => Array.from(new Set([...prev, ...savedIds])));
      setHasMore(nextPage.length === PAGE_SIZE);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load more products');
    } finally {
      setLoadingMore(false);
    }
  }, [followedBrandIds.length, hasMore, loadingInitial, loadingMore, products.length, user]);

  useFocusEffect(
    useCallback(() => {
      void loadInitial();
    }, [loadInitial])
  );

  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    if (!query) {
      return products;
    }

    return products.filter((item) => {
      const name = item.name.toLowerCase();
      const brandName = item.brand_name.toLowerCase();
      return name.includes(query) || brandName.includes(query);
    });
  }, [productSearch, products]);

  const filteredBrands = useMemo(() => {
    const query = brandSearch.trim().toLowerCase();
    if (!query) {
      return brands;
    }

    return brands.filter((brand) => {
      const name = brand.name.toLowerCase();
      const domain = brand.domain.toLowerCase();
      return name.includes(query) || domain.includes(query);
    });
  }, [brandSearch, brands]);

  async function onProductPress(item: HomeFeedItem): Promise<void> {
    if (user) {
      try {
        await trackProductEvent({
          event: 'product_click',
          userId: user.id,
          brandId: item.brand_id,
          productId: item.id,
          metadata: {
            screen: 'discovery_products',
          },
        });
      } catch (trackError: unknown) {
        console.warn('Failed to track product_click from discovery_products', trackError);
      }
    }

    navigation.navigate('ProductDetails', { productId: item.id });
  }

  async function onToggleSaveProduct(item: HomeFeedItem): Promise<void> {
    if (!user) {
      return;
    }

    const isSaved = savedProductIds.includes(item.id);

    try {
      if (isSaved) {
        await unsaveProduct({ userId: user.id, productId: item.id });
        setSavedProductIds((prev) => prev.filter((id) => id !== item.id));
      } else {
        await saveProduct({
          userId: user.id,
          brandId: item.brand_id,
          productId: item.id,
        });
        setSavedProductIds((prev) => [...prev, item.id]);
      }
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to update saved product');
    }
  }

  async function onToggleBrandFollow(brand: Brand): Promise<void> {
    if (!user) {
      return;
    }

    const isFollowed = followedBrandIds.includes(brand.id);

    try {
      if (isFollowed) {
        await unfollowBrand({ userId: user.id, brandId: brand.id });
        setFollowedBrandIds((prev) => prev.filter((id) => id !== brand.id));
      } else {
        await followBrand({ userId: user.id, brandId: brand.id });
        setFollowedBrandIds((prev) => [...prev, brand.id]);
      }
    } catch (followError: unknown) {
      setError(followError instanceof Error ? followError.message : 'Failed to update followed brand');
    }
  }

  const showNewUserEmptyState = !loadingInitial && followedBrandIds.length === 0;

  return (
    <ScreenContainer>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Discovery</Text>
        <Text style={styles.subtitle}>Find products and brands that fit your style.</Text>
      </View>

      {showNewUserEmptyState ? (
        <View style={styles.centerState}>
          <Text style={styles.emptyTitle}>Start by selecting brands</Text>
          <Text style={styles.emptySubtitle}>
            Choose a few brands to personalize your discovery feed.
          </Text>
          <Pressable
            style={styles.primaryButton}
            onPress={() => navigation.navigate('BrandSelection')}
          >
            <Text style={styles.primaryButtonText}>Select Brands</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.tabRow}>
            <Pressable
              style={[styles.tabButton, activeTab === 'products' ? styles.tabButtonActive : undefined]}
              onPress={() => setActiveTab('products')}
            >
              <Text style={[styles.tabText, activeTab === 'products' ? styles.tabTextActive : undefined]}>
                Products
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tabButton, activeTab === 'brands' ? styles.tabButtonActive : undefined]}
              onPress={() => setActiveTab('brands')}
            >
              <Text style={[styles.tabText, activeTab === 'brands' ? styles.tabTextActive : undefined]}>
                Brands
              </Text>
            </Pressable>
          </View>

          {activeTab === 'products' ? (
            <>
              <TextInput
                value={productSearch}
                onChangeText={setProductSearch}
                placeholder="Search products"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.searchInput}
              />

              {loadingInitial ? (
                <View style={styles.centerState}>
                  <ActivityIndicator color={theme.colors.primary} />
                  <Text style={styles.centerStateText}>Loading products...</Text>
                </View>
              ) : error ? (
                <View style={styles.centerState}>
                  <Text style={styles.errorText}>{error}</Text>
                  <Pressable style={styles.retryButton} onPress={() => void loadInitial()}>
                    <Text style={styles.retryButtonText}>Retry</Text>
                  </Pressable>
                </View>
              ) : filteredProducts.length === 0 ? (
                <View style={styles.centerState}>
                  <Text style={styles.emptyTitle}>No products found</Text>
                  <Text style={styles.emptySubtitle}>Try a different keyword.</Text>
                </View>
              ) : (
                <FlatList
                  data={filteredProducts}
                  keyExtractor={(item) => item.id}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.listContent}
                  renderItem={({ item }) => {
                    const isSaved = savedProductIds.includes(item.id);

                    return (
                      <Pressable style={styles.card} onPress={() => void onProductPress(item)}>
                        <View style={styles.imageWrap}>
                          {item.image_url ? (
                            <Image source={{ uri: item.image_url }} style={styles.image} resizeMode="cover" />
                          ) : (
                            <View style={styles.imageFallback}>
                              <Text style={styles.imageFallbackText}>No Image</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.cardBody}>
                          <View style={styles.cardTopRow}>
                            <Pressable
                              style={styles.brandButton}
                              onPress={() => navigation.navigate('BrandPage', { brandId: item.brand_id })}
                            >
                              <Text style={styles.brandName}>{item.brand_name}</Text>
                            </Pressable>
                            <HeartButton
                              active={isSaved}
                              onPress={() => void onToggleSaveProduct(item)}
                            />
                          </View>
                          <Text style={styles.productName}>{item.name}</Text>
                          <Text style={styles.priceText}>{formatPrice(item.price_amount, item.currency_code)}</Text>
                        </View>
                      </Pressable>
                    );
                  }}
                  ListFooterComponent={
                    hasMore ? (
                      <Pressable
                        style={styles.loadMoreButton}
                        onPress={() => void loadMoreProducts()}
                        disabled={loadingMore}
                      >
                        {loadingMore ? (
                          <ActivityIndicator color={theme.colors.text} />
                        ) : (
                          <Text style={styles.loadMoreButtonText}>Load More</Text>
                        )}
                      </Pressable>
                    ) : null
                  }
                />
              )}
            </>
          ) : (
            <>
              <TextInput
                value={brandSearch}
                onChangeText={setBrandSearch}
                placeholder="Search brands"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.searchInput}
              />

              {loadingInitial ? (
                <View style={styles.centerState}>
                  <ActivityIndicator color={theme.colors.primary} />
                  <Text style={styles.centerStateText}>Loading brands...</Text>
                </View>
              ) : error ? (
                <View style={styles.centerState}>
                  <Text style={styles.errorText}>{error}</Text>
                  <Pressable style={styles.retryButton} onPress={() => void loadInitial()}>
                    <Text style={styles.retryButtonText}>Retry</Text>
                  </Pressable>
                </View>
              ) : filteredBrands.length === 0 ? (
                <View style={styles.centerState}>
                  <Text style={styles.emptyTitle}>No brands found</Text>
                  <Text style={styles.emptySubtitle}>Try a different keyword.</Text>
                </View>
              ) : (
                <FlatList
                  data={filteredBrands}
                  keyExtractor={(item) => item.id}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.brandListContent}
                  renderItem={({ item }) => {
                    const isFollowed = followedBrandIds.includes(item.id);

                    return (
                      <Pressable
                        style={styles.brandCard}
                        onPress={() => navigation.navigate('BrandPage', { brandId: item.id })}
                      >
                        <View style={styles.brandInfoWrap}>
                          <Text style={styles.brandCardName}>{item.name}</Text>
                          <Text style={styles.brandCardDomain}>{item.domain}</Text>
                        </View>
                        <HeartButton
                          active={isFollowed}
                          onPress={() => void onToggleBrandFollow(item)}
                        />
                      </Pressable>
                    );
                  }}
                />
              )}
            </>
          )}
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: theme.typography.title,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 2,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: 2,
    marginBottom: theme.spacing.md,
  },
  tabButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#E8EEFF',
  },
  tabText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.overline,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  tabTextActive: {
    color: theme.colors.primary,
  },
  searchInput: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    minHeight: theme.button.height,
    paddingHorizontal: theme.spacing.md,
    color: theme.colors.text,
    fontSize: theme.typography.body,
    marginBottom: theme.spacing.md,
  },
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
    color: '#B91C1C',
    fontSize: theme.typography.body,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  retryButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    minHeight: theme.button.height,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    color: theme.colors.surface,
    fontWeight: '700',
    fontSize: theme.typography.body,
  },
  emptyTitle: {
    fontSize: theme.typography.heading,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.body,
    textAlign: 'center',
  },
  primaryButton: {
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    minHeight: theme.button.height,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: theme.colors.surface,
    fontWeight: '700',
    fontSize: theme.typography.body,
  },
  listContent: {
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.smd,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
  },
  imageWrap: {
    height: 220,
    backgroundColor: theme.colors.surfaceMuted,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageFallbackText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
  },
  cardBody: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  brandButton: {
    flexShrink: 1,
  },
  brandName: {
    color: theme.colors.primary,
    fontSize: theme.typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  productName: {
    color: theme.colors.text,
    fontSize: theme.typography.body,
    fontWeight: '700',
    marginBottom: theme.spacing.xs,
  },
  priceText: {
    color: theme.colors.text,
    fontSize: theme.typography.caption,
    fontWeight: '600',
  },
  loadMoreButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    minHeight: theme.button.height,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreButtonText: {
    color: theme.colors.text,
    fontSize: theme.typography.caption,
    fontWeight: '700',
  },
  brandListContent: {
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.smd,
  },
  brandCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.smd,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandInfoWrap: {
    flexShrink: 1,
    paddingRight: theme.spacing.sm,
  },
  brandCardName: {
    color: theme.colors.text,
    fontSize: theme.typography.body,
    fontWeight: '700',
    marginBottom: 2,
  },
  brandCardDomain: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
  },
});
