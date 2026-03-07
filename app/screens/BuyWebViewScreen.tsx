import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { RootStackParamList } from '../navigation/AppNavigator';
import { theme } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'BuyWebView'>;

export function BuyWebViewScreen({ route, navigation }: Props) {
  const { productUrl } = route.params;
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable
          style={styles.topButton}
          onPress={() => {
            if (canGoBack) {
              webViewRef.current?.goBack();
            } else {
              navigation.goBack();
            }
          }}
        >
          <Text style={styles.topButtonText}>{canGoBack ? 'Back' : 'Close'}</Text>
        </Pressable>
        <Text style={styles.topTitle}>Brand Site</Text>
        <Pressable style={styles.topButton} onPress={() => navigation.goBack()}>
          <Text style={styles.topButtonText}>Close</Text>
        </Pressable>
      </View>

      <WebView
        ref={webViewRef}
        source={{ uri: productUrl }}
        onNavigationStateChange={(state: { canGoBack: boolean }) => setCanGoBack(state.canGoBack)}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loaderContainer}>
            <ActivityIndicator color={theme.colors.primary} />
            <Text style={styles.loaderText}>Loading brand page...</Text>
          </View>
        )}
      />

      <Pressable style={styles.floatingCloseButton} onPress={() => navigation.goBack()}>
        <Text style={styles.floatingCloseButtonText}>X</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  topButton: {
    minWidth: 56,
    alignItems: 'center',
  },
  topButtonText: {
    color: theme.colors.primary,
    fontSize: theme.typography.caption,
    fontWeight: '700',
  },
  topTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.caption,
    fontWeight: '700',
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  loaderText: {
    marginTop: theme.spacing.sm,
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
  },
  floatingCloseButton: {
    position: 'absolute',
    left: theme.spacing.md,
    bottom: theme.spacing.xl,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  floatingCloseButtonText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
});
