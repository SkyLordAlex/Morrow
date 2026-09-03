import { StyleSheet, Text, View } from 'react-native';
import { CalendarDays, Flame, Leaf } from 'lucide-react-native';
import type { PlannerDashboard } from '@workspace/api-client-react';
import { dateKey, minutesLabel } from '@/format';
import { colors, fonts, radius, shadow, spacing } from '@/theme';

export function Workload({ days }: { days: PlannerDashboard['workload'] }) {
  const maxMinutes = Math.max(...days.map((day) => day.minutes), 1);

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View>
          <Text style={styles.eyebrow}>THE WEEK AHEAD</Text>
          <Text style={styles.cardTitle}>Your rhythm</Text>
        </View>
        <View style={styles.iconBadge}>
          <CalendarDays size={16} color={colors.primary} />
        </View>
      </View>

      {days.length ? (
        <View style={styles.chart}>
          {days.map((day) => {
            // Floor at 9% so an empty day still reads as a bar, not a gap.
            const heightPct = Math.max(9, (day.minutes / maxMinutes) * 100);
            return (
              <View key={dateKey(day.date)} style={styles.barColumn}>
                <Text style={styles.barValue}>
                  {day.minutes ? minutesLabel(day.minutes) : '—'}
                </Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: `${heightPct}%`,
                        backgroundColor: day.isToday
                          ? colors.secondary
                          : 'rgba(43, 105, 96, 0.25)',
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[styles.barLabel, day.isToday && styles.barLabelToday]}
                >
                  {day.dayLabel}
                </Text>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.chartEmpty}>
          <Text style={styles.chartEmptyText}>
            Your rhythm will appear here once a few sessions are on the calendar.
          </Text>
        </View>
      )}
    </View>
  );
}

export function StreakCard({
  totalMinutesThisWeek,
  completedSessions,
  streakDays,
}: {
  totalMinutesThisWeek: number;
  completedSessions: number;
  streakDays: number;
}) {
  return (
    <View style={styles.streakCard}>
      <View style={styles.cardHead}>
        <View>
          <Text style={styles.streakEyebrow}>YOUR QUIET PROGRESS</Text>
          <Text style={styles.streakTitle}>Keep the thread.</Text>
        </View>
        <Flame size={20} color={colors.secondary} />
      </View>

      <View style={styles.stats}>
        <Stat
          value={minutesLabel(totalMinutesThisWeek)}
          label="planned this week"
          highlight
        />
        <View style={styles.statDivider} />
        <Stat value={String(completedSessions)} label="sessions complete" />
        <View style={styles.statDivider} />
        <Stat value={String(streakDays)} label="day streak" highlight />
      </View>

      <View style={styles.streakFooter}>
        <Leaf size={14} color={colors.secondary} />
        <Text style={styles.streakFooterText}>Consistency beats catching up.</Text>
      </View>
    </View>
  );
}

function Stat({
  value,
  label,
  highlight,
}: {
  value: string;
  label: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.stat}>
      <Text
        style={[styles.statValue, highlight && { color: colors.secondary }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    padding: spacing.xl,
    ...shadow.card,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  eyebrow: {
    fontFamily: fonts.monoMedium,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.mutedForeground,
  },
  cardTitle: {
    marginTop: 4,
    fontFamily: fonts.serifSemi,
    fontSize: 23,
    color: colors.foreground,
  },
  iconBadge: {
    height: 32,
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: 'rgba(249, 192, 88, 0.25)',
  },
  chart: {
    marginTop: spacing.xxl,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  barColumn: { flex: 1, alignItems: 'center', gap: spacing.sm },
  barValue: { fontFamily: fonts.mono, fontSize: 9, color: colors.mutedForeground },
  barTrack: {
    height: 84,
    width: '100%',
    justifyContent: 'flex-end',
    borderRadius: radius.sm,
    backgroundColor: 'rgba(221, 233, 230, 0.7)',
  },
  barFill: { width: '100%', borderRadius: radius.sm },
  barLabel: { fontFamily: fonts.sansBold, fontSize: 10, color: colors.mutedForeground },
  barLabelToday: { color: colors.primary },
  chartEmpty: {
    marginTop: spacing.xxl,
    height: 134,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: 'rgba(221, 233, 230, 0.45)',
  },
  chartEmptyText: {
    maxWidth: 220,
    textAlign: 'center',
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 20,
    color: colors.mutedForeground,
  },
  streakCard: {
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    padding: spacing.xl,
    ...shadow.card,
  },
  streakEyebrow: {
    fontFamily: fonts.monoMedium,
    fontSize: 10,
    letterSpacing: 1.6,
    color: 'rgba(255, 252, 240, 0.55)',
  },
  streakTitle: {
    marginTop: spacing.sm,
    fontFamily: fonts.serifSemi,
    fontSize: 27,
    color: colors.primaryForeground,
  },
  stats: { marginTop: spacing.xxl, flexDirection: 'row', alignItems: 'stretch' },
  stat: { flex: 1, paddingHorizontal: spacing.sm },
  statDivider: { width: 1, backgroundColor: 'rgba(255, 252, 240, 0.15)' },
  statValue: {
    fontFamily: fonts.serifSemi,
    fontSize: 28,
    color: colors.primaryForeground,
  },
  statLabel: {
    marginTop: 4,
    fontFamily: fonts.sans,
    fontSize: 10,
    color: 'rgba(255, 252, 240, 0.55)',
  },
  streakFooter: {
    marginTop: spacing.xxl,
    paddingTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 252, 240, 0.15)',
  },
  streakFooterText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: 'rgba(255, 252, 240, 0.65)',
  },
});
