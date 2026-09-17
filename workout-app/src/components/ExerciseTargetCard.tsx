import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../store/useStore';
import { TemplateExercise, TargetSet } from '../types';
import { colors, radius, spacing } from '../theme/theme';
import MuscleTag from './MuscleTag';
import { genId } from '../utils/id';

export default function ExerciseTargetCard({
  templateExercise,
  onChange,
  onRemove,
  dragHandlers,
}: {
  templateExercise: TemplateExercise;
  onChange: (next: TemplateExercise) => void;
  onRemove: () => void;
  dragHandlers?: object;
}) {
  const exercise = useStore((s) => s.exercises.find((e) => e.id === templateExercise.exerciseId));
  const defaultRestSeconds = useStore((s) => s.settings.defaultRestSeconds);

  const updateSet = (setId: string, patch: Partial<TargetSet>) => {
    onChange({
      ...templateExercise,
      sets: templateExercise.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
    });
  };

  const addSet = () => {
    const last = templateExercise.sets[templateExercise.sets.length - 1];
    onChange({
      ...templateExercise,
      sets: [
        ...templateExercise.sets,
        {
          id: genId(),
          repRange: last?.repRange ?? '8-12',
          rir: last?.rir ?? 3,
          restSeconds: last?.restSeconds ?? defaultRestSeconds,
        },
      ],
    });
  };

  const removeSet = (setId: string) => {
    onChange({ ...templateExercise, sets: templateExercise.sets.filter((s) => s.id !== setId) });
  };

  if (!exercise) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={styles.name}>{exercise.name}</Text>
          <MuscleTag muscle={exercise.muscleGroup} />
        </View>
        <Pressable onPress={onRemove} hitSlop={10}>
          <Ionicons name="trash-outline" size={20} color={colors.danger} />
        </Pressable>
        {dragHandlers && (
          <View {...dragHandlers} hitSlop={10} style={styles.dragHandle}>
            <Ionicons name="reorder-three" size={22} color={colors.textMuted} />
          </View>
        )}
      </View>

      <View style={styles.colHeaderRow}>
        <Text style={styles.colHeader}>SET</Text>
        <Text style={styles.colHeader}>REPS</Text>
        <Text style={styles.colHeader}>REST</Text>
        <View style={{ width: 20 }} />
      </View>
      {templateExercise.sets.map((s, i) => (
        <View key={s.id} style={styles.setRow}>
          <Text style={styles.setIndex}>{i + 1}</Text>
          <TextInput
            style={styles.repInput}
            value={s.repRange}
            onChangeText={(v) => updateSet(s.id, { repRange: v })}
            placeholder="8-12"
            placeholderTextColor={colors.textMuted}
          />
          <TextInput
            style={styles.restInput}
            value={String(s.restSeconds)}
            onChangeText={(v) =>
              updateSet(s.id, { restSeconds: Number(v.replace(/[^0-9]/g, '')) || 0 })
            }
            keyboardType="number-pad"
            placeholderTextColor={colors.textMuted}
          />
          <Pressable onPress={() => removeSet(s.id)} hitSlop={10}>
            <Ionicons name="close-circle-outline" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
      ))}
      <Pressable style={styles.addSetButton} onPress={addSet}>
        <Ionicons name="add" size={16} color={colors.accent} />
        <Text style={styles.addSetText}>Add Set</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  dragHandle: { paddingLeft: 2 },
  name: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  colHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  colHeader: { color: colors.textMuted, fontSize: 11, fontWeight: '700', width: 56, textAlign: 'center' },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  setIndex: { color: colors.textSecondary, width: 56, textAlign: 'center', fontSize: 13 },
  repInput: {
    width: 56,
    textAlign: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: radius.sm,
    paddingVertical: 8,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  restInput: {
    width: 56,
    textAlign: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: radius.sm,
    paddingVertical: 8,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addSetButton: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 4 },
  addSetText: { color: colors.accent, fontWeight: '600', fontSize: 13 },
});
