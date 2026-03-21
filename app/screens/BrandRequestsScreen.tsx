import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { BrandRequestCard } from '../components/BrandRequestCard';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { ScreenContainer } from '../components/ScreenContainer';
import { SearchField } from '../components/SearchField';
import { SectionLabel } from '../components/SectionLabel';
import { useAuth } from '../providers/AuthProvider';
import {
  BrandRequestListItem,
  fetchRequestedBrandsNowLive,
  searchBrandRequests,
  submitBrandRequest,
} from '../services/brandRequests';
import { theme } from '../theme/theme';

export function BrandRequestsScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const [query, setQuery] = useState('');
  const [nowLive, setNowLive] = useState<BrandRequestListItem[]>([]);
  const [results, setResults] = useState<BrandRequestListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [brandName, setBrandName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [category, setCategory] = useState('');

  const loadNowLive = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const liveRows = await fetchRequestedBrandsNowLive(user?.id, 8);
      setNowLive(liveRows);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load requested brands.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadNowLive();
    }, [loadNowLive])
  );

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }

    const timeout = setTimeout(() => {
      setSearching(true);
      searchBrandRequests(query, user?.id)
        .then((items) => {
          setResults(items);
        })
        .catch((searchError: unknown) => {
          setError(searchError instanceof Error ? searchError.message : 'Failed to search requests.');
        })
        .finally(() => {
          setSearching(false);
        });
    }, 250);

    return () => clearTimeout(timeout);
  }, [query, user?.id]);

  async function onSubmitRequest(): Promise<void> {
    if (!brandName.trim()) {
      setError('Brand name is required.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const result = await submitBrandRequest({
        userId: user?.id,
        name: brandName,
        websiteUrl,
        instagramUrl,
        category,
      });

      if (!result.created && result.duplicateType === 'existing_request' && result.request) {
        setMessage('This brand has already been nominated. Opening the existing nomination.');
        navigation.navigate('BrandRequestDetails', { requestId: result.request.id });
        return;
      }

      if (!result.created && result.duplicateType === 'live_brand' && result.liveBrandId) {
        setMessage('This brand is already live on Fashaun.');
        navigation.navigate('BrandPage', { brandId: result.liveBrandId });
        return;
      }

      setBrandName('');
      setWebsiteUrl('');
      setInstagramUrl('');
      setCategory('');
      setMessage('Brand nomination submitted.');
      await loadNowLive();

      if (result.request) {
        navigation.navigate('BrandRequestDetails', { requestId: result.request.id });
      }
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to submit request.');
    } finally {
      setSubmitting(false);
    }
  }

  function openRequest(item: BrandRequestListItem): void {
    navigation.navigate('BrandRequestDetails', { requestId: item.id });
  }

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <SectionLabel>Nominate A Brand</SectionLabel>
        <Text style={styles.title}>Request Brand</Text>
        <Text style={styles.subtitle}>
          Search first to avoid duplicates, then nominate the brand you want to see added next.
        </Text>

        <SearchField value={query} onChangeText={setQuery} placeholder="Search existing nominations" />

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
            placeholder="Website URL"
            placeholderTextColor={theme.colors.textMuted}
            style={styles.input}
            autoCapitalize="none"
          />
          <TextInput
            value={instagramUrl}
            onChangeText={setInstagramUrl}
            placeholder="Instagram URL"
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
          <AppButton label="Nominate Brand" onPress={() => void onSubmitRequest()} loading={submitting} />
        </View>

        {message ? <Text style={styles.message}>{message}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.section}>
          <SectionLabel>{query.trim() ? 'Matching Nominations' : 'Search Before You Submit'}</SectionLabel>
          {query.trim() ? (
            searching ? (
              <LoadingState label="Searching nominations" variant="cards" cardCount={2} />
            ) : results.length > 0 ? (
              results.map((item) => <BrandRequestCard key={item.id} item={item} onOpen={openRequest} />)
            ) : (
              <EmptyState
                title="No existing nomination found"
                subtitle="You can go ahead and nominate this brand using the form above."
              />
            )
          ) : (
            <EmptyState
              title="Start with a search"
              subtitle="This helps catch brands that are already nominated or already live."
            />
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <SectionLabel>Requested Brands Now Live</SectionLabel>
            <AppButton
              label="Open Leaderboard"
              variant="ghost"
              onPress={() => navigation.navigate('Leaderboard')}
            />
          </View>
          {loading ? (
            <LoadingState label="Loading live requests" variant="cards" cardCount={2} />
          ) : nowLive.length > 0 ? (
            nowLive.map((item) => <BrandRequestCard key={item.id} item={item} onOpen={openRequest} />)
          ) : (
            <EmptyState title="Nothing live yet" subtitle="When requested brands go live, they will appear here." />
          )}
        </View>
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
    marginTop: theme.spacing.sm,
  },
  error: {
    color: theme.colors.error,
    fontSize: theme.typography.caption,
    marginTop: theme.spacing.sm,
  },
  section: {
    marginTop: theme.spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
});
