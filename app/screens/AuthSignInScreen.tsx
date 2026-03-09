import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ScreenContainer } from '../components/ScreenContainer';
import { useAuth } from '../providers/AuthProvider';
import { theme } from '../theme/theme';

type SignInMode = 'password' | 'magic-link';

export function AuthSignInScreen() {
  const { signInWithPassword, sendMagicLink } = useAuth();

  const [mode, setMode] = useState<SignInMode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setError(null);
    setMessage(null);
    setSubmitting(true);

    try {
      if (mode === 'password') {
        await signInWithPassword(email.trim(), password);
      } else {
        await sendMagicLink(email.trim());
        setMessage('Magic link sent. Check your email inbox.');
      }
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : 'Sign in failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenContainer>
      <Text style={styles.title}>Sign In</Text>
      <Text style={styles.subtitle}>Use password or request a magic link.</Text>

      <View style={styles.modeRow}>
        <Pressable
          style={[styles.modeButton, mode === 'password' ? styles.modeButtonActive : undefined]}
          onPress={() => setMode('password')}
        >
          <Text style={[styles.modeText, mode === 'password' ? styles.modeTextActive : undefined]}>Password</Text>
        </Pressable>
        <Pressable
          style={[styles.modeButton, mode === 'magic-link' ? styles.modeButtonActive : undefined]}
          onPress={() => setMode('magic-link')}
        >
          <Text style={[styles.modeText, mode === 'magic-link' ? styles.modeTextActive : undefined]}>
            Magic Link
          </Text>
        </Pressable>
      </View>

      <TextInput
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="you@example.com"
        placeholderTextColor={theme.colors.textMuted}
      />

      {mode === 'password' ? (
        <TextInput
          value={password}
          onChangeText={setPassword}
          style={styles.input}
          secureTextEntry
          placeholder="Password"
          placeholderTextColor={theme.colors.textMuted}
        />
      ) : null}

      <Pressable style={styles.submitButton} onPress={onSubmit} disabled={submitting}>
        {submitting ? (
          <ActivityIndicator color={theme.colors.surface} />
        ) : (
          <Text style={styles.submitText}>{mode === 'password' ? 'Sign In' : 'Send Magic Link'}</Text>
        )}
      </Pressable>

      {message ? <Text style={styles.message}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
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
  modeRow: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
    padding: 2,
  },
  modeButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.sm,
  },
  modeButtonActive: {
    backgroundColor: '#E8EEFF',
  },
  modeText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.overline,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  modeTextActive: {
    color: theme.colors.primary,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    minHeight: theme.button.height,
    marginBottom: theme.spacing.md,
    color: theme.colors.text,
    fontSize: theme.typography.body,
  },
  submitButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    minHeight: theme.button.height,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    color: theme.colors.surface,
    fontWeight: '700',
    fontSize: theme.typography.body,
  },
  message: {
    marginTop: theme.spacing.md,
    color: '#0F766E',
    fontSize: theme.typography.caption,
  },
  error: {
    marginTop: theme.spacing.md,
    color: '#B91C1C',
    fontSize: theme.typography.caption,
  },
});
