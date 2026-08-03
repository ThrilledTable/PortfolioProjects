import React, { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useStore } from '../store/useStore';
import ScreenContainer from '../components/ScreenContainer';
import MuscleTag from '../components/MuscleTag';
import ProgressChart, { ChartPoint } from '../components/ProgressChart';
import { colors, radius, spacing } from '../theme/theme';
import { WorkoutStackParamList, ExercisesStackParamList } from '../navigation/types';

type Props =
  | NativeStackScreenProps<WorkoutStackParamList, 'ExerciseHistory'>
  | NativeStackScreenProps<ExercisesStackParamList, 'ExerciseHistory'>;

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ExerciseHistoryScreen({ route }: Props) {
  const { exerciseId } = route.params;
  const exercise = useStore((s) => s.exercises.find((e) => e.id === exerciseId));
  const sessions = useStore((s) => s.sessions);
  const history = useMemo(
    () => useStore.getState().getExerciseHistory(exerciseId),
    [sessions, exerciseId]
  );

  const chartPoints: ChartPoint[] = useMemo(() => {
    return [...history]
      .reverse()
      .map((entry) => {
        const weights = entry.sets.map((s) => Number(s.weight)).filter((w) => !Number.isNaN(w) && w > 0);
        if (weights.length === 0) return null;
        return { date: entry.date, value: Math.max(...weights) };
      })
      .filter((p): p is ChartPoint => p !== null);
  }, [history]);

  return (
    <ScreenContainer style={{ padding: spacing.md }}>
      {exercise && (
        <View style={{ marginBottom: spacing.md, gap: 6 }}>
          <Text style={styles.title}>{exercise.name}</Text>
          <MuscleTag muscle={exercise.muscleGroup} />
        </View>
      )}
      {chartPoints.length > 0 && (
        <ProgressChart title="Top Set Weight" unit="lbs" points={chartPoints} />
      )}
      <FlatList
        data={history}
        keyExtractor={(item) => item.sessionId}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Week {item.week} · {item.dayName}</Text>
              <Text style={styles.cardDate}>{formatDate(item.date)}</Text>
            </View>
            {item.sets.map((s, i) => (
              <View key={s.id} style={styles.setRow}>
                <Text style={styles.setLabel}>Set {i + 1}</Text>
                <Text style={styles.setValue}>{s.weight || '-'} lbs × {s.reps || '-'} reps @ {s.rir} RIR</Text>
              </View>
            ))}
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No logged sets yet for this exercise.</Text>
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.textPrimary, fontSize: 24, fontWeight: '800' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: 6,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  cardTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 15 },
  cardDate: { color: colors.textMuted, fontSize: 13 },
  setRow: { flexDirection: 'row', justifyContent: 'space-between' },
  setLabel: { color: colors.textSecondary, fontSize: 13 },
  setValue: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
});
