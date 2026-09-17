import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useStore } from '../store/useStore';
import ScreenContainer from '../components/ScreenContainer';
import MuscleTag from '../components/MuscleTag';
import { colors, radius, spacing } from '../theme/theme';
import { ExercisesStackParamList } from '../navigation/types';
import { MUSCLE_GROUPS, MuscleGroup } from '../types';

type Props = NativeStackScreenProps<ExercisesStackParamList, 'ExercisesList'>;

export default function ExercisesListScreen({ navigation }: Props) {
  const exercises = useStore((s) => s.exercises);
  const [query, setQuery] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<MuscleGroup | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter((e) => {
      if (muscleFilter && e.muscleGroup !== muscleFilter) return false;
      if (!q) return true;
      return e.name.toLowerCase().includes(q) || e.muscleGroup.toLowerCase().includes(q);
    });
  }, [exercises, query, muscleFilter]);

  return (
    <ScreenContainer style={{ paddingTop: 60, paddingHorizontal: spacing.md }}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Exercises</Text>
        <Pressable style={styles.addButton} onPress={() => navigation.navigate('AddExercise')}>
          <Ionicons name="add" size={22} color={colors.textPrimary} />
        </Pressable>
      </View>
      <TextInput
        style={styles.search}
        placeholder="Search exercises"
        placeholderTextColor={colors.textMuted}
        value={query}
        onChangeText={setQuery}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        <Pressable
          style={[styles.filterChip, muscleFilter === null && styles.filterChipSelected]}
          onPress={() => setMuscleFilter(null)}
        >
          <Text style={[styles.filterChipText, muscleFilter === null && styles.filterChipTextSelected]}>
            All
          </Text>
        </Pressable>
        {MUSCLE_GROUPS.map((m) => (
          <Pressable
            key={m}
            style={[styles.filterChip, muscleFilter === m && styles.filterChipSelected]}
            onPress={() => setMuscleFilter(muscleFilter === m ? null : m)}
          >
            <Text style={[styles.filterChipText, muscleFilter === m && styles.filterChipTextSelected]}>
              {m}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => navigation.navigate('ExerciseHistory', { exerciseId: item.id })}
          >
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.name}>{item.name}</Text>
              <MuscleTag muscle={item.muscleGroup} />
            </View>
            <Text style={styles.equipment}>{item.equipment}</Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No exercises match your filters.</Text>}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  title: { color: colors.textPrimary, fontSize: 28, fontWeight: '800' },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  filterScroll: { flexGrow: 0, flexShrink: 0, height: 36, marginBottom: spacing.sm },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  filterChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipSelected: { backgroundColor: colors.accentMuted, borderColor: colors.accent },
  filterChipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  filterChipTextSelected: { color: colors.textPrimary },
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
