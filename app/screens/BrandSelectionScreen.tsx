import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ScreenContainer } from '../components/ScreenContainer';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../providers/AuthProvider';
import { fetchBrands } from '../services/brands';
import { fetchFollowedBrandIds, saveUserBrandFollows } from '../services/follows';
import { theme } from '../theme/theme';
import { Brand } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'BrandSelection'>;

export function BrandSelectionScreen({ navigation }: Props) {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }

    const userId = user.id;
    let isMounted = true;

    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const [fetchedBrands, followedBrandIds] = await Promise.all([
          fetchBrands({ activeOnly: true }),
          fetchFollowedBrandIds(userId),
        ]);

        if (!isMounted) {
          return;
        }

        setBrands(fetchedBrands);
        setSelectedBrandIds(followedBrandIds);
      } catch (loadError: unknown) {
        if (!isMounted) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : 'Failed to load brands');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const selectedSet = useMemo(() => new Set(selectedBrandIds), [selectedBrandIds]);

  function toggleBrand(brandId: string): void {
    setSelectedBrandIds((prev) => {
      if (prev.includes(brandId)) {
        return prev.filter((id) => id !== brandId);
      }
      return [...prev, brandId];
    });
  }

  async function onContinue(): Promise<void> {
    if (!user || selectedBrandIds.length === 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await saveUserBrandFollows(user.id, selectedBrandIds);
      navigation.navigate('HomeFeed');
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save selected brands');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenContainer>
      <Text style={styles.title}>Choose Your Brands</Text>
      <Text style={styles.subtitle}>Select the labels you want in your feed.</Text>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.centerStateText}>Loading brands...</Text>
        </View>
      ) : (
        <FlatList
          data={brands}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const selected = selectedSet.has(item.id);

            return (
              <Pressable
                onPress={() => toggleBrand(item.id)}
                style={[styles.brandCard, selected ? styles.brandCardSelected : undefined]}
              >
                <View>
                  <Text style={styles.brandName}>{item.name}</Text>
                  <Text style={styles.brandDomain}>{item.domain}</Text>
                </View>
                <View style={[styles.checkDot, selected ? styles.checkDotSelected : undefined]} />
              </Pressable>
            );
          }}
        />
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Pressable
        onPress={() => void onContinue()}
        disabled={selectedBrandIds.length === 0 || saving || loading}
        style={[
          styles.continueButton,
          selectedBrandIds.length === 0 || saving || loading ? styles.continueButtonDisabled : undefined,
        ]}
      >
        {saving ? (
          <ActivityIndicator color={theme.colors.surface} />
        ) : (
          <Text style={styles.continueButtonText}>Continue ({selectedBrandIds.length})</Text>
        )}
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: theme.typography.title,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: theme.typography.body,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.md,
  },
  listContent: {
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.smd,
  },
  brandCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.smd,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandCardSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: '#EEF3FF',
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
  checkDot: {
    width: 20,
    height: 20,
    borderRadius: theme.radius.pill,
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  checkDotSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerStateText: {
    marginTop: theme.spacing.sm,
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: theme.typography.body,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  continueButton: {
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    minHeight: theme.button.height,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.45,
  },
  continueButtonText: {
    color: theme.colors.surface,
    fontSize: theme.typography.body,
    fontWeight: '700',
  },
});
