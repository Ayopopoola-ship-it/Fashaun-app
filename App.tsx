import 'react-native-gesture-handler';

import { LinkingOptions, NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppNavigator } from './app/navigation/AppNavigator';
import { AuthNavigator } from './app/navigation/AuthNavigator';
import { AuthProvider, useAuth } from './app/providers/AuthProvider';
import { initializeAnalytics } from './app/services/analytics';
import { theme } from './app/theme/theme';

const linking: LinkingOptions<any> = {
  prefixes: ['fashaun://'],
  config: {
    screens: {
      SignIn: 'signin',
      BrandRequestDetails: 'request/:requestId',
      RequestBrands: 'request-brand',
      Leaderboard: 'leaderboard',
      History: 'history',
    },
  },
};

function RootNavigator() {
  const { loading, session } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Checking session...</Text>
      </View>
    );
  }

  return session ? <AppNavigator /> : <AuthNavigator />;
}

export default function App() {
  useEffect(() => {
    initializeAnalytics();
  }, []);

  return (
    <AuthProvider>
      <NavigationContainer linking={linking}>
        <StatusBar style="dark" />
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    color: theme.colors.textMuted,
    fontSize: theme.typography.body,
  },
});
