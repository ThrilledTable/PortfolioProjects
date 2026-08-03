import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useStore } from '../store/useStore';
import ScreenContainer from '../components/ScreenContainer';
import MuscleTag from '../components/MuscleTag';
import { colors, radius, spacing } from '../theme/theme';
import { ExercisesStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<ExercisesStackParamList, 'ExercisesList'>;

export default function ExercisesListScreen({ navigation }: Props) {
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
        ListEmptyComponent={<Text style={styles.empty}>No exercises match "{query}"</Text>}
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
