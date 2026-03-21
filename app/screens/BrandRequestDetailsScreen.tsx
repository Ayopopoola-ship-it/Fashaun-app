import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { ScreenContainer } from '../components/ScreenContainer';
import { SectionLabel } from '../components/SectionLabel';
import { useAuth } from '../providers/AuthProvider';
import { trackAnalyticsEvent } from '../services/analytics';
import {
  BrandRequestListItem,
  buildBrandRequestShareLink,
  fetchBrandRequestById,
  unvoteBrandRequest,
  voteForBrandRequest,
} from '../services/brandRequests';
import {
  brandRequestStatusLabel,
  difficultyLabel,
  onboardingWindowLabel,
  sourceTypeLabel,
} from '../services/brandRequestUtils';
import { theme } from '../theme/theme';

function MetaPill({ label }: { label: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

type ScreenProps = {
  route: {
    params: {
      requestId: string;
    };
  };
};

export function BrandRequestDetailsScreen({ route }: ScreenProps) {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { requestId } = route.params;

  const [request, setRequest] = useState<BrandRequestListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingVote, setUpdatingVote] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRequest = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const row = await fetchBrandRequestById(requestId, user?.id);
      setRequest(row);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load brand request.');
    } finally {
      setLoading(false);
    }
  }, [requestId, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadRequest();
    }, [loadRequest])
  );

  async function onShare(): Promise<void> {
    if (!request) {
      return;
    }

    const link = buildBrandRequestShareLink(request.id);
    await Share.share({
      message: `Vote for ${request.name} on Fashaun.\n${link}`,
    });

    trackAnalyticsEvent('brand_request_shared', {
      request_id: request.id,
      user_id: user?.id ?? null,
    });
  }

  async function onVote(): Promise<void> {
    if (!request) {
      return;
    }

    if (!user) {
      trackAnalyticsEvent('brand_request_signup_cta_clicked', {
        request_id: request.id,
      });
      navigation.navigate('SignIn');
      return;
    }

    setUpdatingVote(true);

    try {
      const next = request.has_user_voted
        ? await unvoteBrandRequest({ requestId: request.id, userId: user.id })
        : await voteForBrandRequest({ requestId: request.id, userId: user.id });

      setRequest(next);
    } catch (voteError: unknown) {
      setError(voteError instanceof Error ? voteError.message : 'Failed to update vote.');
    } finally {
      setUpdatingVote(false);
    }
  }

  return (
    <ScreenContainer>
      {loading ? (
        <LoadingState label="Loading brand request" variant="cards" cardCount={1} />
      ) : error ? (
        <View style={styles.centerState}>
          <Text style={styles.errorText}>{error}</Text>
          <AppButton label="Retry" onPress={() => void loadRequest()} />
        </View>
      ) : request ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <SectionLabel>Brand Request</SectionLabel>
          <Text style={styles.title}>{request.name}</Text>
          <Text style={styles.subtitle}>
            Help move this brand up the queue. Higher vote totals push requests into queued, priority, and urgent tiers.
          </Text>

          <View style={styles.summaryCard}>
            <Text style={styles.voteCount}>{request.vote_count}</Text>
            <Text style={styles.voteLabel}>votes</Text>

            <View style={styles.pillRow}>
              <MetaPill label={brandRequestStatusLabel(request.status)} />
              <MetaPill label={sourceTypeLabel(request.source_type)} />
              <MetaPill label={difficultyLabel(request.difficulty_tag)} />
              <MetaPill label={onboardingWindowLabel(request.estimated_onboarding_time)} />
            </View>
          </View>

          <View style={styles.metaSection}>
            <SectionLabel>Source</SectionLabel>
            <Text style={styles.metaValue}>{request.source_url ?? request.website_url ?? request.instagram_url ?? 'Unknown source'}</Text>
          </View>

          {request.category ? (
            <View style={styles.metaSection}>
              <SectionLabel>Category</SectionLabel>
              <Text style={styles.metaValue}>{request.category}</Text>
            </View>
          ) : null}

          <View style={styles.actionRow}>
            <AppButton
              label={user ? (request.has_user_voted ? 'Remove Vote' : 'Vote for Brand') : 'Sign In to Vote'}
              onPress={() => void onVote()}
              loading={updatingVote}
            />
          </View>

          <View style={styles.actionRow}>
            <AppButton label="Share Request" variant="secondary" onPress={() => void onShare()} />
          </View>

          {user && request.status === 'live' && request.linked_brand_id ? (
            <View style={styles.actionRow}>
              <AppButton
                label="Open Live Brand"
                variant="secondary"
                onPress={() => navigation.navigate('BrandPage', { brandId: request.linked_brand_id })}
              />
            </View>
          ) : null}
        </ScrollView>
      ) : (
        <EmptyState title="Request not found" subtitle="This brand request may have been removed." />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: theme.spacing.xl,
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
  summaryCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  voteCount: {
    color: theme.colors.text,
    fontSize: theme.typography.display,
    fontWeight: '700',
  },
  voteLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
    marginBottom: theme.spacing.md,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
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
  metaSection: {
    marginBottom: theme.spacing.md,
  },
  metaValue: {
    color: theme.colors.text,
    fontSize: theme.typography.body,
    lineHeight: 22,
  },
  actionRow: {
    marginTop: theme.spacing.sm,
  },
});
