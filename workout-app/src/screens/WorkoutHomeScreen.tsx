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
import { RootTabParamList, WorkoutStackParamList } from '../navigation/types';
import ExercisePickerModal from '../components/ExercisePickerModal';
import FormGuideModal from '../components/FormGuideModal';
import { useDialog } from '../components/DialogProvider';
import { EffortLevel, Exercise, LoggedSet, MuscleGroup, PainFlag, PumpLevel, SessionExercise, SetType, TemplateExercise, WeightUnit } from '../types';
import { getAverageLoggedReps, parseRepRange, ProgressionSuggestion, suggestProgression } from '../utils/progression';
import { formatDuration } from '../utils/format';
import { computeSessionSummary, isSessionInProgress } from '../utils/sessionSummary';
import { convertWeightTotal, formatWeightValue, parseWeightInput } from '../utils/units';
import { bestSetOf, computeSuggestedTarget, repsForAlternateWeight, SuggestedTarget, targetFieldValues } from '../utils/suggestion';
import { restAfterSet, supersetPositions, SupersetPosition } from '../utils/supersets';
import { isMesocycleComplete } from '../utils/nextMesocycle';
import { useRestTimer } from '../hooks/useRestTimer';
import { useNowTick } from '../hooks/useNowTick';
import { useKeepAwakeWhile } from '../hooks/useKeepAwakeWhile';
import { tapFeedback, successFeedback } from '../utils/haptics';

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
      style={styles.setInput}
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
  onUpdate: (field: 'weight' | 'reps', value: string) => void;
  onToggle: () => void;
  onOpenMenu: () => void;
}) {
  return (
    <View style={[styles.setRow, set.type === 'warmup' && styles.setRowWarmup]}>
      <Pressable onPress={onOpenMenu} hitSlop={14} style={styles.setMenuButton}>
        <Ionicons name={SET_TYPE_ICON[set.type]} size={14} color={SET_TYPE_COLOR[set.type]} />
      </Pressable>
      <WeightInput lbsValue={set.weight} unit={unit} onChangeLbs={(v) => onUpdate('weight', v)} />
      <TextInput
        style={styles.setInput}
        value={set.reps}
        onChangeText={(v) => onUpdate('reps', v)}
        placeholder="reps"
        placeholderTextColor={colors.textMuted}
        keyboardType="number-pad"
      />
      <Pressable style={[styles.logBox, set.logged && styles.logBoxChecked]} onPress={onToggle}>
        {set.logged && <Ionicons name="checkmark" size={22} color="#fff" />}
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

function SuggestionRow({
  target,
  unit,
  isDeload,
  onApply,
}: {
  target: SuggestedTarget;
  unit: WeightUnit;
  isDeload: boolean;
  onApply: (weightLbs: string, reps?: string) => void;
}) {
  const [adjusting, setAdjusting] = useState(false);
  const [altWeightText, setAltWeightText] = useState(() => formatWeightValue(String(target.weight), unit));

  const altWeightLbs = Number(parseWeightInput(altWeightText, unit));
  const hasAltWeight = adjusting && altWeightLbs > 0;
  const altReps = hasAltWeight ? repsForAlternateWeight(target.oneRepMax, altWeightLbs) : target.reps;
  const displayWeight = formatWeightValue(String(target.weight), unit);

  const apply = () => {
    const fields = hasAltWeight
      ? targetFieldValues({ ...target, weight: altWeightLbs, reps: altReps }, isDeload)
      : targetFieldValues(target, isDeload);
    onApply(fields.weight, fields.reps);
  };

  return (
    <View style={styles.suggestionRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.suggestionRowText}>
          Suggested: {displayWeight} {unit}
          {!isDeload && ` × ${target.reps} reps`}
        </Text>
        {adjusting && !isDeload && (
          <View style={styles.adjustRow}>
            <Text style={styles.adjustLabel}>I have</Text>
            <TextInput
              style={styles.adjustInput}
              value={altWeightText}
              onChangeText={setAltWeightText}
              keyboardType="decimal-pad"
              placeholder={unit}
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            <Text style={styles.adjustLabel}>{unit} → try {altReps} reps</Text>
          </View>
        )}
      </View>
      {!isDeload && (
        <Pressable onPress={() => setAdjusting((v) => !v)} hitSlop={8}>
          <Text style={styles.suggestionLink}>{adjusting ? 'Cancel' : 'Different weight?'}</Text>
        </Pressable>
      )}
      <Pressable style={styles.applyButton} onPress={apply}>
        <Text style={styles.applyButtonText}>Apply</Text>
      </Pressable>
    </View>
  );
}

function ExerciseCard({
  exercise,
  templateExercise,
  sessionExercise,
  sessionId,
  suggestion,
  suggestedTarget,
  isDeloadWeek,
  unit,
  onHistory,
  onShowForm,
  onSetLogged,
  onExerciseCompletionCheck,
  supersetPosition,
  onEditNote,
}: {
  exercise: Exercise;
  templateExercise: TemplateExercise;
  sessionExercise: SessionExercise;
  sessionId: string;
  suggestion: ProgressionSuggestion | 'deload' | null;
  suggestedTarget: SuggestedTarget | null;
  isDeloadWeek: boolean;
  unit: WeightUnit;
  onHistory: () => void;
  onShowForm: () => void;
  onSetLogged: (restSeconds: number) => void;
  onExerciseCompletionCheck: () => void;
  supersetPosition?: SupersetPosition;
  onEditNote: () => void;
}) {
  const updateSetField = useStore((s) => s.updateSetField);
  const toggleSetLogged = useStore((s) => s.toggleSetLogged);
  const setLoggedSetType = useStore((s) => s.setLoggedSetType);
  const addSet = useStore((s) => s.addSet);
  const removeSet = useStore((s) => s.removeSet);
  const dialog = useDialog();

  const openSetMenu = async (setId: string) => {
    const action = await dialog.choose('Set Options', [
      { value: 'warmup', label: 'Warm-up Set' },
      { value: 'working', label: 'Working Set' },
      { value: 'drop', label: 'Drop Set' },
      { value: 'delete', label: 'Delete Set', style: 'destructive' },
      { value: 'cancel', label: 'Cancel', style: 'cancel' },
    ]);
    if (action === 'delete') {
      removeSet(sessionId, sessionExercise.id, setId);
      return;
    }
    if (action === 'warmup' || action === 'working' || action === 'drop') {
      setLoggedSetType(sessionId, sessionExercise.id, setId, action);
    }
  };

  // Most sets repeat the load of the one before them, so an empty set being
  // logged fills itself in from the nearest earlier set of the same kind,
  // falling back to the app's own suggestion. Saves retyping the same numbers
  // three times per exercise.
  const prefillSet = (index: number, set: LoggedSet) => {
    const needsWeight = !set.weight.trim();
    const needsReps = !set.reps.trim();
    if (!needsWeight && !needsReps) return;
    const donor = sessionExercise.sets
      .slice(0, index)
      .reverse()
      .find((s) => s.type === set.type && s.weight.trim() && s.reps.trim());
    const fallback = suggestedTarget ? targetFieldValues(suggestedTarget, isDeloadWeek) : undefined;
    const weight = needsWeight ? donor?.weight ?? fallback?.weight : undefined;
    const reps = needsReps ? donor?.reps ?? fallback?.reps : undefined;
    if (weight) updateSetField(sessionId, sessionExercise.id, set.id, 'weight', weight);
    if (reps) updateSetField(sessionId, sessionExercise.id, set.id, 'reps', reps);
  };

  const applySuggestedTarget = (weightLbs: string, reps?: string) => {
    sessionExercise.sets.forEach((s) => {
      if (s.type === 'warmup') return;
      updateSetField(sessionId, sessionExercise.id, s.id, 'weight', weightLbs);
      if (reps !== undefined) updateSetField(sessionId, sessionExercise.id, s.id, 'reps', reps);
    });
  };

  return (
    <View style={styles.exerciseCard}>
      <View style={styles.exerciseHeaderRow}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={styles.exerciseNameRow}>
            {supersetPosition && (
              <View style={styles.supersetBadge}>
                <Text style={styles.supersetBadgeText}>{supersetPosition.letter}</Text>
              </View>
            )}
            <Text style={[styles.exerciseName, { flex: 1 }]}>{exercise.name}</Text>
          </View>
          <Text style={styles.exerciseEquipment}>{exercise.equipment}</Text>
          <ProgressionBadge suggestion={suggestion} />
        </View>
        <Pressable onPress={onEditNote} hitSlop={10} style={{ marginRight: spacing.sm }}>
          <Ionicons
            name={exercise.note ? 'bookmark' : 'bookmark-outline'}
            size={20}
            color={exercise.note ? colors.accent : colors.textSecondary}
          />
        </Pressable>
        <Pressable onPress={onShowForm} hitSlop={10} style={{ marginRight: spacing.sm }}>
          <Ionicons name="body-outline" size={20} color={colors.textSecondary} />
        </Pressable>
        <Pressable onPress={onHistory} hitSlop={10} style={{ marginRight: spacing.sm }}>
          <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>

      {!!exercise.note && (
        <Pressable style={styles.noteCard} onPress={onEditNote}>
          <Ionicons name="bookmark" size={13} color={colors.accent} />
          <Text style={styles.noteText}>{exercise.note}</Text>
        </Pressable>
      )}

      {suggestedTarget && (
        <SuggestionRow target={suggestedTarget} unit={unit} isDeload={isDeloadWeek} onApply={applySuggestedTarget} />
      )}

      <View style={styles.colHeaderRow}>
        <View style={{ width: 20 }} />
        <Text style={[styles.colHeader, { flex: 1 }]}>WEIGHT</Text>
        <Text style={[styles.colHeader, { flex: 1 }]}>REPS</Text>
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
            if (!wasLogged) prefillSet(i, set);
            toggleSetLogged(sessionId, sessionExercise.id, set.id);
            tapFeedback();
            if (!wasLogged) {
              // Mid-superset this resolves to 0, which starts no timer at all --
              // the next movement is the rest.
              onSetLogged(
                restAfterSet(templateExercise.sets[i]?.restSeconds ?? 90, supersetPosition)
              );
              onExerciseCompletionCheck();
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
  const setExercisePain = useStore((s) => s.setExercisePain);
  const setMuscleFeedback = useStore((s) => s.setMuscleFeedback);
  const swapDayExercise = useStore((s) => s.swapDayExercise);
  const setExerciseNote = useStore((s) => s.setExerciseNote);
  const createNextMesocycle = useStore((s) => s.createNextMesocycle);
  const dialog = useDialog();
  const settings = useStore((s) => s.settings);
  const unit = settings.unit;
  const tabNavigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();

  const meso = active ? mesocycles.find((m) => m.id === active.mesoId) : undefined;
  const day = meso && active ? meso.days[active.dayIndex] : undefined;
  const isDeloadWeek = !!(meso && active && meso.deloadWeeks.includes(active.week));

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [swapTarget, setSwapTarget] = useState<{ templateExerciseId: string; muscleGroup: MuscleGroup; exerciseId: string } | null>(null);
  const [formGuideExercise, setFormGuideExercise] = useState<Exercise | null>(null);

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

  const {
    timer: restTimer,
    start: startRestTimer,
    toggleRunning: toggleRestTimer,
    addTime: addRestTime,
    skip: skipRestTimer,
  } = useRestTimer(settings.restTimerNotifications);

  useKeepAwakeWhile(settings.keepAwakeDuringWorkout && isSessionInProgress(session));

  useNowTick(isSessionInProgress(session));

  const summary = useMemo(
    () => (session ? computeSessionSummary(session, exerciseById) : null),
    [session, exerciseById]
  );

  // Derived once per data change rather than once per render. Each row scans
  // the whole sessions array twice (previous-week lookup and low-pump streak),
  // and this screen re-renders every second while a workout is running.
  const exerciseRows = useMemo(() => {
    if (!meso || !day || !session || !active) return [];
    const { getPreviousSessionExercise, getLowPumpStreak } = useStore.getState();
    const positions = supersetPositions(day.exercises);
    return day.exercises.flatMap((te, idx) => {
      const exercise = exerciseById.get(te.exerciseId);
      const sessionExercise = session.exercises.find((se) => se.exerciseId === te.exerciseId);
      if (!exercise || !sessionExercise) return [];
      const prev = idx > 0 ? exerciseById.get(day.exercises[idx - 1].exerciseId) : undefined;
      const showTag = !prev || prev.muscleGroup !== exercise.muscleGroup;
      const prevWeekSets =
        getPreviousSessionExercise(meso.id, day.id, te.exerciseId, active.week)?.sets ?? [];
      const repRange = parseRepRange(te.sets[0]?.repRange ?? '8-12');
      const direction = suggestProgression(repRange, getAverageLoggedReps(prevWeekSets));
      const repTarget = Math.round((repRange.low + repRange.high) / 2);
      return [
        {
          te,
          idx,
          exercise,
          sessionExercise,
          showTag,
          suggestion: (isDeloadWeek ? 'deload' : direction) as ProgressionSuggestion | 'deload',
          suggestedTarget: computeSuggestedTarget(
            bestSetOf(prevWeekSets),
            direction,
            repTarget,
            isDeloadWeek
          ),
          lowPumpStreak: showTag
            ? getLowPumpStreak(meso.id, day.id, exercise.muscleGroup, active.week)
            : 0,
          supersetPosition: positions.get(te.id),
        },
      ];
    });
  }, [meso, day, session, active, exerciseById, isDeloadWeek, sessions]);

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

  const editExerciseNote = async (exercise: Exercise) => {
    const next = await dialog.prompt(exercise.name, {
      message: 'Pinned to this exercise — you will see it every time it comes up.',
      initialValue: exercise.note ?? '',
      placeholder: 'e.g. elbows tucked, pause on the chest',
      multiline: true,
      submitLabel: 'Save Note',
      clearLabel: 'Remove',
    });
    if (next === null) return;
    setExerciseNote(exercise.id, next);
  };

  const blockComplete = isMesocycleComplete(meso, sessions);

  const startNextBlock = async () => {
    const confirmed = await dialog.confirm(
      'Build Next Block',
      `Creates a new block from "${meso.name}" with the same days, the set counts you finished on, ` +
        'and your current loads carried over. This one stays in your plans.',
      { confirmLabel: 'Build It' }
    );
    if (!confirmed) return;
    const next = createNextMesocycle(meso.id);
    if (next) tabNavigation.navigate('Mesos', { screen: 'MesosList' });
  };

  const finishWorkout = () => {
    completeSession(session.id);
    skipRestTimer();
    successFeedback();
  };

  const elapsedSeconds = session.completedAt
    ? Math.max(0, (new Date(session.completedAt).getTime() - new Date(session.date).getTime()) / 1000)
    : Math.max(0, (Date.now() - new Date(session.date).getTime()) / 1000);

  const promptPain = async (sessionExerciseId: string, exerciseName: string) => {
    const pain = await dialog.choose<PainFlag>(exerciseName, [
      { value: 'none', label: 'No pain' },
      { value: 'mild', label: 'Mild discomfort' },
      { value: 'sharp', label: 'Sharp pain', style: 'destructive' },
    ], 'Any pain during that exercise?');
    if (pain) setExercisePain(session.id, sessionExerciseId, pain);
  };

  const promptMuscleFeedback = async (muscleGroup: MuscleGroup) => {
    const pump = await dialog.choose<PumpLevel>(`${muscleGroup} pump`, [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' },
    ], 'How was your muscle pump for that muscle group?');
    if (!pump) return;

    const effort = await dialog.choose<EffortLevel>('Effort level', [
      { value: 'easy', label: 'Easy' },
      { value: 'moderate', label: 'Moderate' },
      { value: 'hard', label: 'Hard' },
      { value: 'max', label: 'Max effort' },
    ], 'How hard did that feel overall?');
    if (!effort) return;

    setMuscleFeedback(session.id, muscleGroup, { pump, effort });
  };

  const checkExerciseCompletion = async (exercise: Exercise, sessionExercise: SessionExercise) => {
    const fresh = useStore.getState().sessions.find((s) => s.id === session.id);
    if (!fresh) return;
    const se = fresh.exercises.find((e) => e.id === sessionExercise.id);
    if (!se) return;
    const exerciseDone = se.sets.length > 0 && se.sets.every((s) => s.type === 'warmup' || s.logged);

    if (exerciseDone && se.painFlag === undefined) {
      await promptPain(se.id, exercise.name);
    }

    const groupExercises = day.exercises
      .map((te) => exerciseById.get(te.exerciseId))
      .filter((e): e is Exercise => !!e && e.muscleGroup === exercise.muscleGroup);
    const latest = useStore.getState().sessions.find((s) => s.id === session.id);
    if (!latest) return;
    const groupDone = groupExercises.every((ex) => {
      const gse = latest.exercises.find((s) => s.exerciseId === ex.id);
      return gse && gse.sets.length > 0 && gse.sets.every((s) => s.type === 'warmup' || s.logged);
    });
    if (groupDone && !latest.muscleFeedback?.[exercise.muscleGroup]) {
      await promptMuscleFeedback(exercise.muscleGroup);
    }
  };

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
              onPress={finishWorkout}
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
              <Pressable style={styles.finishButton} onPress={finishWorkout}>
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

        {blockComplete && (
          <View style={styles.blockDoneCard}>
            <Ionicons name="trophy-outline" size={20} color={colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={styles.blockDoneTitle}>Block complete</Text>
              <Text style={styles.blockDoneBody}>
                You finished every day of week {meso.weeks}. The next block keeps these days and the
                set counts you ended on, and picks your weights up where this one left off.
              </Text>
            </View>
            <Pressable style={styles.blockDoneButton} onPress={startNextBlock}>
              <Text style={styles.blockDoneButtonText}>Next Block</Text>
            </Pressable>
          </View>
        )}

        {day.exercises.length === 0 && (
          <Text style={styles.empty}>This day has no exercises yet. Edit it from the Mesos tab.</Text>
        )}
        {exerciseRows.map(({ te, idx, exercise, sessionExercise, showTag, suggestion, suggestedTarget, lowPumpStreak, supersetPosition }) => {
          return (
            <View key={te.id}>
              {showTag && (
                <View style={{ marginBottom: spacing.sm, marginTop: idx === 0 ? 0 : spacing.md }}>
                  <MuscleTag muscle={exercise.muscleGroup as MuscleGroup} />
                </View>
              )}
              {showTag && lowPumpStreak >= 2 && (
                <View style={styles.swapBanner}>
                  <Text style={styles.swapBannerText}>
                    Low pump on {exercise.muscleGroup} {lowPumpStreak} sessions in a row.
                  </Text>
                  <Pressable
                    onPress={() =>
                      setSwapTarget({ templateExerciseId: te.id, muscleGroup: exercise.muscleGroup, exerciseId: te.exerciseId })
                    }
                  >
                    <Text style={styles.swapBannerLink}>Try a different exercise?</Text>
                  </Pressable>
                </View>
              )}
              <ExerciseCard
                exercise={exercise}
                templateExercise={te}
                sessionExercise={sessionExercise}
                sessionId={session.id}
                suggestion={suggestion}
                suggestedTarget={suggestedTarget}
                isDeloadWeek={isDeloadWeek}
                unit={unit}
                onHistory={() => navigation.navigate('ExerciseHistory', { exerciseId: exercise.id })}
                onShowForm={() => setFormGuideExercise(exercise)}
                onSetLogged={startRestTimer}
                onExerciseCompletionCheck={() => checkExerciseCompletion(exercise, sessionExercise)}
                supersetPosition={supersetPosition}
                onEditNote={() => editExerciseNote(exercise)}
              />
              {supersetPosition && !supersetPosition.isLast && (
                <View style={styles.supersetJoin}>
                  <Ionicons name="arrow-down" size={12} color={colors.accent} />
                  <Text style={styles.supersetJoinText}>no rest — straight into</Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {restTimer && (
        <RestTimerBar
          secondsLeft={restTimer.secondsLeft}
          totalSeconds={restTimer.totalSeconds}
          running={restTimer.running}
          onToggleRunning={toggleRestTimer}
          onAddTime={addRestTime}
          onSkip={skipRestTimer}
        />
      )}

      <ExercisePickerModal
        visible={swapTarget !== null}
        onClose={() => setSwapTarget(null)}
        muscleGroupFilter={swapTarget?.muscleGroup}
        excludeExerciseId={swapTarget?.exerciseId}
        onSelect={(ex) => {
          if (swapTarget) swapDayExercise(meso.id, day.id, swapTarget.templateExerciseId, ex.id);
        }}
      />

      <FormGuideModal
        visible={formGuideExercise !== null}
        exercise={formGuideExercise}
        onClose={() => setFormGuideExercise(null)}
      />
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
  swapBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f6a35c22',
    borderWidth: 1,
    borderColor: '#f6a35c55',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  swapBannerText: { color: colors.textSecondary, fontSize: 12, flex: 1 },
  swapBannerLink: { color: '#f6a35c', fontSize: 12, fontWeight: '700' },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentMuted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  suggestionRowText: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
  suggestionLink: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  adjustRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  adjustLabel: { color: colors.textSecondary, fontSize: 12 },
  adjustInput: {
    backgroundColor: colors.inputBackground,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    width: 64,
    textAlign: 'center',
    fontSize: 12,
  },
  applyButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  applyButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  colHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  colHeader: { color: colors.textMuted, fontSize: 11, fontWeight: '700', textAlign: 'center', width: 44 },
  setRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.xs },
  setRowWarmup: { opacity: 0.55 },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: colors.accentMuted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  noteText: { flex: 1, color: colors.textPrimary, fontSize: 13, lineHeight: 18 },
  blockDoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.success,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  blockDoneTitle: { color: colors.success, fontWeight: '800', fontSize: 15 },
  blockDoneBody: { color: colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 2 },
  blockDoneButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  blockDoneButtonText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  exerciseNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  supersetBadge: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supersetBadgeText: { color: colors.accent, fontSize: 12, fontWeight: '800' },
  supersetJoin: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: -spacing.xs,
    marginBottom: spacing.xs,
  },
  supersetJoinText: { color: colors.accent, fontSize: 11, fontWeight: '700' },
  setMenuButton: { width: 20, height: 44, alignItems: 'center', justifyContent: 'center' },
  setInput: {
    flex: 1,
    minWidth: 0,
    textAlign: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: radius.sm,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logBox: {
    width: 44,
    height: 44,
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
