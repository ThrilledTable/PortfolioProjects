import React, { useRef, useState } from 'react';
import { Alert, Animated, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useStore } from '../store/useStore';
import ScreenContainer from '../components/ScreenContainer';
import ExercisePickerModal from '../components/ExercisePickerModal';
import ExerciseTargetCard from '../components/ExerciseTargetCard';
import VolumeSummary from '../components/VolumeSummary';
import { colors, radius, spacing } from '../theme/theme';
import { MesosStackParamList } from '../navigation/types';
import { MesoDay, TemplateExercise } from '../types';
import { genId } from '../utils/id';

type Props = NativeStackScreenProps<MesosStackParamList, 'MesoEditor'>;

const DEFAULT_ROW_HEIGHT = 90;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function indexForOffset(heights: number[], originIndex: number, dy: number) {
  let idx = originIndex;
  let remaining = dy;
  if (dy > 0) {
    while (idx < heights.length - 1 && remaining >= heights[idx + 1] / 2) {
      remaining -= heights[idx + 1];
      idx++;
    }
  } else if (dy < 0) {
    while (idx > 0 && -remaining >= heights[idx - 1] / 2) {
      remaining += heights[idx - 1];
      idx--;
    }
  }
  return idx;
}

function cumulativeOffset(heights: number[], fromIndex: number, toIndex: number) {
  let sum = 0;
  if (toIndex > fromIndex) {
    for (let i = fromIndex + 1; i <= toIndex; i++) sum += heights[i];
  } else if (toIndex < fromIndex) {
    for (let i = toIndex; i < fromIndex; i++) sum -= heights[i];
  }
  return sum;
}

function DraggableExerciseRow({
  isActive,
  dragY,
  onGrant,
  onMove,
  onRelease,
  onLayout,
  children,
}: {
  isActive: boolean;
  dragY: Animated.Value;
  onGrant: () => void;
  onMove: (dy: number) => void;
  onRelease: () => void;
  onLayout: (height: number) => void;
  children: (dragHandlers: object) => React.ReactNode;
}) {
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: onGrant,
      onPanResponderMove: (_, gesture) => onMove(gesture.dy),
      onPanResponderRelease: onRelease,
      onPanResponderTerminate: onRelease,
    })
  ).current;

  return (
    <Animated.View
      onLayout={(e) => onLayout(e.nativeEvent.layout.height)}
      style={[
        isActive && { transform: [{ translateY: dragY }], zIndex: 10 },
        isActive && styles.rowActive,
      ]}
    >
      {children(panResponder.panHandlers)}
    </Animated.View>
  );
}

export default function MesoEditorScreen({ route, navigation }: Props) {
  const mesoId = route.params?.mesoId;
  const existing = useStore((s) => s.mesocycles.find((m) => m.id === mesoId));
  const exercisesById = useStore((s) => s.exercises);
  const addMesocycle = useStore((s) => s.addMesocycle);
  const updateMesocycle = useStore((s) => s.updateMesocycle);
  const deleteMesocycle = useStore((s) => s.deleteMesocycle);
  const defaultRestSeconds = useStore((s) => s.settings.defaultRestSeconds);

  const [name, setName] = useState(existing?.name ?? '');
  const [weeks, setWeeks] = useState(String(existing?.weeks ?? 4));
  const [deloadWeeks, setDeloadWeeks] = useState<number[]>(existing?.deloadWeeks ?? []);
  const [days, setDays] = useState<MesoDay[]>(existing?.days ?? []);
  const [exercisePickerDayId, setExercisePickerDayId] = useState<string | null>(null);

  const dragY = useRef(new Animated.Value(0)).current;
  const [dragActive, setDragActive] = useState<{ dayId: string; id: string } | null>(null);
  const dragOrigin = useRef<{ dayId: string; id: string; originIndex: number; heights: number[] } | null>(null);
  const rowHeightsRef = useRef<Record<string, number>>({});

  const toggleDeloadWeek = (weekNum: number) => {
    setDeloadWeeks((prev) =>
      prev.includes(weekNum) ? prev.filter((w) => w !== weekNum) : [...prev, weekNum]
    );
  };

  const addDay = () => {
    setDays((prev) => [
      ...prev,
      { id: genId(), name: `Day ${prev.length + 1}`, muscleGroups: [], exercises: [] },
    ]);
  };

  const removeDay = (dayId: string) => {
    setDays((prev) => prev.filter((d) => d.id !== dayId));
  };

  const renameDay = (dayId: string, dayName: string) => {
    setDays((prev) => prev.map((d) => (d.id === dayId ? { ...d, name: dayName } : d)));
  };

  const updateDayExercise = (dayId: string, next: TemplateExercise) => {
    setDays((prev) =>
      prev.map((d) =>
        d.id !== dayId ? d : { ...d, exercises: d.exercises.map((e) => (e.id === next.id ? next : e)) }
      )
    );
  };

  const removeDayExercise = (dayId: string, teId: string) => {
    setDays((prev) =>
      prev.map((d) => (d.id !== dayId ? d : { ...d, exercises: d.exercises.filter((e) => e.id !== teId) }))
    );
  };

  const addExerciseToDay = (dayId: string, exerciseId: string) => {
    setDays((prev) =>
      prev.map((d) =>
        d.id !== dayId
          ? d
          : { ...d, exercises: [...d.exercises, { id: genId(), exerciseId, sets: [{ id: genId(), repRange: '8-12', rir: 3, restSeconds: defaultRestSeconds }] }] }
      )
    );
  };

  const deriveMuscleGroups = (day: MesoDay) => {
    const set = new Set<string>();
    for (const te of day.exercises) {
      const ex = exercisesById.find((e) => e.id === te.exerciseId);
      if (ex) set.add(ex.muscleGroup);
    }
    return Array.from(set) as MesoDay['muscleGroups'];
  };

  const handleDragGrant = (dayId: string, id: string) => {
    const day = days.find((d) => d.id === dayId);
    if (!day) return;
    const originIndex = day.exercises.findIndex((e) => e.id === id);
    if (originIndex === -1) return;
    const heights = day.exercises.map((e) => rowHeightsRef.current[e.id] ?? DEFAULT_ROW_HEIGHT);
    dragOrigin.current = { dayId, id, originIndex, heights };
    dragY.setValue(0);
    setDragActive({ dayId, id });
  };

  const handleDragMove = (dayId: string, id: string, dy: number) => {
    const origin = dragOrigin.current;
    if (!origin || origin.dayId !== dayId || origin.id !== id) return;
    setDays((prev) =>
      prev.map((d) => {
        if (d.id !== dayId) return d;
        const currentIndex = d.exercises.findIndex((e) => e.id === id);
        if (currentIndex === -1) return d;
        const newIndex = clamp(indexForOffset(origin.heights, origin.originIndex, dy), 0, d.exercises.length - 1);
        let exercises = d.exercises;
        if (newIndex !== currentIndex) {
          exercises = [...d.exercises];
          const [moved] = exercises.splice(currentIndex, 1);
          exercises.splice(newIndex, 0, moved);
        }
        dragY.setValue(dy - cumulativeOffset(origin.heights, origin.originIndex, newIndex));
        return { ...d, exercises };
      })
    );
  };

  const handleDragRelease = () => {
    dragOrigin.current = null;
    setDragActive(null);
    Animated.timing(dragY, { toValue: 0, duration: 120, useNativeDriver: false }).start();
  };

  const save = () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter a mesocycle name.');
      return;
    }
    const weeksNum = Math.max(1, Number(weeks) || 1);
    const finalDays = days.map((d) => ({ ...d, muscleGroups: deriveMuscleGroups(d) }));
    const finalDeloadWeeks = deloadWeeks.filter((w) => w <= weeksNum);
    if (existing) {
      updateMesocycle(existing.id, {
        name: name.trim(),
        weeks: weeksNum,
        days: finalDays,
        deloadWeeks: finalDeloadWeeks,
      });
    } else {
      addMesocycle(name.trim(), weeksNum, finalDays, finalDeloadWeeks);
    }
    navigation.navigate('MesosList');
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert('Delete Mesocycle', `Delete "${existing.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteMesocycle(existing.id);
          navigation.navigate('MesosList');
        },
      },
    ]);
  };

  return (
    <ScreenContainer style={{ padding: spacing.md }}>
      <ScrollView keyboardShouldPersistTaps="handled" scrollEnabled={dragActive === null}>
        <Text style={styles.label}>Mesocycle Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Ai Meso"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Weeks</Text>
        <TextInput
          style={styles.input}
          value={weeks}
          onChangeText={(v) => setWeeks(v.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
        />

        <Text style={styles.label}>Deload Weeks</Text>
        <View style={styles.weekChipRow}>
          {Array.from({ length: Math.max(1, Number(weeks) || 1) }, (_, i) => i + 1).map((w) => {
            const selected = deloadWeeks.includes(w);
            return (
              <Pressable
                key={w}
                style={[styles.weekChip, selected && styles.weekChipSelected]}
                onPress={() => toggleDeloadWeek(w)}
              >
                <Text style={[styles.weekChipText, selected && styles.weekChipTextSelected]}>W{w}</Text>
              </Pressable>
            );
          })}
        </View>

        <VolumeSummary days={days} />

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.label}>Days</Text>
          <Pressable style={styles.addExerciseButton} onPress={addDay}>
            <Ionicons name="add" size={16} color={colors.accent} />
            <Text style={styles.addExerciseText}>Add Day</Text>
          </Pressable>
        </View>

        {days.map((day) => (
          <View key={day.id} style={styles.dayCard}>
            <View style={styles.dayHeaderRow}>
              <TextInput
                style={styles.dayNameInput}
                value={day.name}
                onChangeText={(v) => renameDay(day.id, v)}
              />
              <Pressable onPress={() => removeDay(day.id)} hitSlop={10}>
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </Pressable>
            </View>

            {day.exercises.map((te) => (
              <DraggableExerciseRow
                key={te.id}
                isActive={dragActive?.dayId === day.id && dragActive?.id === te.id}
                dragY={dragY}
                onGrant={() => handleDragGrant(day.id, te.id)}
                onMove={(dy) => handleDragMove(day.id, te.id, dy)}
                onRelease={handleDragRelease}
                onLayout={(height) => {
                  rowHeightsRef.current[te.id] = height;
                }}
              >
                {(dragHandlers) => (
                  <ExerciseTargetCard
                    templateExercise={te}
                    onChange={(next) => updateDayExercise(day.id, next)}
                    onRemove={() => removeDayExercise(day.id, te.id)}
                    dragHandlers={day.exercises.length > 1 ? dragHandlers : undefined}
                  />
                )}
              </DraggableExerciseRow>
            ))}

            <View style={styles.dayActionsRow}>
              <Pressable style={styles.dayActionButton} onPress={() => setExercisePickerDayId(day.id)}>
                <Ionicons name="add" size={16} color={colors.accent} />
                <Text style={styles.addExerciseText}>Add Exercise</Text>
              </Pressable>
            </View>
          </View>
        ))}
        {days.length === 0 && <Text style={styles.empty}>No days yet. Tap "Add Day" to start.</Text>}

        <Pressable style={styles.saveButton} onPress={save}>
          <Text style={styles.saveText}>Save Mesocycle</Text>
        </Pressable>

        {existing && (
          <Pressable style={styles.deleteButton} onPress={remove}>
            <Text style={styles.deleteText}>Delete Mesocycle</Text>
          </Pressable>
        )}
      </ScrollView>

      <ExercisePickerModal
        visible={exercisePickerDayId !== null}
        onClose={() => setExercisePickerDayId(null)}
        onSelect={(ex) => exercisePickerDayId && addExerciseToDay(exercisePickerDayId, ex.id)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.textSecondary, fontSize: 13, fontWeight: '700', marginTop: spacing.md, marginBottom: spacing.xs, textTransform: 'uppercase' },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md },
  addExerciseButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  weekChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  weekChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  weekChipSelected: { backgroundColor: '#e0b23c33', borderColor: '#e0b23c' },
  weekChipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  weekChipTextSelected: { color: '#e0b23c' },
  addExerciseText: { color: colors.accent, fontWeight: '600', fontSize: 13 },
  dayCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    padding: spacing.sm,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  dayNameInput: { color: colors.textPrimary, fontSize: 17, fontWeight: '800', flex: 1 },
  dayActionsRow: { flexDirection: 'row', gap: spacing.md, marginTop: 4 },
  dayActionButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowActive: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  empty: { color: colors.textMuted, textAlign: 'center', marginVertical: spacing.md },
  saveButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  deleteButton: { marginTop: spacing.md, alignItems: 'center', paddingVertical: 10, marginBottom: spacing.xl },
  deleteText: { color: colors.danger, fontWeight: '600' },
});
