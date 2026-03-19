import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { EmptyState } from '../components/EmptyState';
import { FadeInImage } from '../components/FadeInImage';
import { HeartButton } from '../components/HeartButton';
import { LoadingState } from '../components/LoadingState';
import { ScreenContainer } from '../components/ScreenContainer';
import { SearchOverlay } from '../components/SearchOverlay';
import { SectionLabel } from '../components/SectionLabel';
import { TrendingSwipeDeck } from '../components/TrendingSwipeDeck';
import { useAuth } from '../providers/AuthProvider';
import { fetchHomeFeedPage, HomeFeedItem } from '../services/feed';
import { trackProductEvent, trackSwipeEvent } from '../services/interactions';
import { fetchSavedProductIds, saveProduct, unsaveProduct } from '../services/saves';
import { theme } from '../theme/theme';

const LIMIT = 48;
const VIEW_MODE_KEY = '@fashaun:trending:view-mode';

type TrendingViewMode = 'grid' | 'swipe';

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

  const [viewMode, setViewMode] = useState<TrendingViewMode>('grid');
  const [searchVisible, setSearchVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<HomeFeedItem[]>([]);
  const [savedProductIds, setSavedProductIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const savedMode = await AsyncStorage.getItem(VIEW_MODE_KEY);
        if (savedMode === 'grid' || savedMode === 'swipe') {
          setViewMode(savedMode);
        }
      } catch {
        // Ignore local preference read errors.
      }
    })();
  }, []);

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
            screen: `trending_${viewMode}`,
          },
        });
      } catch {
        // Non-blocking analytics.
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

  async function onSwipeLeft(item: HomeFeedItem): Promise<void> {
    if (!user) {
      return;
    }

    try {
      await trackSwipeEvent({
        event: 'swipe_left',
        userId: user.id,
        brandId: item.brand_id,
        productId: item.id,
        metadata: {
          screen: 'trending_swipe',
        },
      });
    } catch {
      // Non-blocking analytics.
    }
  }

  async function onSwipeRight(item: HomeFeedItem): Promise<void> {
    if (!user) {
      return;
    }

    try {
      await trackSwipeEvent({
        event: 'swipe_right',
        userId: user.id,
        brandId: item.brand_id,
        productId: item.id,
        metadata: {
          screen: 'trending_swipe',
        },
      });
    } catch {
      // Non-blocking analytics.
    }
  }

  async function toggleViewMode(): Promise<void> {
    const nextMode: TrendingViewMode = viewMode === 'grid' ? 'swipe' : 'grid';
    setViewMode(nextMode);
    await AsyncStorage.setItem(VIEW_MODE_KEY, nextMode);
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
        <View style={styles.headerCopy}>
          <SectionLabel>Signal</SectionLabel>
          <Text style={styles.title}>Trending</Text>
          <Text style={styles.subtitle}>Switch between classic browsing and swipe mode.</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.iconButton} onPress={() => setSearchVisible(true)}>
            <Feather name="search" size={18} color={theme.colors.text} />
          </Pressable>
          <Pressable style={styles.iconButton} onPress={() => void toggleViewMode()}>
            <Feather name={viewMode === 'grid' ? 'layers' : 'grid'} size={18} color={theme.colors.text} />
          </Pressable>
        </View>
      </View>

      <SearchOverlay
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        onSubmit={setQuery}
        placeholder="Search trending products"
        scopeKey="trending"
        initialQuery={query}
      />

      {loading ? (
        <LoadingState label="Loading trending products" variant="cards" />
      ) : error ? (
        <View style={styles.centerState}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => void loadData()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : filteredProducts.length === 0 ? (
        <View style={styles.centerState}>
          <EmptyState
            title="No trending products found"
            subtitle="Try another keyword or follow more brands."
          />
        </View>
      ) : viewMode === 'swipe' ? (
        <TrendingSwipeDeck
          items={filteredProducts}
          savedProductIds={savedProductIds}
          onOpenItem={onProductPress}
          onToggleSave={onToggleSave}
          onSwipeLeft={onSwipeLeft}
          onSwipeRight={onSwipeRight}
        />
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
                  <FadeInImage uri={item.image_url} style={styles.image} />
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  headerCopy: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingTop: theme.spacing.xs,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  title: {
    fontSize: theme.typography.title,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 2,
    letterSpacing: theme.typography.tracking.normal,
  },
  subtitle: {
    fontSize: theme.typography.body,
    color: theme.colors.textMuted,
    lineHeight: 22,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  errorText: {
    color: theme.colors.error,
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
    flex: 1,
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
    backgroundColor: theme.colors.accentSoft,
    color: theme.colors.accent,
    borderRadius: theme.radius.pill,
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
  },
  brandName: {
    color: theme.colors.accent,
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
