import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, Clock3, MoveRight, TimerReset } from 'lucide-react-native';
import type { PlannerDashboard } from '@workspace/api-client-react';
import { clockLabel, minutesLabel } from '@/format';
import { colors, fonts, radius, shadow, spacing } from '@/theme';
import { PrimaryButton } from './ui';

type Focus = PlannerDashboard['todayFocus'];

export function FocusCard({
  focus,
  onComplete,
  onReschedule,
  pending,
}: {
  focus: Focus;
  onComplete: () => void;
  onReschedule: () => void;
  pending: boolean;
}) {
  if (!focus) {
    return (
      <View style={styles.shell}>
        <View style={styles.ringLarge} pointerEvents="none" />
        <Text style={styles.kicker}>TODAY&apos;S FOCUS</Text>
        <Text style={styles.title}>You have room to breathe.</Text>
        <Text style={styles.body}>
          Nothing is scheduled here yet. Make a plan when you&apos;re ready, and
          we&apos;ll find a gentle place to begin.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.shell}>
      <View style={styles.ringLarge} pointerEvents="none" />
      <View style={styles.ringSmall} pointerEvents="none" />

      <View style={styles.kickerRow}>
        <Text style={styles.kicker}>YOUR NEXT STEP</Text>
        <View style={styles.kickerRule} />
      </View>

      <Text style={styles.title}>{focus.title}</Text>
      <Text style={styles.body}>{focus.context}</Text>

      <View style={styles.metaRow}>
        <View style={styles.meta}>
          <Clock3 size={14} color={colors.secondary} />
          <Text style={styles.metaText}>{clockLabel(focus.startTime)}</Text>
        </View>
        <View style={styles.meta}>
          <TimerReset size={14} color={colors.secondary} />
          <Text style={styles.metaText}>
            {minutesLabel(focus.durationMinutes)}
          </Text>
        </View>
        <View style={styles.subjectPill}>
          <Text style={styles.subjectText}>{focus.subject}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          tone="secondary"
          label="Mark complete"
          loading={pending}
          onPress={onComplete}
          icon={<CheckCircle2 size={16} color={colors.secondaryForeground} />}
          style={styles.completeButton}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Move this session to another day"
          onPress={onReschedule}
          style={({ pressed }) => [styles.moveButton, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.moveLabel}>Move this session</Text>
          <MoveRight size={14} color="rgba(255, 252, 240, 0.7)" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    overflow: 'hidden',
    borderRadius: radius.xxl,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xxl,
    ...shadow.raised,
  },
  // The web version draws two decorative rings with border-radius. RN has no
  // negative-inset absolute helper, so they are positioned explicitly.
  ringLarge: {
    position: 'absolute',
    right: -56,
    top: -80,
    height: 224,
    width: 224,
    borderRadius: 112,
    borderWidth: 27,
    borderColor: 'rgba(249, 192, 88, 0.15)',
  },
  ringSmall: {
    position: 'absolute',
    right: 96,
    bottom: -96,
    height: 176,
    width: 176,
    borderRadius: 88,
    borderWidth: 1,
    borderColor: 'rgba(249, 192, 88, 0.10)',
  },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  kicker: {
    fontFamily: fonts.monoMedium,
    fontSize: 10,
    letterSpacing: 1.9,
    color: 'rgba(255, 252, 240, 0.6)',
  },
  kickerRule: {
    height: 1,
    width: 32,
    backgroundColor: 'rgba(249, 192, 88, 0.6)',
  },
  title: {
    marginTop: spacing.lg,
    fontFamily: fonts.serifSemi,
    fontSize: 34,
    lineHeight: 36,
    color: colors.primaryForeground,
  },
  body: {
    marginTop: spacing.md,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 22,
    color: 'rgba(255, 252, 240, 0.68)',
  },
  metaRow: {
    marginTop: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: 'rgba(255, 252, 240, 0.72)',
  },
  subjectPill: {
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 252, 240, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  subjectText: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    color: 'rgba(255, 252, 240, 0.85)',
  },
  actions: { marginTop: spacing.xxl, gap: spacing.sm },
  completeButton: { alignSelf: 'stretch' },
  moveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
  },
  moveLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    color: 'rgba(255, 252, 240, 0.7)',
  },
});
