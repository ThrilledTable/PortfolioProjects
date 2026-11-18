import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useStore } from '../store/useStore';
import ScreenContainer from '../components/ScreenContainer';
import MuscleTag from '../components/MuscleTag';
import { colors, radius, spacing } from '../theme/theme';
import { ExercisesStackParamList } from '../navigation/types';
import {
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_CATEGORY,
  EquipmentCategory,
  MUSCLE_GROUPS,
  MuscleGroup,
} from '../types';

type Props = NativeStackScreenProps<ExercisesStackParamList, 'ExercisesList'>;

export default function ExercisesListScreen({ navigation }: Props) {
  const exercises = useStore((s) => s.exercises);
  const [query, setQuery] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<MuscleGroup | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<EquipmentCategory | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const order = (m: MuscleGroup) => MUSCLE_GROUPS.indexOf(m);
    return exercises
      .filter((e) => {
        if (muscleFilter && e.muscleGroup !== muscleFilter) return false;
        if (categoryFilter && EQUIPMENT_CATEGORY[e.equipment] !== categoryFilter) return false;
        if (!q) return true;
        return e.name.toLowerCase().includes(q) || e.muscleGroup.toLowerCase().includes(q);
      })
      // Seed order is append-order, which means nothing to a reader.
      .sort(
        (a, b) =>
          order(a.muscleGroup) - order(b.muscleGroup) || a.name.localeCompare(b.name)
      );
  }, [exercises, query, muscleFilter, categoryFilter]);

  return (
    <ScreenContainer insetTop extraTop={spacing.md} style={{ paddingHorizontal: spacing.md }}>
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
      <View style={styles.categoryRow}>
        {EQUIPMENT_CATEGORIES.map((c) => (
          <Pressable
            key={c}
            style={[styles.categoryChip, categoryFilter === c && styles.filterChipSelected]}
            onPress={() => setCategoryFilter(categoryFilter === c ? null : c)}
          >
            <Text style={[styles.filterChipText, categoryFilter === c && styles.filterChipTextSelected]}>
              {c}
            </Text>
          </Pressable>
        ))}
      </View>

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
              <View style={styles.metaRow}>
                <MuscleTag muscle={item.muscleGroup} />
                <Text style={styles.equipment}>{item.equipment}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
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
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  categoryChip: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
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
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  equipment: { color: colors.textSecondary, fontSize: 13 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
});
