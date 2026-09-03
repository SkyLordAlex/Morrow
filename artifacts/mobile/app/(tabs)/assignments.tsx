import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Inbox } from 'lucide-react-native';
import {
  getGetPlannerDashboardQueryKey,
  useGetPlannerDashboard,
} from '@workspace/api-client-react';

import { AssignmentRow } from '@/components/rows';
import { Card, EmptyState, SectionHeading } from '@/components/ui';
import { colors, fonts, spacing } from '@/theme';

export default function AssignmentsScreen() {
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

  // The web app sliced to 4 because of sidebar layout constraints. A phone
  // screen scrolls, so show the full list the API returns.
  const assignments = dashboardQuery.data?.upcomingAssignments ?? [];

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
      <SectionHeading eyebrow="Keep it in sight" title="Coming up" />
      <Card>
        {assignments.length ? (
          assignments.map((assignment) => (
            <AssignmentRow key={assignment.id} assignment={assignment} />
          ))
        ) : (
          <EmptyState
            icon={<Inbox size={16} color={colors.primary} />}
            title="Nothing due yet."
            body="That's a nice place to be."
          />
        )}
      </Card>
      <Text style={styles.footer}>Morrow is here for the next right-sized step.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl * 2 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  footer: {
    marginTop: spacing.xxl,
    textAlign: 'center',
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.mutedForeground,
  },
});
