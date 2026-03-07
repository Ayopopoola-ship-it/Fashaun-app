import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text } from 'react-native';

import { ScreenContainer } from '../components/ScreenContainer';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../providers/AuthProvider';
import { theme } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

export function OnboardingScreen({ navigation }: Props) {
  const { signOut } = useAuth();

  return (
    <ScreenContainer>
      <Text style={styles.title}>Onboarding</Text>
      <Text style={styles.subtitle}>Set your style profile by selecting brands you love.</Text>

      <Pressable style={styles.primaryButton} onPress={() => navigation.navigate('BrandSelection')}>
        <Text style={styles.primaryButtonText}>Select Brands</Text>
      </Pressable>

      <Pressable style={styles.signOutButton} onPress={() => signOut()}>
        <Text style={styles.signOutButtonText}>Sign Out</Text>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: theme.typography.title,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.typography.body,
    color: theme.colors.textMuted,
  },
  primaryButton: {
    marginTop: theme.spacing.lg,
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  primaryButtonText: {
    color: theme.colors.surface,
    fontWeight: '700',
    fontSize: theme.typography.caption,
  },
  signOutButton: {
    marginTop: theme.spacing.md,
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  signOutButtonText: {
    color: theme.colors.text,
    fontWeight: '600',
    fontSize: theme.typography.caption,
  },
});
