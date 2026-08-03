import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useStore } from '../store/useStore';
import ScreenContainer from '../components/ScreenContainer';
import ExercisePickerModal from '../components/ExercisePickerModal';
import ExerciseTargetCard from '../components/ExerciseTargetCard';
import ReorderExercisesModal from '../components/ReorderExercisesModal';
import { colors, radius, spacing } from '../theme/theme';
import { TemplatesStackParamList } from '../navigation/types';
import { TemplateExercise } from '../types';
import { genId } from '../utils/id';

type Props = NativeStackScreenProps<TemplatesStackParamList, 'TemplateEditor'>;

export default function TemplateEditorScreen({ route, navigation }: Props) {
  const templateId = route.params?.templateId;
  const existing = useStore((s) => s.templates.find((t) => t.id === templateId));
  const addTemplate = useStore((s) => s.addTemplate);
  const updateTemplate = useStore((s) => s.updateTemplate);
  const deleteTemplate = useStore((s) => s.deleteTemplate);

  const [name, setName] = useState(existing?.name ?? '');
  const [exercises, setExercises] = useState<TemplateExercise[]>(existing?.exercises ?? []);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [reorderVisible, setReorderVisible] = useState(false);

  const addExercise = (exerciseId: string) => {
    setExercises((prev) => [
      ...prev,
      { id: genId(), exerciseId, sets: [{ id: genId(), repRange: '8-12', rir: 3, restSeconds: 90 }] },
    ]);
  };

  const save = () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter a template name.');
      return;
    }
    if (existing) {
      updateTemplate(existing.id, { name: name.trim(), exercises });
    } else {
      addTemplate(name.trim(), exercises);
    }
    navigation.goBack();
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert('Delete Template', `Delete "${existing.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteTemplate(existing.id);
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <ScreenContainer style={{ padding: spacing.md }}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Template Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Push Day"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
        />

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.label}>Exercises</Text>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            {exercises.length > 1 && (
              <Pressable style={styles.addExerciseButton} onPress={() => setReorderVisible(true)}>
                <Ionicons name="reorder-three" size={16} color={colors.accent} />
                <Text style={styles.addExerciseText}>Reorder</Text>
              </Pressable>
            )}
            <Pressable style={styles.addExerciseButton} onPress={() => setPickerVisible(true)}>
              <Ionicons name="add" size={16} color={colors.accent} />
              <Text style={styles.addExerciseText}>Add Exercise</Text>
            </Pressable>
          </View>
        </View>

        {exercises.map((te) => (
          <ExerciseTargetCard
            key={te.id}
            templateExercise={te}
            onChange={(next) => setExercises((prev) => prev.map((e) => (e.id === next.id ? next : e)))}
            onRemove={() => setExercises((prev) => prev.filter((e) => e.id !== te.id))}
          />
        ))}
        {exercises.length === 0 && (
          <Text style={styles.empty}>No exercises added yet.</Text>
        )}

        <Pressable style={styles.saveButton} onPress={save}>
          <Text style={styles.saveText}>Save Template</Text>
        </Pressable>

        {existing && (
          <Pressable style={styles.deleteButton} onPress={remove}>
            <Text style={styles.deleteText}>Delete Template</Text>
          </Pressable>
        )}
      </ScrollView>

      <ExercisePickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={(ex) => addExercise(ex.id)}
      />
      <ReorderExercisesModal
        visible={reorderVisible}
        exercises={exercises}
        onClose={() => setReorderVisible(false)}
        onSave={setExercises}
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
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addExerciseButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addExerciseText: { color: colors.accent, fontWeight: '600', fontSize: 13 },
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
