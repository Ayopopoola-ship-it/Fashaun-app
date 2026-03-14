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
import { unfollowBrand } from '../services/follows';
import { unsaveProduct } from '../services/saves';
import { fetchSavedBrands, fetchSavedProducts, SavedBrandItem, SavedProductItem } from '../services/saved';
import { theme } from '../theme/theme';

type SavedTab = 'products' | 'brands';

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

export function SavedScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<SavedTab>('products');
  const [products, setProducts] = useState<SavedProductItem[]>([]);
  const [brands, setBrands] = useState<SavedBrandItem[]>([]);

  const [productSearch, setProductSearch] = useState('');
  const [brandSearch, setBrandSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user) {
      setProducts([]);
      setBrands([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [savedProducts, savedBrands] = await Promise.all([
        fetchSavedProducts(user.id),
        fetchSavedBrands(user.id),
      ]);

      setProducts(savedProducts);
      setBrands(savedBrands);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load saved items');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    if (!query) {
      return products;
    }

    return products.filter((item) => {
      const productName = item.productName.toLowerCase();
      const brandName = item.brandName.toLowerCase();
      return productName.includes(query) || brandName.includes(query);
    });
  }, [productSearch, products]);

  const filteredBrands = useMemo(() => {
    const query = brandSearch.trim().toLowerCase();
    if (!query) {
      return brands;
    }

    return brands.filter((item) => {
      const brandName = item.brandName.toLowerCase();
      const domain = item.domain.toLowerCase();
      return brandName.includes(query) || domain.includes(query);
    });
  }, [brandSearch, brands]);

  async function onUnsaveProduct(item: SavedProductItem): Promise<void> {
    if (!user) {
      return;
    }

    try {
      await unsaveProduct({ userId: user.id, productId: item.productId });
      setProducts((prev) => prev.filter((product) => product.productId !== item.productId));
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to unsave product');
    }
  }

  async function onUnsaveBrand(item: SavedBrandItem): Promise<void> {
    if (!user) {
      return;
    }

    try {
      await unfollowBrand({ userId: user.id, brandId: item.brandId });
      setBrands((prev) => prev.filter((brand) => brand.brandId !== item.brandId));
    } catch (followError: unknown) {
      setError(followError instanceof Error ? followError.message : 'Failed to unsave brand');
    }
  }

  return (
    <ScreenContainer>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Saved</Text>
        <Text style={styles.subtitle}>Products and brands you want to keep track of.</Text>
      </View>

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
            placeholder="Search saved products"
            placeholderTextColor={theme.colors.textMuted}
            style={styles.searchInput}
          />

          {loading ? (
            <View style={styles.centerState}>
              <ActivityIndicator color={theme.colors.primary} />
              <Text style={styles.centerStateText}>Loading saved products...</Text>
            </View>
          ) : error ? (
            <View style={styles.centerState}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable style={styles.retryButton} onPress={() => void loadData()}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </Pressable>
            </View>
          ) : filteredProducts.length === 0 ? (
            <View style={styles.centerState}>
              <Text style={styles.emptyTitle}>No saved products</Text>
              <Text style={styles.emptySubtitle}>Tap the heart icon on products to save them.</Text>
            </View>
          ) : (
            <FlatList
              data={filteredProducts}
              keyExtractor={(item) => item.productId}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.card}
                  onPress={() => navigation.navigate('ProductDetails', { productId: item.productId })}
                >
                  <View style={styles.imageWrap}>
                    {item.productImageUrl ? (
                      <Image source={{ uri: item.productImageUrl }} style={styles.image} resizeMode="cover" />
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
                        onPress={() => navigation.navigate('BrandPage', { brandId: item.brandId })}
                      >
                        <Text style={styles.brandName}>{item.brandName}</Text>
                      </Pressable>
                      <HeartButton active onPress={() => void onUnsaveProduct(item)} />
                    </View>
                    <Text style={styles.productName}>{item.productName}</Text>
                    <Text style={styles.priceText}>{formatPrice(item.priceAmount, item.currencyCode)}</Text>
                  </View>
                </Pressable>
              )}
            />
          )}
        </>
      ) : (
        <>
          <TextInput
            value={brandSearch}
            onChangeText={setBrandSearch}
            placeholder="Search saved brands"
            placeholderTextColor={theme.colors.textMuted}
            style={styles.searchInput}
          />

          {loading ? (
            <View style={styles.centerState}>
              <ActivityIndicator color={theme.colors.primary} />
              <Text style={styles.centerStateText}>Loading saved brands...</Text>
            </View>
          ) : error ? (
            <View style={styles.centerState}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable style={styles.retryButton} onPress={() => void loadData()}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </Pressable>
            </View>
          ) : filteredBrands.length === 0 ? (
            <View style={styles.centerState}>
              <Text style={styles.emptyTitle}>No saved brands</Text>
              <Text style={styles.emptySubtitle}>Tap the heart icon on brands to save them.</Text>
            </View>
          ) : (
            <FlatList
              data={filteredBrands}
              keyExtractor={(item) => item.brandId}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.brandListContent}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.brandCard}
                  onPress={() => navigation.navigate('BrandPage', { brandId: item.brandId })}
                >
                  <View style={styles.brandInfoWrap}>
                    <Text style={styles.brandCardName}>{item.brandName}</Text>
                    <Text style={styles.brandCardDomain}>{item.domain}</Text>
                  </View>
                  <HeartButton active onPress={() => void onUnsaveBrand(item)} />
                </Pressable>
              )}
            />
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
