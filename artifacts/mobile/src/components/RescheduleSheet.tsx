import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarDays, X } from 'lucide-react-native';
import type { StudySession } from '@workspace/api-client-react';
import { addDaysKey, dateKey, formatDate } from '@/format';
import { colors, fonts, radius, spacing } from '@/theme';
import { PrimaryButton } from './ui';

// The web app used <input type="date">, which has no React Native equivalent.
// Rather than pull in a date-picker dependency, this offers the handful of
// choices that actually matter for moving a study session — which is also
// faster on a phone than spinning a wheel picker.
const OFFSETS = [
  { label: 'Tomorrow', days: 1 },
  { label: 'In 2 days', days: 2 },
  { label: 'In 3 days', days: 3 },
  { label: 'Next week', days: 7 },
] as const;

export function RescheduleSheet({
  session,
  onClose,
  onConfirm,
  pending,
}: {
  session: StudySession | null;
  onClose: () => void;
  onConfirm: (date: string) => void;
  pending: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string>('');

  // Reset the selection whenever a different session is opened, otherwise the
  // sheet reopens showing the previous session's date.
  useEffect(() => {
    if (session) setSelected(addDaysKey(dateKey(session.date), 1));
  }, [session]);

  if (!session) return null;

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
    >
      <View style={styles.backdrop}>
        <Pressable
          accessibilityLabel="Dismiss"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />

        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
          <View style={styles.grabber} />

          <View style={styles.header}>
            <View style={styles.headerText}>
              <View style={styles.headerRow}>
                <CalendarDays size={16} color={colors.primary} />
                <Text style={styles.eyebrow}>MOVE THIS SESSION</Text>
              </View>
              <Text style={styles.title} numberOfLines={2}>
                {session.title}
              </Text>
              <Text style={styles.subtitle}>
                Currently {formatDate(session.date)}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              hitSlop={10}
              style={styles.close}
            >
              <X size={16} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <View style={styles.options}>
            {OFFSETS.map((option) => {
              const value = addDaysKey(dateKey(session.date), option.days);
              const active = value === selected;
              return (
                <Pressable
                  key={option.label}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  onPress={() => setSelected(value)}
                  style={[styles.option, active && styles.optionActive]}
                >
                  <Text
                    style={[styles.optionLabel, active && styles.optionLabelActive]}
                  >
                    {option.label}
                  </Text>
                  <Text
                    style={[styles.optionDate, active && styles.optionDateActive]}
                  >
                    {formatDate(value)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <PrimaryButton
            label={pending ? 'Moving…' : 'Move session'}
            loading={pending}
            onPress={() => selected && onConfirm(selected)}
            disabled={!selected}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(34, 63, 59, 0.35)',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  grabber: {
    alignSelf: 'center',
    height: 4,
    width: 40,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.lg,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  headerText: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyebrow: {
    fontFamily: fonts.monoMedium,
    fontSize: 10,
    letterSpacing: 1.7,
    color: colors.primary,
  },
  title: {
    marginTop: spacing.sm,
    fontFamily: fonts.serifSemi,
    fontSize: 24,
    color: colors.foreground,
  },
  subtitle: {
    marginTop: 4,
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.mutedForeground,
  },
  close: {
    height: 32,
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors.muted,
  },
  options: { marginTop: spacing.xl, marginBottom: spacing.xl, gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },
  optionActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(43, 105, 96, 0.08)',
  },
  optionLabel: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.foreground },
  optionLabelActive: { color: colors.primary },
  optionDate: { fontFamily: fonts.mono, fontSize: 11, color: colors.mutedForeground },
  optionDateActive: { color: colors.primary },
});
