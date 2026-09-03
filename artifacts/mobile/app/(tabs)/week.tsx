import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getGetPlannerDashboardQueryKey,
  useGetPlannerDashboard,
} from '@workspace/api-client-react';

import { StreakCard, Workload } from '@/components/Workload';
import { SectionHeading } from '@/components/ui';
import { colors, fonts, spacing } from '@/theme';

export default function WeekScreen() {
  const insets = useSafeAreaInsets();
  const dashboardQuery = useGetPlannerDashboard({
    query: { queryKey: getGetPlannerDashboardQueryKey() },
  });

  if (dashboardQuery.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const dashboard = dashboardQuery.data;

  if (!dashboard) {
    return (
      <View style={styles.center}>
        <Text style={styles.centerText}>We couldn&apos;t load your week.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
      refreshControl={
        <RefreshControl
          refreshing={dashboardQuery.isRefetching}
          onRefresh={() => dashboardQuery.refetch()}
          tintColor={colors.primary}
        />
      }
    >
      <SectionHeading eyebrow="Minutes, not guilt" title="A week you can see" />
      <Workload days={dashboard.workload ?? []} />
      <View style={styles.spacer} />
      <StreakCard
        totalMinutesThisWeek={dashboard.totalMinutesThisWeek}
        completedSessions={dashboard.completedSessions}
        streakDays={dashboard.streakDays}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl * 2 },
  spacer: { height: spacing.lg },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  centerText: { fontFamily: fonts.sans, fontSize: 14, color: colors.mutedForeground },
});
