import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useStore } from '../store/useStore';
import ScreenContainer from '../components/ScreenContainer';
import MuscleTag from '../components/MuscleTag';
import RestTimerBar from '../components/RestTimerBar';
import { colors, radius, spacing } from '../theme/theme';
import { RootTabParamList, WorkoutStackParamList } from '../navigation/types';
import { Exercise, LoggedSet, MuscleGroup, SessionExercise, SetType, TemplateExercise, WeightUnit } from '../types';
import { getAverageLoggedRir, ProgressionSuggestion, suggestProgression } from '../utils/progression';
import { formatDuration } from '../utils/format';
import { computeSessionSummary } from '../utils/sessionSummary';
import { convertWeightTotal, formatWeightValue, parseWeightInput } from '../utils/units';

type Props = NativeStackScreenProps<WorkoutStackParamList, 'WorkoutHome'>;

const SET_TYPE_ICON: Record<SetType, keyof typeof Ionicons.glyphMap> = {
  working: 'ellipsis-vertical',
  warmup: 'flame',
  drop: 'trending-down',
};

const SET_TYPE_COLOR: Record<SetType, string> = {
  working: colors.textMuted,
  warmup: '#f6a35c',
  drop: colors.accent,
};

function WeightInput({
  lbsValue,
  unit,
  onChangeLbs,
}: {
  lbsValue: string;
  unit: WeightUnit;
  onChangeLbs: (lbsValue: string) => void;
}) {
  const [localText, setLocalText] = useState(() => formatWeightValue(lbsValue, unit));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setLocalText(formatWeightValue(lbsValue, unit));
  }, [lbsValue, unit, focused]);

  return (
    <TextInput
      style={styles.weightInput}
      value={localText}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        setLocalText(formatWeightValue(lbsValue, unit));
      }}
      onChangeText={(v) => {
        setLocalText(v);
        onChangeLbs(parseWeightInput(v, unit));
      }}
      placeholder={unit}
      placeholderTextColor={colors.textMuted}
      keyboardType="decimal-pad"
    />
  );
}

function SetRow({
  set,
  unit,
  onUpdate,
  onToggle,
  onOpenMenu,
}: {
  set: LoggedSet;
  unit: WeightUnit;
  onUpdate: (field: 'weight' | 'reps' | 'rir', value: string) => void;
  onToggle: () => void;
  onOpenMenu: () => void;
}) {
  return (
    <View style={[styles.setRow, set.type === 'warmup' && styles.setRowWarmup]}>
      <Pressable onPress={onOpenMenu} hitSlop={10} style={{ width: 20 }}>
        <Ionicons name={SET_TYPE_ICON[set.type]} size={14} color={SET_TYPE_COLOR[set.type]} />
      </Pressable>
      <WeightInput lbsValue={set.weight} unit={unit} onChangeLbs={(v) => onUpdate('weight', v)} />
      <TextInput
        style={styles.repsInput}
        value={set.reps}
        onChangeText={(v) => onUpdate('reps', v)}
        placeholder="reps"
        placeholderTextColor={colors.textMuted}
        keyboardType="number-pad"
      />
      <TextInput
        style={styles.rirInput}
        value={set.rir}
        onChangeText={(v) => onUpdate('rir', v)}
        placeholder="RIR"
        placeholderTextColor={colors.textMuted}
        keyboardType="number-pad"
      />
      <Pressable style={[styles.logBox, set.logged && styles.logBoxChecked]} onPress={onToggle}>
        {set.logged && <Ionicons name="checkmark" size={16} color="#fff" />}
      </Pressable>
    </View>
  );
}

function ProgressionBadge({ suggestion }: { suggestion: ProgressionSuggestion | 'deload' | null }) {
  if (!suggestion || suggestion === 'maintain') return null;
  const config: Record<'increase' | 'decrease' | 'deload', { label: string; color: string }> = {
    increase: { label: '▲ Try heavier', color: colors.success },
    decrease: { label: '▼ Ease up', color: '#f6a35c' },
    deload: { label: 'Deload — reduce load', color: '#e0b23c' },
  };
  const { label, color } = config[suggestion];
  return (
    <View style={[styles.suggestionBadge, { borderColor: color }]}>
      <Text style={[styles.suggestionText, { color }]}>{label}</Text>
    </View>
  );
}

function ExerciseCard({
  exercise,
  templateExercise,
  sessionExercise,
  sessionId,
  suggestion,
  unit,
  onHistory,
  onSetLogged,
}: {
  exercise: Exercise;
  templateExercise: TemplateExercise;
  sessionExercise: SessionExercise;
  sessionId: string;
  suggestion: ProgressionSuggestion | 'deload' | null;
  unit: WeightUnit;
  onHistory: () => void;
  onSetLogged: (restSeconds: number) => void;
}) {
  const updateSetField = useStore((s) => s.updateSetField);
  const toggleSetLogged = useStore((s) => s.toggleSetLogged);
  const setLoggedSetType = useStore((s) => s.setLoggedSetType);
  const addSet = useStore((s) => s.addSet);
  const removeSet = useStore((s) => s.removeSet);

  const openSetMenu = (setId: string) => {
    Alert.alert('Set Options', undefined, [
      { text: 'Warm-up Set', onPress: () => setLoggedSetType(sessionId, sessionExercise.id, setId, 'warmup') },
      { text: 'Working Set', onPress: () => setLoggedSetType(sessionId, sessionExercise.id, setId, 'working') },
      { text: 'Drop Set', onPress: () => setLoggedSetType(sessionId, sessionExercise.id, setId, 'drop') },
      { text: 'Delete Set', style: 'destructive', onPress: () => removeSet(sessionId, sessionExercise.id, setId) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.exerciseCard}>
      <View style={styles.exerciseHeaderRow}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.exerciseName}>{exercise.name}</Text>
          <Text style={styles.exerciseEquipment}>{exercise.equipment}</Text>
          <ProgressionBadge suggestion={suggestion} />
        </View>
        <Pressable onPress={onHistory} hitSlop={10} style={{ marginRight: spacing.sm }}>
          <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.colHeaderRow}>
        <View style={{ width: 20 }} />
        <Text style={[styles.colHeader, { flex: 1 }]}>WEIGHT</Text>
        <Text style={[styles.colHeader, { flex: 1 }]}>REPS</Text>
        <Text style={[styles.colHeader, { flex: 1 }]}>RIR</Text>
        <Text style={styles.colHeader}>LOG</Text>
      </View>

      {sessionExercise.sets.map((set, i) => (
        <SetRow
          key={set.id}
          set={set}
          unit={unit}
          onUpdate={(field, value) => updateSetField(sessionId, sessionExercise.id, set.id, field, value)}
          onToggle={() => {
            const wasLogged = set.logged;
            toggleSetLogged(sessionId, sessionExercise.id, set.id);
            if (!wasLogged) {
              onSetLogged(templateExercise.sets[i]?.restSeconds ?? 90);
            }
          }}
          onOpenMenu={() => openSetMenu(set.id)}
        />
      ))}

      <Pressable style={styles.addSetButton} onPress={() => addSet(sessionId, sessionExercise.id)}>
        <Ionicons name="add" size={16} color={colors.accent} />
        <Text style={styles.addSetText}>Add Set</Text>
      </Pressable>
    </View>
  );
}

export default function WorkoutHomeScreen({ navigation }: Props) {
  const active = useStore((s) => s.active);
  const mesocycles = useStore((s) => s.mesocycles);
  const exercises = useStore((s) => s.exercises);
  const sessions = useStore((s) => s.sessions);
  const getOrCreateSession = useStore((s) => s.getOrCreateSession);
  const stepDay = useStore((s) => s.stepDay);
  const completeSession = useStore((s) => s.completeSession);
  const updateSessionNotes = useStore((s) => s.updateSessionNotes);
  const unit = useStore((s) => s.settings.unit);
  const tabNavigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();

  const meso = active ? mesocycles.find((m) => m.id === active.mesoId) : undefined;
  const day = meso && active ? meso.days[active.dayIndex] : undefined;
  const isDeloadWeek = !!(meso && active && meso.deloadWeeks.includes(active.week));

  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (meso && active && day) {
      const id = getOrCreateSession(meso.id, active.week, active.dayIndex);
      setSessionId(id);
    } else {
      setSessionId(null);
    }
  }, [meso?.id, active?.week, active?.dayIndex, day?.id, day?.exercises.length]);

  const session = sessionId ? sessions.find((s) => s.id === sessionId) : undefined;

  const exerciseById = useMemo(() => {
    const map = new Map<string, Exercise>();
    exercises.forEach((e) => map.set(e.id, e));
    return map;
  }, [exercises]);

  const [restTimer, setRestTimer] = useState<{
    secondsLeft: number;
    totalSeconds: number;
    running: boolean;
  } | null>(null);

  useEffect(() => {
    if (!restTimer?.running) return;
    const interval = setInterval(() => {
      setRestTimer((prev) => {
        if (!prev || !prev.running) return prev;
        if (prev.secondsLeft <= 1) return null;
        return { ...prev, secondsLeft: prev.secondsLeft - 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [restTimer?.running]);

  const startRestTimer = (seconds: number) => {
    if (seconds <= 0) return;
    setRestTimer({ secondsLeft: seconds, totalSeconds: seconds, running: true });
  };

  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    if (!session || session.completedAt) return;
    const interval = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [session?.id, session?.completedAt]);

  const summary = useMemo(
    () => (session ? computeSessionSummary(session, exerciseById) : null),
    [session, exerciseById]
  );

  if (!active || !meso || !day) {
    return (
      <ScreenContainer style={styles.emptyState}>
        <Ionicons name="barbell-outline" size={48} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>No active workout plan</Text>
        <Text style={styles.emptySubtitle}>Create or select a workout plan to start logging workouts.</Text>
        <Pressable
          style={styles.emptyButton}
          onPress={() => tabNavigation.navigate('Mesos', { screen: 'PlanBuilder' })}
        >
          <Text style={styles.emptyButtonText}>Start New Workout Plan</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  if (!session || !summary) {
    return <ScreenContainer />;
  }

  const elapsedSeconds = session.completedAt
    ? Math.max(0, (new Date(session.completedAt).getTime() - new Date(session.date).getTime()) / 1000)
    : Math.max(0, (nowTick - new Date(session.date).getTime()) / 1000);

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.headerTitle}>
              WEEK {active.week} <Text style={styles.headerTitleMuted}>DAY {active.dayIndex + 1}</Text>
            </Text>
            {isDeloadWeek && (
              <View style={styles.deloadBadge}>
                <Text style={styles.deloadBadgeText}>DELOAD</Text>
              </View>
            )}
          </View>
          <Text style={styles.headerSubtitle}>{day.name} · {meso.name}</Text>
        </View>
        <Pressable onPress={() => stepDay(-1)} hitSlop={10} style={{ marginRight: spacing.sm }}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Pressable onPress={() => stepDay(1)} hitSlop={10}>
          <Ionicons name="chevron-forward" size={22} color={colors.textPrimary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}>
        <View style={styles.sessionCard}>
          <View style={styles.sessionStatusRow}>
            <Pressable
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
              onPress={() => completeSession(session.id)}
            >
              <Ionicons
                name={session.completedAt ? 'checkmark-circle' : 'time-outline'}
                size={18}
                color={session.completedAt ? colors.success : colors.textSecondary}
              />
              <Text style={[styles.sessionStatusText, session.completedAt && { color: colors.success }]}>
                {session.completedAt ? `Completed · ${formatDuration(elapsedSeconds)}` : formatDuration(elapsedSeconds)}
              </Text>
            </Pressable>
            {!session.completedAt && (
              <Pressable style={styles.finishButton} onPress={() => completeSession(session.id)}>
                <Text style={styles.finishButtonText}>Finish Workout</Text>
              </Pressable>
            )}
          </View>
          {session.completedAt && (
            <View style={styles.summaryStatsRow}>
              <Text style={styles.summaryStat}>{summary.totalSets} sets</Text>
              <Text style={styles.summaryStat}>
                {convertWeightTotal(summary.totalVolume, unit).toLocaleString()} {unit} volume
              </Text>
              <Text style={styles.summaryStat}>{summary.muscleCount} muscle groups</Text>
            </View>
          )}
          <TextInput
            style={styles.notesInput}
            placeholder="Add a note about this session..."
            placeholderTextColor={colors.textMuted}
            value={session.notes ?? ''}
            onChangeText={(v) => updateSessionNotes(session.id, v)}
            multiline
          />
        </View>

        {day.exercises.length === 0 && (
          <Text style={styles.empty}>This day has no exercises yet. Edit it from the Mesos tab.</Text>
        )}
        {day.exercises.map((te, idx) => {
          const exercise = exerciseById.get(te.exerciseId);
          const sessionExercise = session.exercises.find((se) => se.exerciseId === te.exerciseId);
          if (!exercise || !sessionExercise) return null;
          const prevExercise = idx > 0 ? exerciseById.get(day.exercises[idx - 1].exerciseId) : undefined;
          const showTag = !prevExercise || prevExercise.muscleGroup !== exercise.muscleGroup;

          const prevWeekExercise = useStore
            .getState()
            .getPreviousSessionExercise(meso.id, day.id, te.exerciseId, active.week);
          const targetRir = te.sets[0]?.rir ?? 3;
          const suggestion: ProgressionSuggestion | 'deload' | null = isDeloadWeek
            ? 'deload'
            : suggestProgression(targetRir, getAverageLoggedRir(prevWeekExercise?.sets ?? []));

          return (
            <View key={te.id}>
              {showTag && (
                <View style={{ marginBottom: spacing.sm, marginTop: idx === 0 ? 0 : spacing.md }}>
                  <MuscleTag muscle={exercise.muscleGroup as MuscleGroup} />
                </View>
              )}
              <ExerciseCard
                exercise={exercise}
                templateExercise={te}
                sessionExercise={sessionExercise}
                sessionId={session.id}
                suggestion={suggestion}
                unit={unit}
                onHistory={() => navigation.navigate('ExerciseHistory', { exerciseId: exercise.id })}
                onSetLogged={startRestTimer}
              />
            </View>
          );
        })}
      </ScrollView>

      {restTimer && (
        <RestTimerBar
          secondsLeft={restTimer.secondsLeft}
          totalSeconds={restTimer.totalSeconds}
          running={restTimer.running}
          onToggleRunning={() =>
            setRestTimer((prev) => (prev ? { ...prev, running: !prev.running } : prev))
          }
          onAddTime={(delta) =>
            setRestTimer((prev) => {
              if (!prev) return prev;
              const secondsLeft = Math.max(0, prev.secondsLeft + delta);
              return { ...prev, secondsLeft, totalSeconds: Math.max(prev.totalSeconds, secondsLeft) };
            })
          }
          onSkip={() => setRestTimer(null)}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '800', letterSpacing: 0.5 },
  headerTitleMuted: { color: colors.textSecondary },
  headerSubtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  deloadBadge: {
    backgroundColor: '#e0b23c33',
    borderWidth: 1,
    borderColor: '#e0b23c',
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  deloadBadgeText: { color: '#e0b23c', fontSize: 10, fontWeight: '800' },
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  emptyTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginTop: spacing.sm },
  emptySubtitle: { color: colors.textSecondary, fontSize: 14, textAlign: 'center' },
  emptyButton: { marginTop: spacing.md, backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  emptyButtonText: { color: '#fff', fontWeight: '700' },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
  sessionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  sessionStatusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sessionStatusText: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
  finishButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  finishButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  summaryStatsRow: { flexDirection: 'row', gap: spacing.md },
  summaryStat: { color: colors.textPrimary, fontSize: 12, fontWeight: '600' },
  notesInput: {
    backgroundColor: colors.inputBackground,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    fontSize: 13,
    minHeight: 36,
  },
  suggestionBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
  },
  suggestionText: { fontSize: 11, fontWeight: '700' },
  exerciseCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  exerciseHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm },
  exerciseName: { color: colors.textPrimary, fontSize: 17, fontWeight: '800' },
  exerciseEquipment: { color: colors.textSecondary, fontSize: 13 },
  colHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  colHeader: { color: colors.textMuted, fontSize: 11, fontWeight: '700', textAlign: 'center', width: 44 },
  setRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.xs },
  setRowWarmup: { opacity: 0.55 },
  weightInput: {
    flex: 1,
    minWidth: 0,
    textAlign: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: radius.sm,
    paddingVertical: 10,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  repsInput: {
    flex: 1,
    minWidth: 0,
    textAlign: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: radius.sm,
    paddingVertical: 10,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rirInput: {
    flex: 1,
    minWidth: 0,
    textAlign: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: radius.sm,
    paddingVertical: 10,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logBox: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logBoxChecked: { backgroundColor: colors.success, borderColor: colors.success },
  addSetButton: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 4 },
  addSetText: { color: colors.accent, fontWeight: '600', fontSize: 13 },
});
