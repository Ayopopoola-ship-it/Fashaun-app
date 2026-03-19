import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { theme } from '../theme/theme';

interface SearchOverlayProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (query: string) => void;
  placeholder: string;
  scopeKey: string;
  initialQuery?: string;
}

const MAX_RECENTS = 6;

function storageKey(scopeKey: string): string {
  return `@fashaun:recent-searches:${scopeKey}`;
}

export function SearchOverlay({
  visible,
  onClose,
  onSubmit,
  placeholder,
  scopeKey,
  initialQuery = '',
}: SearchOverlayProps) {
  const inputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState(initialQuery);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setQuery(initialQuery);

    const timeout = setTimeout(() => {
      inputRef.current?.focus();
    }, 30);

    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey(scopeKey));
        if (!raw) {
          setRecent([]);
          return;
        }

        const parsed = JSON.parse(raw) as string[];
        setRecent(Array.isArray(parsed) ? parsed.slice(0, MAX_RECENTS) : []);
      } catch {
        setRecent([]);
      }
    })();

    return () => clearTimeout(timeout);
  }, [initialQuery, scopeKey, visible]);

  const trimmedQuery = useMemo(() => query.trim(), [query]);

  async function persistRecent(nextQuery: string): Promise<void> {
    const normalized = nextQuery.trim();
    if (!normalized) {
      return;
    }

    const next = [normalized, ...recent.filter((item) => item.toLowerCase() !== normalized.toLowerCase())]
      .slice(0, MAX_RECENTS);
    setRecent(next);
    await AsyncStorage.setItem(storageKey(scopeKey), JSON.stringify(next));
  }

  function close(): void {
    onClose();
  }

  async function submit(value: string): Promise<void> {
    const next = value.trim();
    onSubmit(next);
    await persistRecent(next);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={close}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropPress} onPress={close} />
        <View style={styles.sheet}>
          <View style={styles.inputRow}>
            <Feather name="search" size={18} color={theme.colors.textMuted} />
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              placeholder={placeholder}
              placeholderTextColor={theme.colors.textMuted}
              style={styles.input}
              returnKeyType="search"
              onSubmitEditing={() => void submit(query)}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable onPress={close} hitSlop={8}>
              <Feather name="x" size={18} color={theme.colors.textMuted} />
            </Pressable>
          </View>

          {recent.length > 0 ? (
            <View style={styles.recentWrap}>
              <Text style={styles.recentTitle}>Recent</Text>
              <View style={styles.recentList}>
                {recent.map((item) => (
                  <Pressable key={item} style={styles.recentItem} onPress={() => void submit(item)}>
                    <Feather name="clock" size={13} color={theme.colors.textMuted} />
                    <Text style={styles.recentText}>{item}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <Pressable
            style={[styles.searchButton, !trimmedQuery ? styles.searchButtonDisabled : undefined]}
            disabled={!trimmedQuery}
            onPress={() => void submit(query)}
          >
            <Text style={styles.searchButtonText}>Search</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 18, 17, 0.28)',
    justifyContent: 'flex-start',
    paddingTop: 92,
    paddingHorizontal: theme.spacing.md,
  },
  backdropPress: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  inputRow: {
    minHeight: theme.button.height,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.background,
  },
  input: {
    flex: 1,
    color: theme.colors.text,
    fontSize: theme.typography.body,
  },
  recentWrap: {
    gap: theme.spacing.sm,
  },
  recentTitle: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.overline,
    textTransform: 'uppercase',
    letterSpacing: theme.typography.tracking.wide,
    fontWeight: '700',
  },
  recentList: {
    gap: theme.spacing.xs,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: 8,
  },
  recentText: {
    color: theme.colors.text,
    fontSize: theme.typography.caption,
  },
  searchButton: {
    minHeight: theme.button.height,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
  },
  searchButtonDisabled: {
    opacity: 0.45,
  },
  searchButtonText: {
    color: theme.colors.surface,
    fontSize: theme.typography.overline,
    textTransform: 'uppercase',
    letterSpacing: theme.typography.tracking.wide,
    fontWeight: '700',
  },
});
