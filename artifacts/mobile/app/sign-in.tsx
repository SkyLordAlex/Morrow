import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';

import { useAuth } from '@/auth/auth-context';
import { useGoogleSignIn } from '@/auth/google';
import { Divider, PrimaryButton } from '@/components/ui';
import { colors, fonts, radius, spacing } from '@/theme';

function messageFor(error: unknown): string {
  if (error && typeof error === 'object') {
    const data = (error as { data?: { error?: unknown } }).data;
    if (data && typeof data.error === 'string') return data.error;
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return 'Something went wrong. Try again.';
}

type Mode = 'signin' | 'register';

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const {
    signInWithPassword,
    registerAccount,
    signInWithApple,
    signInWithGoogle,
  } = useAuth();

  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    AppleAuthentication.isAvailableAsync()
      .then(setAppleAvailable)
      .catch(() => setAppleAvailable(false));
  }, []);

  const run = useCallback(async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setBusy(false);
    }
  }, []);

  const onGoogleToken = useCallback(
    (idToken: string) => void run(() => signInWithGoogle(idToken)),
    [run, signInWithGoogle],
  );
  const google = useGoogleSignIn(onGoogleToken, setError);

  const submitPassword = () => {
    if (busy) return;
    void run(() =>
      mode === 'signin'
        ? signInWithPassword(email, password)
        : registerAccount(email, password, name),
    );
  };

  const onApple = () =>
    void run(async () => {
      try {
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
        });
        if (!credential.identityToken) {
          throw new Error('Apple did not return an identity token.');
        }
        await signInWithApple(credential.identityToken);
      } catch (caught) {
        if (
          caught &&
          typeof caught === 'object' &&
          (caught as { code?: string }).code === 'ERR_REQUEST_CANCELED'
        ) {
          return;
        }
        throw caught;
      }
    });

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logo}>
          <Text style={styles.logoMark}>M</Text>
        </View>
        <Text style={styles.title}>
          {mode === 'signin' ? 'Welcome back' : 'Create your account'}
        </Text>
        <Text style={styles.subtitle}>
          {mode === 'signin'
            ? 'Sign in to pick up your plan.'
            : 'A few small steps, kept in one place.'}
        </Text>

        {mode === 'register' ? (
          <Field
            label="Name"
            value={name}
            onChangeText={setName}
            autoComplete="name"
            placeholder="Ada"
          />
        ) : null}
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoComplete="email"
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="you@school.edu"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PrimaryButton
          label={mode === 'signin' ? 'Sign in' : 'Create account'}
          onPress={submitPassword}
          loading={busy}
          style={styles.submit}
        />

        {(appleAvailable || google.available) && (
          <View style={styles.dividerRow}>
            <Divider />
            <Text style={styles.dividerText}>or</Text>
            <Divider />
          </View>
        )}

        {appleAvailable ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={
              mode === 'signin'
                ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                : AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
            }
            buttonStyle={
              AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={radius.md}
            style={styles.appleButton}
            onPress={onApple}
          />
        ) : null}

        {google.available ? (
          <PrimaryButton
            label="Continue with Google"
            tone="secondary"
            onPress={() => void google.promptAsync()}
            style={styles.socialButton}
          />
        ) : null}

        <Pressable
          onPress={() => {
            setMode(mode === 'signin' ? 'register' : 'signin');
            setError(null);
          }}
          style={styles.toggle}
          accessibilityRole="button"
        >
          <Text style={styles.toggleText}>
            {mode === 'signin'
              ? "Don't have an account? "
              : 'Already have an account? '}
            <Text style={styles.toggleAction}>
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </Text>
          </Text>
        </Pressable>

        <Text style={styles.legal}>
          By continuing you agree to our Terms of Use and Privacy Policy.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  ...inputProps
}: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...inputProps}
        placeholderTextColor={colors.mutedForeground}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl * 2,
  },
  logo: {
    alignSelf: 'center',
    height: 44,
    width: 44,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoMark: {
    fontFamily: fonts.serifSemi,
    fontSize: 24,
    color: colors.primaryForeground,
  },
  title: {
    marginTop: spacing.lg,
    textAlign: 'center',
    fontFamily: fonts.serifSemi,
    fontSize: 30,
    color: colors.foreground,
  },
  subtitle: {
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    textAlign: 'center',
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.mutedForeground,
  },
  field: { marginBottom: spacing.md },
  fieldLabel: {
    marginBottom: 6,
    fontFamily: fonts.sansBold,
    fontSize: 12,
    color: colors.foreground,
  },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.foreground,
  },
  error: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    fontFamily: fonts.sansBold,
    fontSize: 12,
    color: colors.destructive,
  },
  submit: { marginTop: spacing.md },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.xl,
  },
  dividerText: {
    fontFamily: fonts.monoMedium,
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.mutedForeground,
  },
  appleButton: { height: 48, marginBottom: spacing.sm },
  socialButton: { marginBottom: spacing.sm },
  toggle: { marginTop: spacing.xl, alignItems: 'center' },
  toggleText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.mutedForeground,
  },
  toggleAction: { fontFamily: fonts.sansHeavy, color: colors.primary },
  legal: {
    marginTop: spacing.xl,
    textAlign: 'center',
    fontFamily: fonts.sans,
    fontSize: 11,
    lineHeight: 16,
    color: colors.mutedForeground,
  },
});
