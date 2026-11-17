import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useStore } from '../store/useStore';
import ScreenContainer from '../components/ScreenContainer';
import { colors, radius, spacing } from '../theme/theme';
import { ExercisesStackParamList } from '../navigation/types';
import { EQUIPMENT_TYPES, Equipment, MUSCLE_GROUPS, MuscleGroup } from '../types';

type Props = NativeStackScreenProps<ExercisesStackParamList, 'AddExercise'>;

function Chip<T extends string>({
  label,
  selected,
  onPress,
}: {
  label: T;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export default function AddExerciseScreen({ navigation }: Props) {
  const addExercise = useStore((s) => s.addExercise);
  const [name, setName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>('Chest');
  const [equipment, setEquipment] = useState<Equipment>('Barbell');

  const canSave = name.trim().length > 0;

  const save = () => {
    if (!canSave) return;
    addExercise({ name: name.trim(), muscleGroup, equipment });
    navigation.goBack();
  };

  return (
    <ScreenContainer style={{ padding: spacing.md }}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Incline Barbell Press"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Muscle Group</Text>
        <View style={styles.chipRow}>
          {MUSCLE_GROUPS.map((m) => (
            <Chip key={m} label={m} selected={muscleGroup === m} onPress={() => setMuscleGroup(m)} />
          ))}
        </View>

        <Text style={styles.label}>Equipment</Text>
        <View style={styles.chipRow}>
          {EQUIPMENT_TYPES.map((eq) => (
            <Chip key={eq} label={eq} selected={equipment === eq} onPress={() => setEquipment(eq)} />
          ))}
        </View>

        <Pressable style={[styles.saveButton, !canSave && { opacity: 0.5 }]} onPress={save} disabled={!canSave}>
          <Text style={styles.saveText}>Save Exercise</Text>
        </Pressable>
      </ScrollView>
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: { backgroundColor: colors.accentMuted, borderColor: colors.accent },
  chipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  chipTextSelected: { color: colors.textPrimary },
  saveButton: {
    marginTop: spacing.xl,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
