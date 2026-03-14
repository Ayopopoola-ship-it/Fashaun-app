import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { ScreenContainer } from '../components/ScreenContainer';
import { theme } from '../theme/theme';

interface CartItem {
  id: string;
  productName: string;
  brandName: string;
}

export function CartScreen() {
  const [query, setQuery] = useState('');
  const [items] = useState<CartItem[]>([]);

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

  const emptyTitle = query.trim().length > 0 ? 'No matching cart items' : 'Your cart is empty';
  const emptySubtitle =
    query.trim().length > 0
      ? 'Try a different keyword.'
      : 'Cart search is ready. Cart item management is coming in the cart step.';

  return (
    <ScreenContainer>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Cart</Text>
        <Text style={styles.subtitle}>Search items in your shopping-intent list.</Text>
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search cart items"
        placeholderTextColor={theme.colors.textMuted}
        style={styles.searchInput}
      />

      {filteredItems.length === 0 ? (
        <View style={styles.centerState}>
          <Text style={styles.emptyTitle}>{emptyTitle}</Text>
          <Text style={styles.emptySubtitle}>{emptySubtitle}</Text>
        </View>
      ) : null}
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
});
