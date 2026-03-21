import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { BrandRequestCard } from '../components/BrandRequestCard';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { ScreenContainer } from '../components/ScreenContainer';
import { SearchField } from '../components/SearchField';
import { SectionLabel } from '../components/SectionLabel';
import { useAuth } from '../providers/AuthProvider';
import { trackAnalyticsEvent } from '../services/analytics';
import {
  BrandRequestListItem,
  buildBrandRequestShareLink,
  fetchLeaderboard,
  fetchRequestedBrandsNowLive,
  fetchUserVotedBrandRequests,
  searchBrandRequests,
  unvoteBrandRequest,
  voteForBrandRequest,
} from '../services/brandRequests';
import { theme } from '../theme/theme';

export function LeaderboardScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const [query, setQuery] = useState('');
  const [topVoted, setTopVoted] = useState<BrandRequestListItem[]>([]);
  const [myVotes, setMyVotes] = useState<BrandRequestListItem[]>([]);
  const [nowLive, setNowLive] = useState<BrandRequestListItem[]>([]);
  const [results, setResults] = useState<BrandRequestListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSections = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [leaderboardRows, liveRows, myVoteRows] = await Promise.all([
        fetchLeaderboard(user?.id, 20),
        fetchRequestedBrandsNowLive(user?.id, 8),
        user?.id ? fetchUserVotedBrandRequests(user.id, 12) : Promise.resolve([]),
      ]);

      setTopVoted(leaderboardRows);
      setNowLive(liveRows);
      setMyVotes(myVoteRows);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load leaderboard.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadSections();
    }, [loadSections])
  );

  useFocusEffect(
    useCallback(() => {
      if (!query.trim()) {
        setResults([]);
        setSearching(false);
        return;
      }

      let isActive = true;
      setSearching(true);

      searchBrandRequests(query, user?.id)
        .then((items) => {
          if (isActive) {
            setResults(items);
          }
        })
        .catch((searchError: unknown) => {
          if (isActive) {
            setError(searchError instanceof Error ? searchError.message : 'Failed to search leaderboard.');
          }
        })
        .finally(() => {
          if (isActive) {
            setSearching(false);
          }
        });

      return () => {
        isActive = false;
      };
    }, [query, user?.id])
  );

  function openRequest(item: BrandRequestListItem): void {
    navigation.navigate('BrandRequestDetails', { requestId: item.id });
  }

  async function onShare(item: BrandRequestListItem): Promise<void> {
    const link = buildBrandRequestShareLink(item.id);

    await Share.share({
      message: `Vote for ${item.name} on Fashaun.\n${link}`,
    });

    trackAnalyticsEvent('brand_request_shared', {
      request_id: item.id,
      user_id: user?.id ?? null,
    });
  }

  function syncItem(next: BrandRequestListItem): void {
    setTopVoted((prev) => prev.map((row) => (row.id === next.id ? next : row)));
    setNowLive((prev) => prev.map((row) => (row.id === next.id ? next : row)));
    setMyVotes((prev) => {
      const existing = prev.some((row) => row.id === next.id);
      if (next.has_user_voted) {
        return existing ? prev.map((row) => (row.id === next.id ? next : row)) : [next, ...prev];
      }
      return prev.filter((row) => row.id !== next.id);
    });
    setResults((prev) => prev.map((row) => (row.id === next.id ? next : row)));
  }

  async function onVote(item: BrandRequestListItem): Promise<void> {
    if (!user) {
      navigation.navigate('SignIn');
      return;
    }

    try {
      const next = item.has_user_voted
        ? await unvoteBrandRequest({ requestId: item.id, userId: user.id })
        : await voteForBrandRequest({ requestId: item.id, userId: user.id });

      syncItem(next);
    } catch (voteError: unknown) {
      setError(voteError instanceof Error ? voteError.message : 'Unable to update vote.');
    }
  }

  const showSearchResults = query.trim().length > 0;

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <SectionLabel>Community Leaderboard</SectionLabel>
        <Text style={styles.title}>Leaderboard</Text>
        <Text style={styles.subtitle}>
          See the brands the community is pushing up the queue, plus the nominations you have already backed.
        </Text>

        <SearchField value={query} onChangeText={setQuery} placeholder="Search nominated brands" />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {showSearchResults ? (
          <View style={styles.section}>
            <SectionLabel>Search Results</SectionLabel>
            {searching ? (
              <LoadingState label="Searching leaderboard" variant="cards" cardCount={2} />
            ) : results.length > 0 ? (
              results.map((item) => (
                <BrandRequestCard
                  key={item.id}
                  item={item}
                  onOpen={openRequest}
                  onVote={(selectedItem) => void onVote(selectedItem)}
                  onShare={(selectedItem) => void onShare(selectedItem)}
                  canVote={Boolean(user)}
                />
              ))
            ) : (
              <EmptyState title="No brands found" subtitle="Try a different brand name or URL." />
            )}
          </View>
        ) : loading ? (
          <LoadingState label="Loading leaderboard" variant="cards" cardCount={4} />
        ) : (
          <>
            <View style={styles.section}>
              <SectionLabel>Your Votes</SectionLabel>
              {user ? (
                myVotes.length > 0 ? (
                  myVotes.map((item) => (
                    <BrandRequestCard
                      key={item.id}
                      item={item}
                      onOpen={openRequest}
                      onVote={(selectedItem) => void onVote(selectedItem)}
                      onShare={(selectedItem) => void onShare(selectedItem)}
                    />
                  ))
                ) : (
                  <EmptyState
                    title="You have not voted yet"
                    subtitle="Open a nomination and vote for the brands you want to see on Fashaun."
                  />
                )
              ) : (
                <EmptyState
                  title="Sign in to see your votes"
                  subtitle="Your voted brands will show here once you are signed in."
                />
              )}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <SectionLabel>Top Voted Brands</SectionLabel>
                <AppButton
                  label="Request Brand"
                  variant="ghost"
                  onPress={() => navigation.navigate('RequestBrands')}
                />
              </View>
              {topVoted.length > 0 ? (
                topVoted.map((item, index) => (
                  <View key={item.id} style={styles.rankRow}>
                    <Text style={styles.rankText}>{index + 1}</Text>
                    <View style={styles.rankCardWrap}>
                      <BrandRequestCard
                        item={item}
                        onOpen={openRequest}
                        onVote={(selectedItem) => void onVote(selectedItem)}
                        onShare={(selectedItem) => void onShare(selectedItem)}
                        canVote={Boolean(user)}
                      />
                    </View>
                  </View>
                ))
              ) : (
                <EmptyState title="No nominations yet" subtitle="Top voted brands will appear here." />
              )}
            </View>

            <View style={styles.section}>
              <SectionLabel>Requested Brands Now Live</SectionLabel>
              {nowLive.length > 0 ? (
                nowLive.map((item) => (
                  <BrandRequestCard
                    key={item.id}
                    item={item}
                    onOpen={openRequest}
                    onVote={(selectedItem) => void onVote(selectedItem)}
                    onShare={(selectedItem) => void onShare(selectedItem)}
                    canVote={Boolean(user)}
                  />
                ))
              ) : (
                <EmptyState title="Nothing live yet" subtitle="When requested brands go live, they will show here." />
              )}
            </View>
          </>
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
  error: {
    color: theme.colors.error,
    fontSize: theme.typography.caption,
    marginBottom: theme.spacing.md,
  },
  section: {
    marginTop: theme.spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  rankText: {
    width: 20,
    paddingTop: theme.spacing.md,
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
    fontWeight: '700',
    textAlign: 'center',
  },
  rankCardWrap: {
    flex: 1,
  },
});
