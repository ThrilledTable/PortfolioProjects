import React, { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../store/useStore';
import ScreenContainer from '../components/ScreenContainer';
import { colors, radius, spacing } from '../theme/theme';
import { Exercise, WorkoutSession } from '../types';
import { computeSessionSummary } from '../utils/sessionSummary';
import { formatDuration } from '../utils/format';
import { convertWeightTotal } from '../utils/units';

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function HistoryScreen() {
  const sessions = useStore((s) => s.sessions);
  const exercises = useStore((s) => s.exercises);
  const unit = useStore((s) => s.settings.unit);

  const exerciseById = useMemo(() => {
    const map = new Map<string, Exercise>();
    exercises.forEach((e) => map.set(e.id, e));
    return map;
  }, [exercises]);

  const rows = useMemo(() => {
    return sessions
      .map((session) => ({ session, summary: computeSessionSummary(session, exerciseById) }))
      .filter((r) => r.summary.totalSets > 0)
      .sort((a, b) => new Date(b.session.date).getTime() - new Date(a.session.date).getTime());
  }, [sessions, exerciseById]);

  const renderItem = ({ session, summary }: { session: WorkoutSession; summary: ReturnType<typeof computeSessionSummary> }) => {
    const duration = session.completedAt
      ? (new Date(session.completedAt).getTime() - new Date(session.date).getTime()) / 1000
      : null;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{session.mesoName} · Week {session.week} · {session.dayName}</Text>
          <Text style={styles.cardDate}>{formatDate(session.date)}</Text>
        </View>
        <View style={styles.statsRow}>
          {session.completedAt ? (
            <View style={styles.completedTag}>
              <Ionicons name="checkmark-circle" size={13} color={colors.success} />
              <Text style={styles.completedTagText}>{duration !== null ? formatDuration(duration) : 'Completed'}</Text>
            </View>
          ) : (
            <Text style={styles.inProgressText}>In progress</Text>
          )}
          <Text style={styles.stat}>{summary.totalSets} sets</Text>
          <Text style={styles.stat}>{convertWeightTotal(summary.totalVolume, unit).toLocaleString()} {unit}</Text>
        </View>
        {!!session.notes && <Text style={styles.notes} numberOfLines={2}>{session.notes}</Text>}
      </View>
    );
  };

  return (
    <ScreenContainer style={{ padding: spacing.md }}>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.session.id}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        renderItem={({ item }) => renderItem(item)}
        ListEmptyComponent={
          <Text style={styles.empty}>No workouts logged yet.</Text>
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: 6,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  cardTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 14, flex: 1, marginRight: spacing.sm },
  cardDate: { color: colors.textMuted, fontSize: 12 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  completedTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  completedTagText: { color: colors.success, fontSize: 12, fontWeight: '700' },
  inProgressText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  stat: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  notes: { color: colors.textSecondary, fontSize: 12, fontStyle: 'italic', marginTop: 2 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
});
