import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { ScreenContainer } from '../components/ScreenContainer';
import { SectionLabel } from '../components/SectionLabel';
import {
  approveBrandIngestion,
  fetchAdminBrandReviewDetail,
  ingestBrandProducts,
  markBrandLive,
  publishAllBrandProducts,
  publishProduct,
  rejectProduct,
  updateAdminBrand,
  updateAdminProduct,
} from '../services/brandIngestion';
import { sourceTypeLabel } from '../services/brandRequestUtils';
import { theme } from '../theme/theme';

type ScreenProps = {
  route: {
    params: {
      brandId: string;
    };
  };
};

export function AdminBrandReviewDetailScreen({ route }: ScreenProps) {
  const { brandId } = route.params;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof fetchAdminBrandReviewDetail>> | null>(null);

  const [brandName, setBrandName] = useState('');
  const [domain, setDomain] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [category, setCategory] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const next = await fetchAdminBrandReviewDetail(brandId);
      setDetail(next);
      setBrandName(next.brand.name);
      setDomain(next.brand.domain);
      setInstagramHandle(next.brand.instagram_handle ?? '');
      setCategory(next.brand.category ?? '');
      setSourceUrl(next.brand.source_url ?? '');
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load brand review detail.');
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  useFocusEffect(
    useCallback(() => {
      void loadDetail();
    }, [loadDetail])
  );

  const liveCount = useMemo(
    () => detail?.products.filter((product) => product.status === 'live').length ?? 0,
    [detail]
  );

  async function withAction(targetId: string, fn: () => Promise<void>, successMessage: string): Promise<void> {
    setActingId(targetId);
    setError(null);

    try {
      await fn();
      Alert.alert('Updated', successMessage);
      await loadDetail();
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to complete this action.');
    } finally {
      setActingId(null);
    }
  }

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingState label="Loading brand review detail" variant="cards" cardCount={3} />
      </ScreenContainer>
    );
  }

  if (error && !detail) {
    return (
      <ScreenContainer>
        <EmptyState title="Unable to load review detail" subtitle={error} />
      </ScreenContainer>
    );
  }

  if (!detail) {
    return (
      <ScreenContainer>
        <EmptyState title="Brand not found" subtitle="This review item is no longer available." />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <SectionLabel>Review Detail</SectionLabel>
        <Text style={styles.title}>{detail.brand.name}</Text>
        <Text style={styles.subtitle}>
          Source: {sourceTypeLabel(detail.brand.source_type)} | Brand status: {detail.brand.status} | Products live: {liveCount}
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.card}>
          <SectionLabel>Brand Details</SectionLabel>
          <TextInput value={brandName} onChangeText={setBrandName} style={styles.input} placeholder="Brand name" placeholderTextColor={theme.colors.textMuted} />
          <TextInput value={domain} onChangeText={setDomain} style={styles.input} placeholder="Domain" placeholderTextColor={theme.colors.textMuted} autoCapitalize="none" />
          <TextInput value={instagramHandle} onChangeText={setInstagramHandle} style={styles.input} placeholder="Instagram handle" placeholderTextColor={theme.colors.textMuted} autoCapitalize="none" />
          <TextInput value={category} onChangeText={setCategory} style={styles.input} placeholder="Category" placeholderTextColor={theme.colors.textMuted} />
          <TextInput value={sourceUrl} onChangeText={setSourceUrl} style={styles.input} placeholder="Source URL" placeholderTextColor={theme.colors.textMuted} autoCapitalize="none" />

          <View style={styles.actions}>
            <AppButton
              label="Save Brand"
              variant="secondary"
              onPress={() =>
                void withAction(
                  detail.brand.id,
                  () =>
                    updateAdminBrand(detail.brand.id, {
                      name: brandName,
                      domain,
                      instagramHandle,
                      category,
                      sourceUrl,
                    }).then(() => undefined),
                  `${brandName} updated.`
                )
              }
              disabled={actingId === detail.brand.id}
            />
            <AppButton
              label="Retry Ingestion"
              variant="secondary"
              onPress={() =>
                void withAction(
                  `${detail.brand.id}:retry`,
                  () => ingestBrandProducts({ brandId: detail.brand.id }).then(() => undefined),
                  `${detail.brand.name} ingestion retried.`
                )
              }
              disabled={actingId === `${detail.brand.id}:retry`}
            />
            <AppButton
              label="Approve Brand"
              variant="secondary"
              onPress={() =>
                void withAction(
                  `${detail.brand.id}:approve`,
                  () => approveBrandIngestion(detail.brand.id),
                  `${detail.brand.name} approved.`
                )
              }
              disabled={actingId === `${detail.brand.id}:approve`}
            />
            <AppButton
              label="Publish All Products"
              variant="secondary"
              onPress={() =>
                void withAction(
                  `${detail.brand.id}:products`,
                  () => publishAllBrandProducts(detail.brand.id),
                  `All imported products for ${detail.brand.name} are now live.`
                )
              }
              disabled={actingId === `${detail.brand.id}:products`}
            />
            <AppButton
              label="Mark Brand Live"
              variant="secondary"
              onPress={() =>
                void withAction(
                  `${detail.brand.id}:live`,
                  () => markBrandLive(detail.brand.id),
                  `${detail.brand.name} is now live.`
                )
              }
              disabled={actingId === `${detail.brand.id}:live`}
            />
          </View>
        </View>

        <View style={styles.section}>
          <SectionLabel>Imported Products</SectionLabel>
          {detail.products.length === 0 ? (
            <EmptyState title="No imported products yet" subtitle="Run ingestion for this brand to review imported products." />
          ) : (
            detail.products.map((product) => (
              <AdminProductCard
                key={product.id}
                product={product}
                busy={actingId === product.id}
                onSave={(input) =>
                  void withAction(product.id, () => updateAdminProduct(product.id, input), `${input.name} updated.`)
                }
                onPublish={() =>
                  void withAction(product.id, () => publishProduct(product.id), `${product.name} published.`)
                }
                onReject={() =>
                  void withAction(product.id, () => rejectProduct(product.id), `${product.name} rejected.`)
                }
              />
            ))
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function AdminProductCard({
  product,
  busy,
  onSave,
  onPublish,
  onReject,
}: {
  product: Awaited<ReturnType<typeof fetchAdminBrandReviewDetail>>['products'][number];
  busy: boolean;
  onSave: (input: { name: string; priceAmount: number | null; productUrl?: string | null; category?: string | null }) => void;
  onPublish: () => void;
  onReject: () => void;
}) {
  const [name, setName] = useState(product.name);
  const [priceAmount, setPriceAmount] = useState(product.price_amount !== null ? String(product.price_amount) : '');
  const [productUrl, setProductUrl] = useState(product.product_url ?? '');
  const [category, setCategory] = useState(product.category ?? '');

  return (
    <View style={styles.card}>
      <Text style={styles.productTitle}>{product.name}</Text>
      <Text style={styles.productMeta}>
        Status: {product.status} | Confidence:{' '}
        {product.confidence_score !== null ? `${Math.round(product.confidence_score * 100)}%` : 'N/A'}
      </Text>

      <TextInput value={name} onChangeText={setName} style={styles.input} placeholder="Product name" placeholderTextColor={theme.colors.textMuted} />
      <TextInput value={priceAmount} onChangeText={setPriceAmount} style={styles.input} placeholder="Price" placeholderTextColor={theme.colors.textMuted} keyboardType="decimal-pad" />
      <TextInput value={productUrl} onChangeText={setProductUrl} style={styles.input} placeholder="Product URL" placeholderTextColor={theme.colors.textMuted} autoCapitalize="none" />
      <TextInput value={category} onChangeText={setCategory} style={styles.input} placeholder="Category" placeholderTextColor={theme.colors.textMuted} />

      <View style={styles.actions}>
        <AppButton
          label="Save Product"
          variant="secondary"
          onPress={() =>
            onSave({
              name,
              priceAmount: priceAmount.trim() ? Number(priceAmount) : null,
              productUrl,
              category,
            })
          }
          disabled={busy}
        />
        <AppButton label="Publish Product" variant="secondary" onPress={onPublish} disabled={busy} />
        <AppButton label="Reject Product" variant="secondary" onPress={onReject} disabled={busy} />
      </View>
    </View>
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
  error: {
    color: theme.colors.error,
    fontSize: theme.typography.caption,
    marginBottom: theme.spacing.md,
  },
  section: {
    marginTop: theme.spacing.lg,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
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
  actions: {
    gap: theme.spacing.sm,
  },
  productTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.body,
    fontWeight: '700',
    marginBottom: 4,
  },
  productMeta: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
    marginBottom: theme.spacing.md,
  },
});
