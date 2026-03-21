import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { SectionLabel } from '../components/SectionLabel';
import { ScreenContainer } from '../components/ScreenContainer';
import { RootStackParamList } from '../navigation/AppNavigator';
import { theme } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

export function OnboardingScreen({ navigation }: Props) {
  return (
    <ScreenContainer>
      <View style={styles.header}>
        <SectionLabel>Welcome</SectionLabel>
        <Text style={styles.title}>Welcome to the Atelier</Text>
        <Text style={styles.subtitle}>Begin with a curated brand selection to shape your fashion feed.</Text>
      </View>

      <View style={styles.actions}>
        <AppButton label="Select Brands" onPress={() => navigation.navigate('BrandSelection')} />
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
    fontSize: theme.typography.display,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: theme.typography.tracking.tight,
  },
  subtitle: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted,
    lineHeight: 20,
    textTransform: 'uppercase',
    letterSpacing: theme.typography.tracking.wide,
    fontWeight: '600',
  },
  actions: {
    gap: theme.spacing.smd,
  },
});
