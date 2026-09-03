import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/auth-context';
import { Card, PrimaryButton, SectionHeading } from '@/components/ui';
import { colors, fonts, radius, spacing } from '@/theme';

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut, deleteAccount } = useAuth();
  const [busy, setBusy] = useState(false);

  const confirmDelete = () => {
    Alert.alert(
      'Delete your account?',
      'This permanently removes your account and every assignment, task, and study session tied to it. This can’t be undone.',
      [
        { text: 'Keep my account', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: () => {
            setBusy(true);
            deleteAccount().catch((error) => {
              setBusy(false);
              Alert.alert('Could not delete account', String(error));
            });
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.lg },
      ]}
    >
      <SectionHeading eyebrow="Signed in as" title="Your account" />

      <Card style={styles.card}>
        <Text style={styles.label}>Name</Text>
        <Text style={styles.value}>{user?.displayName || '—'}</Text>
        <View style={styles.rule} />
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{user?.email ?? '—'}</Text>
      </Card>

      <PrimaryButton
        label="Sign out"
        tone="secondary"
        onPress={() => void signOut()}
        disabled={busy}
        style={styles.action}
      />

      <PrimaryButton
        label="Delete account"
        onPress={confirmDelete}
        loading={busy}
        style={[styles.action, styles.destructive]}
      />
      <Text style={styles.hint}>
        Deleting your account erases all of your data from the server right away.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl * 2,
  },
  card: { paddingVertical: spacing.lg },
  label: {
    fontFamily: fonts.monoMedium,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.mutedForeground,
  },
  value: {
    marginTop: 4,
    fontFamily: fonts.sansBold,
    fontSize: 15,
    color: colors.foreground,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  action: { marginTop: spacing.lg, alignSelf: 'stretch' },
  destructive: { backgroundColor: colors.destructive, borderRadius: radius.md },
  hint: {
    marginTop: spacing.sm,
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 18,
    color: colors.mutedForeground,
  },
});
