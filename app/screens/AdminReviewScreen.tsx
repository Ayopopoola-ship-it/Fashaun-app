import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { ScreenContainer } from '../components/ScreenContainer';
import { SearchField } from '../components/SearchField';
import { SectionLabel } from '../components/SectionLabel';
import { useAuth } from '../providers/AuthProvider';
import { isAdminUser } from '../services/adminAccess';
import {
  AdminBrandReviewItem,
  approveBrandIngestion,
  createAdminBrandImport,
  fetchAdminBrandReviewItems,
  publishBrandAndProducts,
  rejectBrandIngestion,
} from '../services/brandIngestion';
import { sourceTypeLabel } from '../services/brandRequestUtils';
import { theme } from '../theme/theme';

function ReviewPill({ label }: { label: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

function ingestionStatusLabel(status: string): string {
  if (status === 'in_progress') {
    return 'In Progress';
  }

  if (status === 'needs_review') {
    return 'Needs Review';
  }

  if (status === 'live') {
    return 'Live';
  }

  if (status === 'failed') {
    return 'Failed';
  }

  return 'Pending';
}

export function AdminReviewScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const adminEnabled = isAdminUser(user?.email);

  const [query, setQuery] = useState('');
  const [items, setItems] = useState<AdminBrandReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingBrandId, setActingBrandId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [brandName, setBrandName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [category, setCategory] = useState('');
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    if (!adminEnabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const rows = await fetchAdminBrandReviewItems();
      setItems(rows);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load admin review.');
    } finally {
      setLoading(false);
    }
  }, [adminEnabled]);

  useFocusEffect(
    useCallback(() => {
      void loadItems();
    }, [loadItems])
  );

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return items;
    }

    return items.filter((item) => {
      const name = item.brand.name.toLowerCase();
      const domain = item.brand.domain.toLowerCase();
      return name.includes(normalized) || domain.includes(normalized);
    });
  }, [items, query]);

  async function withAction(brandId: string, fn: () => Promise<void>, successMessage: string): Promise<void> {
    setActingBrandId(brandId);
    setError(null);

    try {
      await fn();
      Alert.alert('Updated', successMessage);
      await loadItems();
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to update this brand.');
    } finally {
      setActingBrandId(null);
    }
  }

  async function onImport(): Promise<void> {
    if (!brandName.trim()) {
      setError('Brand name is required.');
      return;
    }

    setImporting(true);
    setError(null);
    setMessage(null);

    try {
      const result = await createAdminBrandImport({
        name: brandName,
        websiteUrl,
        instagramUrl,
        category,
        initiatedByUserId: user?.id ?? null,
      });

      setBrandName('');
      setWebsiteUrl('');
      setInstagramUrl('');
      setCategory('');
      setMessage(
        result.ingestion
          ? `${result.brand.name} imported. ${result.ingestion.productsProcessed} products processed.`
          : `${result.brand.name} saved as unsupported and sent to review.`
      );
      await loadItems();
      navigation.navigate('AdminBrandReviewDetail', { brandId: result.brand.id });
    } catch (importError: unknown) {
      setError(importError instanceof Error ? importError.message : 'Failed to import brand.');
    } finally {
      setImporting(false);
    }
  }

  if (!adminEnabled) {
    return (
      <ScreenContainer>
        <EmptyState
          title="Admin access required"
          subtitle="Add your email to EXPO_PUBLIC_ADMIN_EMAILS to access this internal review screen."
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <SectionLabel>Internal Import Tool</SectionLabel>
        <Text style={styles.title}>Admin Review</Text>
        <Text style={styles.subtitle}>
          Import any brand directly, run ingestion, then review and publish only what should go live.
        </Text>

        <View style={styles.formCard}>
          <TextInput
            value={brandName}
            onChangeText={setBrandName}
            placeholder="Brand name"
            placeholderTextColor={theme.colors.textMuted}
            style={styles.input}
          />
          <TextInput
            value={websiteUrl}
            onChangeText={setWebsiteUrl}
            placeholder="Website or domain"
            placeholderTextColor={theme.colors.textMuted}
            style={styles.input}
            autoCapitalize="none"
          />
          <TextInput
            value={instagramUrl}
            onChangeText={setInstagramUrl}
            placeholder="Optional Instagram"
            placeholderTextColor={theme.colors.textMuted}
            style={styles.input}
            autoCapitalize="none"
          />
          <TextInput
            value={category}
            onChangeText={setCategory}
            placeholder="Optional category"
            placeholderTextColor={theme.colors.textMuted}
            style={styles.input}
          />
          <AppButton label="Import Brand" onPress={() => void onImport()} loading={importing} />
        </View>

        {message ? <Text style={styles.message}>{message}</Text> : null}

        <SearchField value={query} onChangeText={setQuery} placeholder="Search imported brands" />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {loading ? (
          <LoadingState label="Loading review queue" variant="cards" cardCount={3} />
        ) : filteredItems.length === 0 ? (
          <EmptyState title="No brands to review" subtitle="Imported brands will appear here." />
        ) : (
          <View style={styles.list}>
            {filteredItems.map((item) => {
              const busy = actingBrandId === item.brand.id;

              return (
                <Pressable
                  key={item.brand.id}
                  style={styles.card}
                  onPress={() => navigation.navigate('AdminBrandReviewDetail', { brandId: item.brand.id })}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderText}>
                      <Text style={styles.brandName}>{item.brand.name}</Text>
                      <Text style={styles.brandDomain}>{item.brand.domain}</Text>
                    </View>
                    <ReviewPill label={ingestionStatusLabel(item.brand.ingestion_status)} />
                  </View>

                  <View style={styles.metaGrid}>
                    <Text style={styles.metaLabel}>Source</Text>
                    <Text style={styles.metaValue}>{sourceTypeLabel(item.brand.source_type)}</Text>
                    <Text style={styles.metaLabel}>Brand Status</Text>
                    <Text style={styles.metaValue}>{item.brand.status}</Text>
                    <Text style={styles.metaLabel}>Products</Text>
                    <Text style={styles.metaValue}>
                      {item.productCount} total / {item.liveProductCount} live / {item.draftProductCount} draft
                    </Text>
                    <Text style={styles.metaLabel}>Confidence</Text>
                    <Text style={styles.metaValue}>
                      {item.brand.confidence_score !== null ? `${Math.round(item.brand.confidence_score * 100)}%` : 'N/A'}
                    </Text>
                  </View>

                  <View style={styles.actions}>
                    <AppButton
                      label="Approve"
                      variant="secondary"
                      onPress={() =>
                        void withAction(
                          item.brand.id,
                          () => approveBrandIngestion(item.brand.id),
                          `${item.brand.name} approved for review.`
                        )
                      }
                      disabled={busy}
                    />
                    <AppButton
                      label="Publish Brand + Products"
                      variant="secondary"
                      onPress={() =>
                        void withAction(
                          item.brand.id,
                          () => publishBrandAndProducts(item.brand.id),
                          `${item.brand.name} is now live in the app.`
                        )
                      }
                      disabled={busy}
                    />
                    <AppButton
                      label="Reject"
                      variant="secondary"
                      onPress={() =>
                        void withAction(
                          item.brand.id,
                          () => rejectBrandIngestion(item.brand.id),
                          `${item.brand.name} rejected.`
                        )
                      }
                      disabled={busy}
                    />
                    <AppButton
                      label="Review Products"
                      variant="ghost"
                      onPress={() => navigation.navigate('AdminBrandReviewDetail', { brandId: item.brand.id })}
                      disabled={busy}
                    />
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: theme.spacing.xl,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.typography.title,
    fontWeight: '700',
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.body,
    lineHeight: 22,
    marginBottom: theme.spacing.md,
  },
  formCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  input: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    minHeight: theme.button.height,
    paddingHorizontal: theme.spacing.md,
    color: theme.colors.text,
    fontSize: theme.typography.body,
    marginBottom: theme.spacing.sm,
  },
  message: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
    marginBottom: theme.spacing.md,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.typography.caption,
    marginBottom: theme.spacing.md,
  },
  list: {
    gap: theme.spacing.smd,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  cardHeaderText: {
    flex: 1,
  },
  brandName: {
    color: theme.colors.text,
    fontSize: theme.typography.body,
    fontWeight: '700',
    marginBottom: 2,
  },
  brandDomain: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
  },
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.accentSoft,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
  },
  pillText: {
    color: theme.colors.accent,
    fontSize: theme.typography.overline,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: theme.typography.tracking.wide,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: theme.spacing.xs,
    columnGap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  metaLabel: {
    width: 88,
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
    fontWeight: '600',
  },
  metaValue: {
    width: 170,
    color: theme.colors.text,
    fontSize: theme.typography.caption,
  },
  actions: {
    gap: theme.spacing.sm,
  },
});
