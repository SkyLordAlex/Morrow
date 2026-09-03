import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCcw, Target } from 'lucide-react-native';
import {
  getGetPlannerDashboardQueryKey,
  useCompleteStudySession,
  useGetPlannerDashboard,
  useRescheduleStudySession,
  type StudySession,
} from '@workspace/api-client-react';

import { FocusCard } from '@/components/FocusCard';
import { RescheduleSheet } from '@/components/RescheduleSheet';
import { SessionRow } from '@/components/rows';
import { Card, EmptyState, PrimaryButton, SectionHeading } from '@/components/ui';
import { colors, fonts, radius, spacing } from '@/theme';

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [rescheduleTarget, setRescheduleTarget] = useState<StudySession | null>(
    null,
  );

  const dashboardQuery = useGetPlannerDashboard({
    query: { queryKey: getGetPlannerDashboardQueryKey() },
  });
  const completeSession = useCompleteStudySession();
  const rescheduleSession = useRescheduleStudySession();

  const invalidateDashboard = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getGetPlannerDashboardQueryKey() });
  }, [queryClient]);

  const complete = (id: number) => {
    completeSession.mutate({ id }, { onSuccess: invalidateDashboard });
  };

  const confirmReschedule = (date: string) => {
    if (!rescheduleTarget) return;
    rescheduleSession.mutate(
      { id: rescheduleTarget.id, data: { date } },
      {
        onSuccess: () => {
          setRescheduleTarget(null);
          invalidateDashboard();
        },
      },
    );
  };

  if (dashboardQuery.isLoading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.centerText}>Gathering your day…</Text>
      </View>
    );
  }

  const dashboard = dashboardQuery.data;

  if (dashboardQuery.isError || !dashboard) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <View style={styles.errorIcon}>
          <RefreshCcw size={20} color={colors.accent} />
        </View>
        <Text style={styles.errorTitle}>The plan took a breather.</Text>
        <Text style={styles.errorBody}>
          We couldn&apos;t load your day. Your work is safe — give it another try.
        </Text>
        <PrimaryButton
          label="Try again"
          onPress={() => dashboardQuery.refetch()}
          style={styles.errorButton}
        />
      </View>
    );
  }

  const todaySessions = dashboard.todaySessions ?? [];

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.lg },
        ]}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          // Pull-to-refresh replaces the web app's "Planner ready" health chip
          // and manual retry — it's the expected native gesture.
          <RefreshControl
            refreshing={dashboardQuery.isRefetching}
            onRefresh={() => dashboardQuery.refetch()}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={styles.dateLabel}>{dashboard.dateLabel.toUpperCase()}</Text>
        <Text style={styles.greeting}>{dashboard.greeting}</Text>
        <Text style={styles.subGreeting}>
          Let&apos;s make the next hour feel a little more possible.
        </Text>

        <PrimaryButton
          label="Make a plan"
          onPress={() => router.push('/plan')}
          icon={<Plus size={16} color={colors.primaryForeground} />}
          style={styles.planButton}
        />

        <View style={styles.section}>
          <FocusCard
            focus={dashboard.todayFocus}
            pending={completeSession.isPending}
            onComplete={() =>
              dashboard.todayFocus && complete(dashboard.todayFocus.sessionId)
            }
            onReschedule={() => {
              if (!dashboard.todayFocus) return;
              const match = todaySessions.find(
                (session) => session.id === dashboard.todayFocus?.sessionId,
              );
              if (match) setRescheduleTarget(match);
            }}
          />
        </View>

        <View style={styles.section}>
          <SectionHeading eyebrow="On the desk today" title="Your sessions" />
          <Card>
            {todaySessions.length ? (
              todaySessions.map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  pending={completeSession.isPending}
                  onComplete={() => complete(session.id)}
                  onReschedule={() => setRescheduleTarget(session)}
                />
              ))
            ) : (
              <EmptyState
                icon={<Target size={16} color={colors.primary} />}
                title="A clear day is a good day."
                body="Make a plan to turn one of your deadlines into a next action."
              />
            )}
          </Card>
        </View>
      </ScrollView>

      <RescheduleSheet
        session={rescheduleTarget}
        pending={rescheduleSession.isPending}
        onClose={() => setRescheduleTarget(null)}
        onConfirm={confirmReschedule}
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl * 2,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xxl,
  },
  centerText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.mutedForeground,
  },
  dateLabel: {
    fontFamily: fonts.monoMedium,
    fontSize: 10,
    letterSpacing: 1.9,
    color: colors.primary,
  },
  greeting: {
    marginTop: spacing.sm,
    fontFamily: fonts.serifSemi,
    fontSize: 42,
    lineHeight: 44,
    color: colors.foreground,
  },
  subGreeting: {
    marginTop: spacing.md,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 22,
    color: colors.mutedForeground,
  },
  planButton: { marginTop: spacing.xl },
  section: { marginTop: spacing.xxl },
  errorIcon: {
    height: 48,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: 'rgba(236, 129, 105, 0.15)',
  },
  errorTitle: {
    fontFamily: fonts.serifSemi,
    fontSize: 28,
    textAlign: 'center',
    color: colors.foreground,
  },
  errorBody: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    color: colors.mutedForeground,
  },
  errorButton: { marginTop: spacing.sm, alignSelf: 'stretch' },
});
