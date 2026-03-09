import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ScreenContainer } from '../components/ScreenContainer';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../providers/AuthProvider';
import { theme } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

export function OnboardingScreen({ navigation }: Props) {
  const { signOut } = useAuth();

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.title}>Welcome to Fashaun</Text>
        <Text style={styles.subtitle}>Set your style profile by selecting brands you love.</Text>
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.primaryButton} onPress={() => navigation.navigate('BrandSelection')}>
          <Text style={styles.primaryButtonText}>Select Brands</Text>
        </Pressable>

        <Pressable style={styles.signOutButton} onPress={() => signOut()}>
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
  },
  title: {
    fontSize: theme.typography.title,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: theme.typography.body,
    color: theme.colors.textMuted,
    lineHeight: 23,
  },
  actions: {
    gap: theme.spacing.smd,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    minHeight: theme.button.height,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: theme.colors.surface,
    fontWeight: '700',
    fontSize: theme.typography.body,
  },
  signOutButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    minHeight: theme.button.height,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutButtonText: {
    color: theme.colors.text,
    fontWeight: '600',
    fontSize: theme.typography.body,
  },
});
