import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useStore } from '../store/useStore';
import ScreenContainer from '../components/ScreenContainer';
import MuscleTag from '../components/MuscleTag';
import RestTimerBar from '../components/RestTimerBar';
import { colors, radius, spacing } from '../theme/theme';
import { WorkoutStackParamList } from '../navigation/types';
import { Exercise, LoggedSet, MuscleGroup, SessionExercise, TemplateExercise } from '../types';

type Props = NativeStackScreenProps<WorkoutStackParamList, 'WorkoutHome'>;

function SetRow({
  index,
  set,
  onUpdate,
  onToggle,
}: {
  index: number;
  set: LoggedSet;
  onUpdate: (field: 'weight' | 'reps' | 'rir', value: string) => void;
  onToggle: () => void;
}) {
  return (
    <View style={styles.setRow}>
      <Ionicons name="ellipsis-vertical" size={14} color={colors.textMuted} style={{ width: 20 }} />
      <TextInput
        style={styles.weightInput}
        value={set.weight}
        onChangeText={(v) => onUpdate('weight', v)}
        placeholder="lbs"
        placeholderTextColor={colors.textMuted}
        keyboardType="decimal-pad"
      />
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

function ExerciseCard({
  exercise,
  templateExercise,
  sessionExercise,
  sessionId,
  onHistory,
  onSetLogged,
}: {
  exercise: Exercise;
  templateExercise: TemplateExercise;
  sessionExercise: SessionExercise;
  sessionId: string;
  onHistory: () => void;
  onSetLogged: (restSeconds: number) => void;
}) {
  const updateSetField = useStore((s) => s.updateSetField);
  const toggleSetLogged = useStore((s) => s.toggleSetLogged);
  const addSet = useStore((s) => s.addSet);

  return (
    <View style={styles.exerciseCard}>
      <View style={styles.exerciseHeaderRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.exerciseName}>{exercise.name}</Text>
          <Text style={styles.exerciseEquipment}>{exercise.equipment}</Text>
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
          index={i}
          set={set}
          onUpdate={(field, value) => updateSetField(sessionId, sessionExercise.id, set.id, field, value)}
          onToggle={() => {
            const wasLogged = set.logged;
            toggleSetLogged(sessionId, sessionExercise.id, set.id);
            if (!wasLogged) {
              onSetLogged(templateExercise.sets[i]?.restSeconds ?? 90);
            }
          }}
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
  const tabNavigation = useNavigation<BottomTabNavigationProp<Record<string, undefined>>>();

  const meso = active ? mesocycles.find((m) => m.id === active.mesoId) : undefined;
  const day = meso && active ? meso.days[active.dayIndex] : undefined;

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

  if (!active || !meso || !day) {
    return (
      <ScreenContainer style={styles.emptyState}>
        <Ionicons name="barbell-outline" size={48} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>No active mesocycle</Text>
        <Text style={styles.emptySubtitle}>Create or select a mesocycle to start logging workouts.</Text>
        <Pressable style={styles.emptyButton} onPress={() => tabNavigation.navigate('Mesos')}>
          <Text style={styles.emptyButtonText}>Go to Mesos</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  if (!session) {
    return <ScreenContainer />;
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>
            WEEK {active.week} <Text style={styles.headerTitleMuted}>DAY {active.dayIndex + 1}</Text>
          </Text>
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
        {day.exercises.length === 0 && (
          <Text style={styles.empty}>This day has no exercises yet. Edit it from the Mesos tab.</Text>
        )}
        {day.exercises.map((te, idx) => {
          const exercise = exerciseById.get(te.exerciseId);
          const sessionExercise = session.exercises.find((se) => se.exerciseId === te.exerciseId);
          if (!exercise || !sessionExercise) return null;
          const prevExercise = idx > 0 ? exerciseById.get(day.exercises[idx - 1].exerciseId) : undefined;
          const showTag = !prevExercise || prevExercise.muscleGroup !== exercise.muscleGroup;
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
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  emptyTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginTop: spacing.sm },
  emptySubtitle: { color: colors.textSecondary, fontSize: 14, textAlign: 'center' },
  emptyButton: { marginTop: spacing.md, backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  emptyButtonText: { color: '#fff', fontWeight: '700' },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
  exerciseCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  exerciseHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm },
  exerciseName: { color: colors.textPrimary, fontSize: 17, fontWeight: '800' },
  exerciseEquipment: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  colHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  colHeader: { color: colors.textMuted, fontSize: 11, fontWeight: '700', textAlign: 'center', width: 44 },
  setRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.xs },
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
