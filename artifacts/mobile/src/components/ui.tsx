import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, fonts, radius, shadow, spacing } from '@/theme';

export function Eyebrow({ children }: { children: ReactNode }) {
  return <Text style={styles.eyebrow}>{String(children).toUpperCase()}</Text>;
}

export function SectionHeading({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <View style={styles.heading}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <Text style={styles.headingTitle}>{title}</Text>
    </View>
  );
}

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function EmptyState({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>{icon}</View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  icon,
  loading,
  disabled,
  tone = 'primary',
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  tone?: 'primary' | 'secondary';
  style?: StyleProp<ViewStyle>;
}) {
  const isSecondary = tone === 'secondary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled || loading) }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        isSecondary ? styles.buttonSecondary : styles.buttonPrimary,
        // iOS convention: press feedback is opacity + a slight sink, not a
        // hover lift like the web version used.
        pressed && styles.buttonPressed,
        (disabled || loading) && styles.buttonDisabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={isSecondary ? colors.secondaryForeground : colors.primaryForeground}
        />
      ) : (
        icon
      )}
      <Text
        style={[
          styles.buttonLabel,
          isSecondary ? styles.buttonLabelSecondary : styles.buttonLabelPrimary,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  eyebrow: {
    fontFamily: fonts.monoMedium,
    fontSize: 10,
    letterSpacing: 1.7,
    color: colors.mutedForeground,
  },
  heading: {
    marginBottom: spacing.lg,
  },
  headingTitle: {
    marginTop: 6,
    fontFamily: fonts.serifSemi,
    fontSize: 26,
    color: colors.foreground,
  },
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.xl,
    ...shadow.card,
  },
  empty: {
    minHeight: 174,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
  },
  emptyIcon: {
    height: 40,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: 'rgba(249, 192, 88, 0.2)',
  },
  emptyTitle: {
    marginTop: spacing.md,
    fontFamily: fonts.sansBold,
    fontSize: 14,
    color: colors.foreground,
  },
  emptyBody: {
    marginTop: spacing.xs,
    maxWidth: 260,
    textAlign: 'center',
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 18,
    color: colors.mutedForeground,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    // 48pt tall clears Apple's 44pt minimum touch target.
    paddingVertical: 14,
    minHeight: 48,
  },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonSecondary: { backgroundColor: colors.secondary },
  buttonPressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  buttonDisabled: { opacity: 0.5 },
  buttonLabel: { fontFamily: fonts.sansHeavy, fontSize: 13 },
  buttonLabelPrimary: { color: colors.primaryForeground },
  buttonLabelSecondary: { color: colors.secondaryForeground },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderSoft,
  },
});
