import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandRequestListItem } from '../services/brandRequests';
import {
  brandRequestStatusLabel,
  difficultyLabel,
  onboardingWindowLabel,
  sourceTypeLabel,
} from '../services/brandRequestUtils';
import { theme } from '../theme/theme';

function RequestPill({ label }: { label: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

interface BrandRequestCardProps {
  item: BrandRequestListItem;
  onOpen: (item: BrandRequestListItem) => void;
  onVote?: (item: BrandRequestListItem) => void;
  onShare?: (item: BrandRequestListItem) => void;
  canVote?: boolean;
}

export function BrandRequestCard({
  item,
  onOpen,
  onVote,
  onShare,
  canVote = true,
}: BrandRequestCardProps) {
  return (
    <Pressable style={styles.card} onPress={() => onOpen(item)}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderText}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <Text style={styles.cardMeta}>{item.vote_count} votes</Text>
        </View>
        <RequestPill label={brandRequestStatusLabel(item.status)} />
      </View>

      <View style={styles.pillRow}>
        <RequestPill label={sourceTypeLabel(item.source_type)} />
        <RequestPill label={difficultyLabel(item.difficulty_tag)} />
        <RequestPill label={onboardingWindowLabel(item.estimated_onboarding_time)} />
      </View>

      {onVote || onShare ? (
        <View style={styles.cardActions}>
          {onVote ? (
            <Pressable
              style={[
                styles.inlineAction,
                item.has_user_voted ? styles.inlineActionActive : undefined,
                !canVote ? styles.inlineActionDisabled : undefined,
              ]}
              onPress={(event) => {
                event.stopPropagation();
                onVote(item);
              }}
              disabled={!canVote}
            >
              <Text
                style={[
                  styles.inlineActionText,
                  item.has_user_voted ? styles.inlineActionTextActive : undefined,
                ]}
              >
                {item.has_user_voted ? 'Voted' : 'Vote'}
              </Text>
            </Pressable>
          ) : null}

          {onShare ? (
            <Pressable
              style={styles.inlineAction}
              onPress={(event) => {
                event.stopPropagation();
                onShare(item);
              }}
            >
              <Text style={styles.inlineActionText}>Share</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.body,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardMeta: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
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
  cardActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  inlineAction: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceMuted,
  },
  inlineActionActive: {
    backgroundColor: theme.colors.accentSoft,
  },
  inlineActionDisabled: {
    opacity: 0.45,
  },
  inlineActionText: {
    color: theme.colors.text,
    fontSize: theme.typography.overline,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: theme.typography.tracking.wide,
  },
  inlineActionTextActive: {
    color: theme.colors.accent,
  },
});
