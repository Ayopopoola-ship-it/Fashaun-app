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
import { saveProduct, unsaveProduct } from '../services/saves';
import { fetchSavedProducts } from '../services/saved';
import { theme } from '../theme/theme';

const LIMIT = 80;

interface PriceDropItem extends HomeFeedItem {
  discountPercent: number;
  oldPriceAmount: number;
  isSavedProduct: boolean;
}

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

function getDiscountPercent(productName: string): number {
  const name = productName.toLowerCase();
  if (name.includes('clearance')) {
    return 40;
  }
  if (name.includes('outlet')) {
    return 30;
  }
  if (name.includes('sale')) {
    return 25;
  }
  if (name.includes('discount')) {
    return 20;
  }

  return 0;
}

function toOldPrice(newPrice: number, discountPercent: number): number {
  const factor = 1 - discountPercent / 100;
  if (factor <= 0) {
    return newPrice;
  }

  return Math.round((newPrice / factor) * 100) / 100;
}

export function PriceDropScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const [query, setQuery] = useState('');
  const [items, setItems] = useState<PriceDropItem[]>([]);
  const [savedProductIds, setSavedProductIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [feed, savedProducts] = await Promise.all([
        fetchHomeFeedPage({
          userId: user.id,
          limit: LIMIT,
          offset: 0,
        }),
        fetchSavedProducts(user.id),
      ]);

      const savedIdSet = new Set(savedProducts.map((item) => item.productId));
      const discounted = feed
        .map((item) => {
          if (item.price_amount === null) {
            return null;
          }

          const discountPercent = getDiscountPercent(item.name);
          if (discountPercent <= 0) {
            return null;
          }

          return {
            ...item,
            discountPercent,
            oldPriceAmount: toOldPrice(item.price_amount, discountPercent),
            isSavedProduct: savedIdSet.has(item.id),
          } as PriceDropItem;
        })
        .filter((item): item is PriceDropItem => item !== null)
        .sort((a, b) => {
          if (a.isSavedProduct !== b.isSavedProduct) {
            return a.isSavedProduct ? -1 : 1;
          }

          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

      setItems(discounted);
      setSavedProductIds(Array.from(savedIdSet));
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load price drop items');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return items;
    }

    return items.filter((item) => {
      const name = item.name.toLowerCase();
      const brand = item.brand_name.toLowerCase();
      return name.includes(normalized) || brand.includes(normalized);
    });
  }, [items, query]);

  async function onProductPress(item: PriceDropItem): Promise<void> {
    if (user) {
      try {
        await trackProductEvent({
          event: 'product_click',
          userId: user.id,
          brandId: item.brand_id,
          productId: item.id,
          metadata: {
            screen: 'price_drop',
          },
        });
      } catch {
        // Non-blocking.
      }
    }

    navigation.navigate('ProductDetails', { productId: item.id });
  }

  async function onToggleSave(item: PriceDropItem): Promise<void> {
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

  return (
    <ScreenContainer>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Price Drop</Text>
        <Text style={styles.subtitle}>Search discounted items from followed brands.</Text>
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search discounted items"
        placeholderTextColor={theme.colors.textMuted}
        style={styles.searchInput}
      />

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.centerStateText}>Loading discounted items...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => void loadData()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={styles.centerState}>
          <Text style={styles.emptyTitle}>No discounted items found</Text>
          <Text style={styles.emptySubtitle}>
            We will show discount-tagged items here when available from your followed brands.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => void onProductPress(item)}
            >
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
                  <Text style={styles.discountPill}>{`-${item.discountPercent}%`}</Text>
                  <View style={styles.rightTopWrap}>
                    {savedProductIds.includes(item.id) ? (
                      <Text style={styles.savedBadge}>Saved Product</Text>
                    ) : null}
                    <HeartButton
                      active={savedProductIds.includes(item.id)}
                      onPress={() => void onToggleSave(item)}
                    />
                  </View>
                </View>
                <Text style={styles.brandName}>{item.brand_name}</Text>
                <Text style={styles.productName}>{item.name}</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.oldPriceText}>{formatPrice(item.oldPriceAmount, item.currency_code)}</Text>
                  <Text style={styles.newPriceText}>{formatPrice(item.price_amount, item.currency_code)}</Text>
                </View>
              </View>
            </Pressable>
          )}
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
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.xs,
  },
  rightTopWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  discountPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF2F2',
    color: '#B91C1C',
    borderRadius: theme.radius.pill,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
  },
  savedBadge: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
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
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  oldPriceText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
    textDecorationLine: 'line-through',
    fontWeight: '500',
  },
  newPriceText: {
    color: theme.colors.text,
    fontSize: theme.typography.caption,
    fontWeight: '700',
  },
});
