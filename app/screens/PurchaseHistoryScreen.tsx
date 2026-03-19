import { useCallback, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { ScreenContainer } from '../components/ScreenContainer';
import { SectionLabel } from '../components/SectionLabel';
import { useAuth } from '../providers/AuthProvider';
import { fetchPurchaseHistory, PurchaseHistoryItem } from '../services/purchaseHistory';
import { theme } from '../theme/theme';

export function PurchaseHistoryScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState<PurchaseHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const history = await fetchPurchaseHistory(user.id, 60);
      setItems(history);
    } catch (loadError: unknown) {
      setError(
        loadError instanceof Error ? loadError.message : 'Failed to load tracked buy activity.'
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [loadHistory])
  );

  function formatTimestamp(value: string): string {
    const date = new Date(value);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  }

  return (
    <ScreenContainer>
      <SectionLabel>Concierge Log</SectionLabel>
      <Text style={styles.title}>Tracked Buy Activity</Text>
      <Text style={styles.subtitle}>
        This shows buy clicks from in-app browsing, not confirmed checkout transactions.
      </Text>

      {loading ? (
        <LoadingState label="Loading activity" />
      ) : error ? (
        <View style={styles.centerState}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => void loadHistory()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centerState}>
          <EmptyState
            title="No tracked buy activity yet"
            subtitle="Open a product and tap Buy on Brand Site to see entries here."
          />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.interactionId}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.card}>
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
                <Text style={styles.metaText}>{formatTimestamp(item.trackedAt)}</Text>
                <Text style={styles.trackingPill}>{item.trackingLabel}</Text>
              </View>
            </View>
          )}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: theme.typography.title,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    letterSpacing: theme.typography.tracking.normal,
  },
  subtitle: {
    fontSize: theme.typography.body,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.md,
    lineHeight: 22,
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
    flexDirection: 'row',
  },
  imageWrap: {
    width: 108,
    height: 120,
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
    color: theme.colors.accent,
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
  metaText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
    marginBottom: theme.spacing.sm,
  },
  trackingPill: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.accentSoft,
    color: theme.colors.accent,
    borderRadius: theme.radius.pill,
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
  },
});
