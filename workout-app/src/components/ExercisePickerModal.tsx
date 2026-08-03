import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../store/useStore';
import { Exercise } from '../types';
import { colors, radius, spacing } from '../theme/theme';
import MuscleTag from './MuscleTag';

export default function ExercisePickerModal({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
}) {
  const exercises = useStore((s) => s.exercises);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return exercises;
    return exercises.filter(
      (e) => e.name.toLowerCase().includes(q) || e.muscleGroup.toLowerCase().includes(q)
    );
  }, [exercises, query]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Add Exercise</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={26} color={colors.textPrimary} />
          </Pressable>
        </View>
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
              onPress={() => {
                onSelect(item);
                onClose();
              }}
            >
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={styles.name}>{item.name}</Text>
                <MuscleTag muscle={item.muscleGroup} />
              </View>
              <Text style={styles.equipment}>{item.equipment}</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>No exercises match "{query}"</Text>
          }
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 60, paddingHorizontal: spacing.md },
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
});
