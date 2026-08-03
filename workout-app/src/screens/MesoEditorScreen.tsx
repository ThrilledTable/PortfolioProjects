import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useStore } from '../store/useStore';
import ScreenContainer from '../components/ScreenContainer';
import ExercisePickerModal from '../components/ExercisePickerModal';
import TemplatePickerModal from '../components/TemplatePickerModal';
import ExerciseTargetCard from '../components/ExerciseTargetCard';
import ReorderExercisesModal from '../components/ReorderExercisesModal';
import VolumeSummary from '../components/VolumeSummary';
import { colors, radius, spacing } from '../theme/theme';
import { MesosStackParamList } from '../navigation/types';
import { MesoDay, TemplateExercise } from '../types';
import { genId } from '../utils/id';

type Props = NativeStackScreenProps<MesosStackParamList, 'MesoEditor'>;

function cloneTemplateExercises(exercises: TemplateExercise[]): TemplateExercise[] {
  return exercises.map((te) => ({
    id: genId(),
    exerciseId: te.exerciseId,
    sets: te.sets.map((s) => ({ ...s, id: genId() })),
  }));
}

export default function MesoEditorScreen({ route, navigation }: Props) {
  const mesoId = route.params?.mesoId;
  const existing = useStore((s) => s.mesocycles.find((m) => m.id === mesoId));
  const exercisesById = useStore((s) => s.exercises);
  const addMesocycle = useStore((s) => s.addMesocycle);
  const updateMesocycle = useStore((s) => s.updateMesocycle);
  const deleteMesocycle = useStore((s) => s.deleteMesocycle);

  const [name, setName] = useState(existing?.name ?? '');
  const [weeks, setWeeks] = useState(String(existing?.weeks ?? 4));
  const [deloadWeeks, setDeloadWeeks] = useState<number[]>(existing?.deloadWeeks ?? []);
  const [days, setDays] = useState<MesoDay[]>(existing?.days ?? []);
  const [exercisePickerDayId, setExercisePickerDayId] = useState<string | null>(null);
  const [templatePickerDayId, setTemplatePickerDayId] = useState<string | null>(null);
  const [reorderDayId, setReorderDayId] = useState<string | null>(null);

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

  const setDayExercises = (dayId: string, exercises: TemplateExercise[]) => {
    setDays((prev) => prev.map((d) => (d.id !== dayId ? d : { ...d, exercises })));
  };

  const addExerciseToDay = (dayId: string, exerciseId: string) => {
    setDays((prev) =>
      prev.map((d) =>
        d.id !== dayId
          ? d
          : { ...d, exercises: [...d.exercises, { id: genId(), exerciseId, sets: [{ id: genId(), repRange: '8-12', rir: 3, restSeconds: 90 }] }] }
      )
    );
  };

  const loadTemplateIntoDay = (dayId: string, templateExercises: TemplateExercise[]) => {
    setDays((prev) =>
      prev.map((d) => (d.id !== dayId ? d : { ...d, exercises: [...d.exercises, ...cloneTemplateExercises(templateExercises)] }))
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
    navigation.goBack();
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
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <ScreenContainer style={{ padding: spacing.md }}>
      <ScrollView keyboardShouldPersistTaps="handled">
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
              <ExerciseTargetCard
                key={te.id}
                templateExercise={te}
                onChange={(next) => updateDayExercise(day.id, next)}
                onRemove={() => removeDayExercise(day.id, te.id)}
              />
            ))}

            <View style={styles.dayActionsRow}>
              <Pressable style={styles.dayActionButton} onPress={() => setExercisePickerDayId(day.id)}>
                <Ionicons name="add" size={16} color={colors.accent} />
                <Text style={styles.addExerciseText}>Add Exercise</Text>
              </Pressable>
              <Pressable style={styles.dayActionButton} onPress={() => setTemplatePickerDayId(day.id)}>
                <Ionicons name="download-outline" size={16} color={colors.accent} />
                <Text style={styles.addExerciseText}>Load Template</Text>
              </Pressable>
              {day.exercises.length > 1 && (
                <Pressable style={styles.dayActionButton} onPress={() => setReorderDayId(day.id)}>
                  <Ionicons name="reorder-three" size={16} color={colors.accent} />
                  <Text style={styles.addExerciseText}>Reorder</Text>
                </Pressable>
              )}
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
      <TemplatePickerModal
        visible={templatePickerDayId !== null}
        onClose={() => setTemplatePickerDayId(null)}
        onSelect={(t) => templatePickerDayId && loadTemplateIntoDay(templatePickerDayId, t.exercises)}
      />
      <ReorderExercisesModal
        visible={reorderDayId !== null}
        exercises={days.find((d) => d.id === reorderDayId)?.exercises ?? []}
        onClose={() => setReorderDayId(null)}
        onSave={(next) => reorderDayId && setDayExercises(reorderDayId, next)}
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
