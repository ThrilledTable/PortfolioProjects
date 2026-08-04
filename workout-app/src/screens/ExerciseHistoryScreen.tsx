import React, { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useStore } from '../store/useStore';
import ScreenContainer from '../components/ScreenContainer';
import MuscleTag from '../components/MuscleTag';
import ProgressChart, { ChartPoint } from '../components/ProgressChart';
import { colors, radius, spacing } from '../theme/theme';
import { WorkoutStackParamList, ExercisesStackParamList } from '../navigation/types';
import { convertWeightTotal, formatWeightValue } from '../utils/units';

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
  const unit = useStore((s) => s.settings.unit);
  const history = useMemo(
    () => useStore.getState().getExerciseHistory(exerciseId),
    [sessions, exerciseId]
  );

  const topWeightBySession = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of history) {
      const weights = entry.sets.map((s) => Number(s.weight)).filter((w) => !Number.isNaN(w) && w > 0);
      if (weights.length > 0) map.set(entry.sessionId, Math.max(...weights));
    }
    return map;
  }, [history]);

  const chartPoints: ChartPoint[] = useMemo(() => {
    return [...history]
      .reverse()
      .map((entry) => {
        const lbsValue = topWeightBySession.get(entry.sessionId);
        return lbsValue === undefined ? null : { date: entry.date, value: convertWeightTotal(lbsValue, unit) };
      })
      .filter((p): p is ChartPoint => p !== null);
  }, [history, topWeightBySession, unit]);

  const prSessionId = useMemo(() => {
    if (topWeightBySession.size < 2) return null;
    let best: { sessionId: string; value: number } | null = null;
    for (const [sessionId, value] of topWeightBySession) {
      if (!best || value > best.value) best = { sessionId, value };
    }
    return best?.sessionId ?? null;
  }, [topWeightBySession]);

  return (
    <ScreenContainer style={{ padding: spacing.md }}>
      {exercise && (
        <View style={{ marginBottom: spacing.md, gap: 6 }}>
          <Text style={styles.title}>{exercise.name}</Text>
          <MuscleTag muscle={exercise.muscleGroup} />
        </View>
      )}
      {chartPoints.length > 0 && (
        <ProgressChart title="Top Set Weight" unit={unit} points={chartPoints} />
      )}
      <FlatList
        data={history}
        keyExtractor={(item) => item.sessionId}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        renderItem={({ item }) => (
          <View style={[styles.card, item.sessionId === prSessionId && styles.cardPr]}>
            <View style={styles.cardHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.cardTitle}>Week {item.week} · {item.dayName}</Text>
                {item.sessionId === prSessionId && (
                  <View style={styles.prBadge}>
                    <Ionicons name="trophy" size={11} color={colors.background} />
                    <Text style={styles.prBadgeText}>PR</Text>
                  </View>
                )}
              </View>
              <Text style={styles.cardDate}>{formatDate(item.date)}</Text>
            </View>
            {item.sets.map((s, i) => (
              <View key={s.id} style={styles.setRow}>
                <Text style={styles.setLabel}>Set {i + 1}</Text>
                <Text style={styles.setValue}>
                  {formatWeightValue(s.weight, unit) || '-'} {unit} × {s.reps || '-'} reps @ {s.rir} RIR
                </Text>
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
  cardPr: { borderWidth: 1, borderColor: '#e0b23c' },
  prBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#e0b23c',
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  prBadgeText: { color: colors.background, fontSize: 10, fontWeight: '800' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  cardTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 15 },
  cardDate: { color: colors.textMuted, fontSize: 13 },
  setRow: { flexDirection: 'row', justifyContent: 'space-between' },
  setLabel: { color: colors.textSecondary, fontSize: 13 },
  setValue: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
});
