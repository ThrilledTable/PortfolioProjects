import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../store/useStore';
import { EQUIPMENT_TYPES, Equipment, Exercise, MUSCLE_GROUPS, MuscleGroup } from '../types';
import { colors, radius, spacing } from '../theme/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MuscleTag from './MuscleTag';

export default function ExercisePickerModal({
  visible,
  onClose,
  onSelect,
  muscleGroupFilter,
  excludeExerciseId,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
  muscleGroupFilter?: MuscleGroup;
  excludeExerciseId?: string;
}) {
  const exercises = useStore((s) => s.exercises);
  const addExercise = useStore((s) => s.addExercise);
  const [query, setQuery] = useState('');

  const insets = useSafeAreaInsets();
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter((e) => {
      if (muscleGroupFilter && e.muscleGroup !== muscleGroupFilter) return false;
      if (excludeExerciseId && e.id === excludeExerciseId) return false;
      if (!q) return true;
      return e.name.toLowerCase().includes(q) || e.muscleGroup.toLowerCase().includes(q);
    });
  }, [exercises, query, muscleGroupFilter, excludeExerciseId]);

  // Built inline rather than through a dialog: react-native-web portals every
  // Modal in mount order, so a dialog opened from here lands *underneath* this
  // one -- visible, but impossible to tap.
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMuscle, setNewMuscle] = useState<MuscleGroup>(muscleGroupFilter ?? 'Chest');
  const [newEquipment, setNewEquipment] = useState<Equipment>('Barbell');
  const [error, setError] = useState<string | null>(null);

  const startCreating = () => {
    setNewName(query.trim());
    setNewMuscle(muscleGroupFilter ?? 'Chest');
    setNewEquipment('Barbell');
    setError(null);
    setCreating(true);
  };

  const finish = (exercise: Exercise) => {
    onSelect(exercise);
    setCreating(false);
    setQuery('');
    onClose();
  };

  const submitNew = () => {
    const name = newName.trim();
    if (!name) {
      setError('Give it a name first.');
      return;
    }
    // Don't quietly make a second copy of something already on the list.
    const existing = exercises.find((e) => e.name.toLowerCase() === name.toLowerCase());
    finish(existing ?? addExercise({ name, muscleGroup: newMuscle, equipment: newEquipment }));
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Add Exercise</Text>
          <View style={styles.headerActions}>
            <Pressable
              style={styles.newButton}
              onPress={startCreating}
              accessibilityRole="button"
              accessibilityLabel="Create a new exercise"
            >
              <Ionicons name="add" size={18} color={colors.textPrimary} />
              <Text style={styles.newButtonText}>New</Text>
            </Pressable>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={26} color={colors.textPrimary} />
            </Pressable>
          </View>
        </View>
        {creating ? (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: spacing.xl }}>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.search}
              placeholder="e.g. Reverse Hyper"
              placeholderTextColor={colors.textMuted}
              value={newName}
              onChangeText={(v) => { setNewName(v); setError(null); }}
              autoFocus
            />

            {!muscleGroupFilter && (
              <>
                <Text style={styles.fieldLabel}>Muscle group</Text>
                <View style={styles.chipWrap}>
                  {MUSCLE_GROUPS.map((m) => (
                    <Pressable
                      key={m}
                      style={[styles.chip, newMuscle === m && styles.chipSelected]}
                      onPress={() => setNewMuscle(m)}
                    >
                      <Text style={[styles.chipText, newMuscle === m && styles.chipTextSelected]}>{m}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            <Text style={styles.fieldLabel}>Equipment</Text>
            <View style={styles.chipWrap}>
              {EQUIPMENT_TYPES.map((eq) => (
                <Pressable
                  key={eq}
                  style={[styles.chip, newEquipment === eq && styles.chipSelected]}
                  onPress={() => setNewEquipment(eq)}
                >
                  <Text style={[styles.chipText, newEquipment === eq && styles.chipTextSelected]}>{eq}</Text>
                </Pressable>
              ))}
            </View>

            {!!error && <Text style={styles.error}>{error}</Text>}

            <Pressable style={styles.primaryButton} onPress={submitNew}>
              <Text style={styles.primaryButtonText}>Create & Use</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => setCreating(false)}>
              <Text style={styles.secondaryButtonText}>Back to list</Text>
            </Pressable>
          </ScrollView>
        ) : (
        <>
        <TextInput
          style={styles.search}
          placeholder="Search exercises"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
        />
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: spacing.lg }}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => finish(item)}
            >
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={styles.name}>{item.name}</Text>
                <MuscleTag muscle={item.muscleGroup} />
              </View>
              <Text style={styles.equipment}>{item.equipment}</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.emptyBlock}>
              <Text style={styles.empty}>
                {query.trim() ? `No exercises match "${query.trim()}"` : 'No exercises here yet.'}
              </Text>
              <Pressable style={styles.createRow} onPress={startCreating}>
                <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
                <Text style={styles.createRowText}>
                  {query.trim() ? `Create "${query.trim()}"` : 'Create a new exercise'}
                </Text>
              </Pressable>
            </View>
          }
        />
        </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: { color: colors.textPrimary, fontSize: 22, fontWeight: '800' },
  search: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  name: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
  equipment: { color: colors.textSecondary, fontSize: 13 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  newButtonText: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
  emptyBlock: { alignItems: 'center', gap: spacing.md },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  createRowText: { color: colors.accent, fontWeight: '700', fontSize: 14 },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.accentMuted, borderColor: colors.accent },
  chipText: { color: colors.textSecondary, fontWeight: '600', fontSize: 13 },
  chipTextSelected: { color: colors.textPrimary },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.md },
  primaryButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  secondaryButton: { marginTop: spacing.sm, paddingVertical: 12, alignItems: 'center' },
  secondaryButtonText: { color: colors.textSecondary, fontWeight: '600', fontSize: 14 },
});
