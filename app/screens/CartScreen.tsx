import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ScreenContainer } from '../components/ScreenContainer';
import { useAuth } from '../providers/AuthProvider';
import { CartItem, fetchCartItems, removeFromCart } from '../services/cart';
import { theme } from '../theme/theme';

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

export function CartScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const [query, setQuery] = useState('');
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCart = useCallback(async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const cartItems = await fetchCartItems(user.id);
      setItems(cartItems);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load cart');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void loadCart();
    }, [loadCart])
  );

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return items;
    }

    return items.filter((item) => {
      const productName = item.productName.toLowerCase();
      const brandName = item.brandName.toLowerCase();
      return productName.includes(normalized) || brandName.includes(normalized);
    });
  }, [items, query]);

  const estimatedTotal = useMemo(() => {
    return filteredItems.reduce((sum, item) => {
      const amount = item.livePriceAmount ?? item.priceAmount;
      return amount !== null ? sum + amount : sum;
    }, 0);
  }, [filteredItems]);

  const totalCurrency = filteredItems[0]?.liveCurrencyCode ?? filteredItems[0]?.currencyCode ?? 'USD';

  async function onRemoveItem(productId: string): Promise<void> {
    if (!user) {
      return;
    }

    try {
      await removeFromCart(user.id, productId);
      setItems((prev) => prev.filter((item) => item.productId !== productId));
    } catch (removeError: unknown) {
      setError(removeError instanceof Error ? removeError.message : 'Failed to remove cart item');
    }
  }

  async function onShareItem(item: CartItem): Promise<void> {
    try {
      const priceLabel = formatPrice(item.livePriceAmount ?? item.priceAmount, item.liveCurrencyCode);
      const lines = [
        'Fashaun Cart Item',
        `${item.productName} by ${item.brandName}`,
        `Price: ${priceLabel}`,
      ];

      if (item.hasPriceDrop && item.priceDropAmount !== null) {
        lines.push(`Price Drop: ${formatPrice(item.priceDropAmount, item.liveCurrencyCode)} lower`);
      }

      if (item.productUrl) {
        lines.push(`Buy on brand site: ${item.productUrl}`);
      }

      const message = lines.join('\n');

      await Share.share({
        message,
      });
    } catch {
      // Share cancellation and native share errors are non-blocking in MVP.
    }
  }

  return (
    <ScreenContainer>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Cart</Text>
        <Text style={styles.subtitle}>Your shopping-intent list. Buy happens on brand sites.</Text>
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search cart items"
        placeholderTextColor={theme.colors.textMuted}
        style={styles.searchInput}
      />

      {filteredItems.length > 0 ? (
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Estimated Total</Text>
          <Text style={styles.totalValue}>{formatPrice(estimatedTotal, totalCurrency)}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.centerStateText}>Loading cart...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => void loadCart()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={styles.centerState}>
          <Text style={styles.emptyTitle}>
            {query.trim().length > 0 ? 'No matching cart items' : 'Your cart is empty'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {query.trim().length > 0
              ? 'Try another keyword.'
              : 'Add products from Saved Products to build your shopping-intent cart.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.productId}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Pressable
                style={styles.cardMain}
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
                  <Text style={styles.brandName}>{item.brandName}</Text>
                  <Text style={styles.productName}>{item.productName}</Text>
                  <Text style={styles.priceText}>
                    {formatPrice(item.livePriceAmount ?? item.priceAmount, item.liveCurrencyCode)}
                  </Text>
                  {item.hasPriceDrop && item.priceDropAmount !== null ? (
                    <Text style={styles.priceDropText}>
                      Price dropped {formatPrice(item.priceDropAmount, item.liveCurrencyCode)}
                    </Text>
                  ) : null}
                </View>
              </Pressable>

              <View style={styles.actionsRow}>
                <Pressable style={styles.actionButton} onPress={() => void onShareItem(item)}>
                  <Text style={styles.actionButtonText}>Share</Text>
                </Pressable>
                <Pressable
                  style={styles.actionButton}
                  onPress={() => navigation.navigate('ProductDetails', { productId: item.productId })}
                >
                  <Text style={styles.actionButtonText}>View</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionButton, !item.productUrl ? styles.actionButtonDisabled : undefined]}
                  onPress={() => {
                    if (item.productUrl) {
                      navigation.navigate('BuyWebView', { productUrl: item.productUrl });
                    }
                  }}
                  disabled={!item.productUrl}
                >
                  <Text style={styles.actionButtonText}>Buy</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionButton, styles.removeButton]}
                  onPress={() => void onRemoveItem(item.productId)}
                >
                  <Text style={styles.removeButtonText}>Remove</Text>
                </Pressable>
              </View>
            </View>
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
  totalCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
    fontWeight: '600',
  },
  totalValue: {
    color: theme.colors.text,
    fontSize: theme.typography.body,
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
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  cardMain: {
    flexDirection: 'row',
  },
  imageWrap: {
    width: 110,
    height: 132,
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
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
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
    fontWeight: '700',
    marginBottom: 4,
  },
  priceDropText: {
    color: '#15803D',
    fontSize: 12,
    fontWeight: '600',
  },
  actionsRow: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  actionButton: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    backgroundColor: theme.colors.surface,
  },
  actionButtonText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  removeButton: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  removeButtonText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '700',
  },
});
