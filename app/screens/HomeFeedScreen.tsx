import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { ScreenContainer } from '../components/ScreenContainer';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../providers/AuthProvider';
import { fetchHomeFeedPage, HomeFeedItem } from '../services/feed';
import { trackProductEvent } from '../services/interactions';
import { theme } from '../theme/theme';

const PAGE_SIZE = 20;

type Props = NativeStackScreenProps<RootStackParamList, 'HomeFeed'>;

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

export function HomeFeedScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();

  const [items, setItems] = useState<HomeFeedItem[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  async function onProductPress(item: HomeFeedItem): Promise<void> {
    if (user) {
      try {
        await trackProductEvent({
          event: 'product_click',
          userId: user.id,
          brandId: item.brand_id,
          productId: item.id,
          metadata: {
            screen: 'home_feed',
          },
        });
      } catch (trackError: unknown) {
        console.warn('Failed to track product_click from home_feed', trackError);
      }
    }

    navigation.navigate('ProductDetails', { productId: item.id });
  }

  const loadInitial = useCallback(async () => {
    if (!user) {
      setItems([]);
      setHasMore(false);
      setLoadingInitial(false);
      return;
    }

    setLoadingInitial(true);
    setError(null);

    try {
      const firstPage = await fetchHomeFeedPage({
        userId: user.id,
        limit: PAGE_SIZE,
        offset: 0,
      });

      setItems(firstPage);
      setHasMore(firstPage.length === PAGE_SIZE);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load feed');
    } finally {
      setLoadingInitial(false);
    }
  }, [user]);

  const loadMore = useCallback(async () => {
    if (!user || loadingMore || loadingInitial || !hasMore) {
      return;
    }

    setLoadingMore(true);
    setError(null);

    try {
      const nextPage = await fetchHomeFeedPage({
        userId: user.id,
        limit: PAGE_SIZE,
        offset: items.length,
      });

      setItems((prev) => [...prev, ...nextPage]);
      setHasMore(nextPage.length === PAGE_SIZE);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load more products');
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, items.length, loadingInitial, loadingMore, user]);

  useFocusEffect(
    useCallback(() => {
      void loadInitial();
    }, [loadInitial])
  );

  return (
    <ScreenContainer>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Home Feed</Text>
          <Text style={styles.subtitle}>Newest drops from brands you follow.</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.historyButton}
            onPress={() => navigation.navigate('PurchaseHistory')}
          >
            <Text style={styles.historyButtonText}>History</Text>
          </Pressable>
          <Pressable style={styles.signOutButton} onPress={() => signOut()}>
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </Pressable>
        </View>
      </View>

      {loadingInitial ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.centerStateText}>Loading feed...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => void loadInitial()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centerState}>
          <Text style={styles.emptyTitle}>No products yet</Text>
          <Text style={styles.emptySubtitle}>Follow more active brands to populate your feed.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
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
                <Pressable onPress={() => navigation.navigate('BrandPage', { brandId: item.brand_id })}>
                  <Text style={styles.brandName}>{item.brand_name}</Text>
                </Pressable>
                <Text style={styles.productName}>{item.name}</Text>
                <Text style={styles.priceText}>{formatPrice(item.price_amount, item.currency_code)}</Text>
              </View>
            </Pressable>
          )}
          ListFooterComponent={
            hasMore ? (
              <Pressable style={styles.loadMoreButton} onPress={() => void loadMore()} disabled={loadingMore}>
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
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
    gap: theme.spacing.md,
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
  signOutButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    minHeight: 40,
    paddingHorizontal: theme.spacing.md,
    justifyContent: 'center',
  },
  signOutButtonText: {
    color: theme.colors.text,
    fontSize: theme.typography.caption,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  historyButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    minHeight: 40,
    paddingHorizontal: theme.spacing.md,
    justifyContent: 'center',
  },
  historyButtonText: {
    color: theme.colors.surface,
    fontSize: theme.typography.caption,
    fontWeight: '700',
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
    borderRadius: 8,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  retryButtonText: {
    color: theme.colors.surface,
    fontWeight: '700',
    fontSize: theme.typography.caption,
  },
  emptyTitle: {
    fontSize: theme.typography.heading,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
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
  brandName: {
    color: theme.colors.primary,
    fontSize: theme.typography.caption,
    fontWeight: '700',
    marginBottom: 4,
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
});
