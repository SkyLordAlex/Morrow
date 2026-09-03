import { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Sparkles, X } from 'lucide-react-native';
import {
  getGetPlannerDashboardQueryKey,
  useCreateStudyPlan,
  useUpdatePlannerTask,
  type StudyPlan,
  type StudyTask,
} from '@workspace/api-client-react';

import { PrimaryButton } from '@/components/ui';
import { minutesLabel } from '@/format';
import { colors, fonts, radius, spacing } from '@/theme';

const MINUTE_PRESETS = [45, 60, 90, 120] as const;

export default function PlanScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [note, setNote] = useState('');
  const [availableMinutes, setAvailableMinutes] = useState(90);
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<number | null>(null);

  const createStudyPlan = useCreateStudyPlan();
  const updateTask = useUpdatePlannerTask();

  const invalidateDashboard = () => {
    queryClient.invalidateQueries({ queryKey: getGetPlannerDashboardQueryKey() });
  };

  const submit = () => {
    if (note.trim().length < 3) return;
    createStudyPlan.mutate(
      { data: { note: note.trim(), availableMinutesPerDay: availableMinutes } },
      {
        onSuccess: (created) => {
          setPlan(created);
          invalidateDashboard();
        },
      },
    );
  };

  const toggleTask = (task: StudyTask) => {
    const nextStatus = task.status === 'done' ? 'todo' : 'done';
    setPendingTaskId(task.id);
    updateTask.mutate(
      { id: task.id, data: { status: nextStatus } },
      {
        onSuccess: (updated) => {
          setPlan((previous) =>
            previous
              ? {
                  ...previous,
                  tasks: previous.tasks.map((item) =>
                    item.id === updated.id ? updated : item,
                  ),
                }
              : previous,
          );
          setPendingTaskId(null);
          invalidateDashboard();
        },
        onError: () => setPendingTaskId(null),
      },
    );
  };

  const tasks = plan
    ? [...plan.tasks].sort((a, b) => a.sortOrder - b.sortOrder)
    : [];

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      // Without this the keyboard covers the textarea and the submit button
      // on every iPhone.
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>MAKE IT LIGHTER</Text>
          <Text style={styles.title}>What&apos;s on your plate?</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => router.back()}
          hitSlop={10}
          style={styles.close}
        >
          <X size={16} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.hint}>
          Tell Morrow the messy version. It will shape the first few steps for you.
        </Text>

        <Text style={styles.label}>Your note</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          multiline
          textAlignVertical="top"
          placeholder="I need to finish my biology lab, review for Friday's quiz, and start the history essay…"
          placeholderTextColor="rgba(99, 126, 119, 0.65)"
          style={styles.textarea}
          accessibilityLabel="Describe what you need to do"
        />

        <Text style={styles.label}>Time I have each day</Text>
        <View style={styles.presets}>
          {MINUTE_PRESETS.map((preset) => {
            const active = preset === availableMinutes;
            return (
              <Pressable
                key={preset}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                onPress={() => setAvailableMinutes(preset)}
                style={[styles.preset, active && styles.presetActive]}
              >
                <Text
                  style={[styles.presetText, active && styles.presetTextActive]}
                >
                  {minutesLabel(preset)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {createStudyPlan.isError ? (
          <Text style={styles.error}>
            We couldn&apos;t shape that plan. Try once more.
          </Text>
        ) : null}

        <PrimaryButton
          label={
            createStudyPlan.isPending ? 'Finding the first steps…' : 'Shape my plan'
          }
          loading={createStudyPlan.isPending}
          disabled={note.trim().length < 3}
          onPress={submit}
          icon={<Sparkles size={16} color={colors.primaryForeground} />}
          style={styles.submit}
        />

        {plan ? (
          <View style={styles.result}>
            <View style={styles.resultHead}>
              <Sparkles size={16} color={colors.primary} />
              <Text style={styles.resultEyebrow}>A PLAN FOR RIGHT NOW</Text>
            </View>
            <Text style={styles.resultTitle}>Start small. Keep going.</Text>
            <Text style={styles.resultSummary}>{plan.summary}</Text>

            <View style={styles.taskList}>
              {tasks.length ? (
                tasks.map((task) => {
                  const done = task.status === 'done';
                  return (
                    <Pressable
                      key={task.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: done }}
                      disabled={pendingTaskId === task.id}
                      onPress={() => toggleTask(task)}
                      style={({ pressed }) => [
                        styles.task,
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <View
                        style={[styles.taskCheck, done && styles.taskCheckOn]}
                      >
                        <Check
                          size={12}
                          strokeWidth={3}
                          color={done ? colors.primaryForeground : 'transparent'}
                        />
                      </View>
                      <Text
                        style={[styles.taskTitle, done && styles.taskTitleDone]}
                      >
                        {task.title}
                      </Text>
                      <Text style={styles.taskDuration}>
                        {minutesLabel(task.durationMinutes)}
                      </Text>
                    </Pressable>
                  );
                })
              ) : (
                <Text style={styles.taskEmpty}>
                  Your sessions are ready on the Today tab.
                </Text>
              )}
            </View>

            <PrimaryButton
              tone="secondary"
              label="Back to today"
              onPress={() => router.back()}
              style={styles.doneButton}
            />
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
  },
  headerText: { flex: 1 },
  eyebrow: {
    fontFamily: fonts.monoMedium,
    fontSize: 10,
    letterSpacing: 1.9,
    color: colors.primary,
  },
  title: {
    marginTop: 4,
    fontFamily: fonts.serifSemi,
    fontSize: 30,
    color: colors.foreground,
  },
  close: {
    height: 32,
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors.muted,
  },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
  hint: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 20,
    color: colors.mutedForeground,
  },
  label: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    fontFamily: fonts.sansHeavy,
    fontSize: 12,
    color: colors.foreground,
  },
  textarea: {
    minHeight: 132,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 22,
    color: colors.foreground,
  },
  presets: { flexDirection: 'row', gap: spacing.sm },
  preset: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: colors.card,
  },
  presetActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(43, 105, 96, 0.08)',
  },
  presetText: { fontFamily: fonts.mono, fontSize: 13, color: colors.mutedForeground },
  presetTextActive: { color: colors.primary, fontFamily: fonts.monoMedium },
  error: {
    marginTop: spacing.lg,
    fontFamily: fonts.sansBold,
    fontSize: 12,
    lineHeight: 20,
    color: colors.destructive,
  },
  submit: { marginTop: spacing.xl },
  result: {
    marginTop: spacing.xxl,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(249, 192, 88, 0.6)',
    backgroundColor: 'rgba(249, 192, 88, 0.1)',
    padding: spacing.xl,
  },
  resultHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  resultEyebrow: {
    fontFamily: fonts.monoMedium,
    fontSize: 10,
    letterSpacing: 1.7,
    color: colors.primary,
  },
  resultTitle: {
    marginTop: spacing.sm,
    fontFamily: fonts.serifSemi,
    fontSize: 25,
    color: colors.foreground,
  },
  resultSummary: {
    marginTop: spacing.md,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 22,
    color: colors.mutedForeground,
  },
  taskList: { marginTop: spacing.xl, gap: spacing.sm },
  task: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
  },
  taskCheck: {
    height: 24,
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  taskCheckOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  taskTitle: {
    flex: 1,
    fontFamily: fonts.sansBold,
    fontSize: 13,
    color: colors.foreground,
  },
  taskTitleDone: {
    color: colors.mutedForeground,
    textDecorationLine: 'line-through',
  },
  taskDuration: { fontFamily: fonts.mono, fontSize: 10, color: colors.mutedForeground },
  taskEmpty: {
    borderRadius: radius.md,
    backgroundColor: colors.card,
    padding: spacing.lg,
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.mutedForeground,
  },
  doneButton: { marginTop: spacing.xl },
});
