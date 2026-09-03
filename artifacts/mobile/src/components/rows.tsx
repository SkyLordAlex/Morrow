import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, CheckCircle2 } from 'lucide-react-native';
import type { Assignment, StudySession } from '@workspace/api-client-react';
import { clockLabel, minutesLabel } from '@/format';
import { accentFor, colors, fonts, radius, spacing } from '@/theme';

export function SessionRow({
  session,
  onComplete,
  onReschedule,
  pending,
}: {
  session: StudySession;
  onComplete: () => void;
  onReschedule: () => void;
  pending: boolean;
}) {
  const isComplete = session.status === 'complete';

  return (
    <View style={[styles.row, isComplete && styles.rowComplete]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isComplete, disabled: isComplete || pending }}
        accessibilityLabel={
          isComplete ? `${session.title} complete` : `Complete ${session.title}`
        }
        disabled={isComplete || pending}
        onPress={onComplete}
        // Expand the tap area without growing the visual circle.
        hitSlop={10}
        style={({ pressed }) => [
          styles.checkbox,
          isComplete ? styles.checkboxOn : styles.checkboxOff,
          pressed && !isComplete && styles.checkboxPressed,
        ]}
      >
        <Check
          size={14}
          strokeWidth={3}
          color={isComplete ? colors.primaryForeground : 'transparent'}
        />
      </Pressable>

      <View style={styles.rowBody}>
        <Text
          numberOfLines={1}
          style={[styles.rowTitle, isComplete && styles.rowTitleDone]}
        >
          {session.title}
        </Text>
        <Text style={styles.rowMeta}>
          {session.subject} · {minutesLabel(session.durationMinutes)}
        </Text>
      </View>

      <Text style={styles.rowClock}>{clockLabel(session.startTime)}</Text>

      {!isComplete ? (
        // The web app revealed "Move" on hover. There is no hover on iOS, so
        // it is always visible but visually quiet.
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Move ${session.title} to another day`}
          onPress={onReschedule}
          hitSlop={8}
          style={({ pressed }) => [styles.moveChip, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.moveChipText}>Move</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function AssignmentRow({ assignment }: { assignment: Assignment }) {
  const tone = accentFor(assignment.accent);
  const progress = assignment.totalMinutes
    ? Math.min(
        100,
        Math.round((assignment.completedMinutes / assignment.totalMinutes) * 100),
      )
    : 0;
  const remaining = Math.max(
    0,
    assignment.totalMinutes - assignment.completedMinutes,
  );

  return (
    <View style={styles.row}>
      <View style={[styles.accentBar, { backgroundColor: tone.line }]} />

      <View style={styles.rowBody}>
        <View style={styles.titleRow}>
          <Text numberOfLines={1} style={styles.rowTitle}>
            {assignment.title}
          </Text>
          {assignment.status === 'at_risk' ? (
            <View style={styles.riskPill}>
              <Text style={styles.riskText}>AT RISK</Text>
            </View>
          ) : null}
          {assignment.status === 'complete' ? (
            <CheckCircle2 size={14} color={colors.primary} />
          ) : null}
        </View>

        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${progress}%`, backgroundColor: tone.ink },
              ]}
            />
          </View>
          <Text style={styles.progressText}>{progress}%</Text>
        </View>
      </View>

      <View style={styles.dueBlock}>
        <Text style={styles.dueLabel}>{assignment.dueLabel}</Text>
        <Text style={styles.dueRemaining}>{minutesLabel(remaining)} left</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
  },
  rowComplete: { opacity: 0.55 },
  checkbox: {
    height: 28,
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
  },
  checkboxOff: { borderColor: colors.border, backgroundColor: colors.background },
  checkboxOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  checkboxPressed: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(43, 105, 96, 0.1)',
  },
  accentBar: { height: 36, width: 4, borderRadius: 2 },
  rowBody: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowTitle: {
    flexShrink: 1,
    fontFamily: fonts.sansBold,
    fontSize: 13,
    color: colors.foreground,
  },
  rowTitleDone: {
    textDecorationLine: 'line-through',
    color: colors.mutedForeground,
  },
  rowMeta: {
    marginTop: 2,
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.mutedForeground,
  },
  rowClock: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.mutedForeground,
  },
  moveChip: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: colors.muted,
  },
  moveChipText: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    color: colors.mutedForeground,
  },
  riskPill: {
    borderRadius: radius.pill,
    backgroundColor: 'rgba(236, 129, 105, 0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  riskText: {
    fontFamily: fonts.sansHeavy,
    fontSize: 9,
    letterSpacing: 0.5,
    color: '#B84E49',
  },
  progressRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    overflow: 'hidden',
    borderRadius: 3,
    backgroundColor: colors.muted,
  },
  progressFill: { height: '100%', borderRadius: 3 },
  progressText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.mutedForeground,
  },
  dueBlock: { alignItems: 'flex-end' },
  dueLabel: { fontFamily: fonts.monoMedium, fontSize: 10, color: colors.foreground },
  dueRemaining: {
    marginTop: 4,
    fontFamily: fonts.sans,
    fontSize: 10,
    color: colors.mutedForeground,
  },
});
