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
import { fetchHomeFeedPage, HomeFeedItem } from '../services/feed';
import { trackProductEvent } from '../services/interactions';
import { fetchSavedProductIds, saveProduct, unsaveProduct } from '../services/saves';
import { theme } from '../theme/theme';

const LIMIT = 40;

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

export function TrendingScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<HomeFeedItem[]>([]);
  const [savedProductIds, setSavedProductIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user) {
      setProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const feed = await fetchHomeFeedPage({
        userId: user.id,
        limit: LIMIT,
        offset: 0,
      });
      const savedIds = await fetchSavedProductIds(
        user.id,
        feed.map((item) => item.id)
      );
      setProducts(feed);
      setSavedProductIds(savedIds);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load trending products');
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
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return products;
    }

    return products.filter((item) => {
      const name = item.name.toLowerCase();
      const brand = item.brand_name.toLowerCase();
      return name.includes(normalized) || brand.includes(normalized);
    });
  }, [products, query]);

  async function onProductPress(item: HomeFeedItem): Promise<void> {
    if (user) {
      try {
        await trackProductEvent({
          event: 'product_click',
          userId: user.id,
          brandId: item.brand_id,
          productId: item.id,
          metadata: {
            screen: 'trending',
          },
        });
      } catch (trackError: unknown) {
        console.warn('Failed to track product_click from trending', trackError);
      }
    }

    navigation.navigate('ProductDetails', { productId: item.id });
  }

  async function onToggleSave(item: HomeFeedItem): Promise<void> {
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

  function reasonForItem(item: HomeFeedItem, index: number): 'Trending' | 'Selling Fast' | 'Hot Right Now' | 'Popular This Week' {
    const ageMs = Date.now() - new Date(item.created_at).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    if (ageDays <= 3) {
      return 'Hot Right Now';
    }

    if (item.name.toLowerCase().includes('new')) {
      return 'Popular This Week';
    }

    return index % 2 === 0 ? 'Trending' : 'Selling Fast';
  }

  return (
    <ScreenContainer>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Trending</Text>
        <Text style={styles.subtitle}>Search products trending in brands you already follow.</Text>
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search trending products"
        placeholderTextColor={theme.colors.textMuted}
        style={styles.searchInput}
      />

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.centerStateText}>Loading trending products...</Text>
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
          <Text style={styles.emptyTitle}>No trending products found</Text>
          <Text style={styles.emptySubtitle}>Try another keyword or follow more brands.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => {
            const reason = reasonForItem(item, index);
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
                <View style={styles.topRow}>
                  <Text style={styles.reasonPill}>{reason}</Text>
                  <HeartButton active={isSaved} onPress={() => void onToggleSave(item)} />
                </View>
                <Text style={styles.brandName}>{item.brand_name}</Text>
                <Text style={styles.productName}>{item.name}</Text>
                <Text style={styles.priceText}>{formatPrice(item.price_amount, item.currency_code)}</Text>
              </View>
            </Pressable>
            );
          }}
        />
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
    height: 210,
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
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  reasonPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#E9EEF8',
    color: '#1E3A8A',
    borderRadius: theme.radius.pill,
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
  },
  brandName: {
    color: theme.colors.primary,
    fontSize: theme.typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: theme.spacing.xs,
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
});
