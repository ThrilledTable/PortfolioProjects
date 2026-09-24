import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useStore } from '../store/useStore';
import { Exercise, MesoDay } from '../types';
import { computeWeeklyVolumeByMuscle } from '../utils/volume';
import { colors, muscleColors, radius, spacing } from '../theme/theme';

export default function VolumeSummary({ days }: { days: MesoDay[] }) {
  const exercises = useStore((s) => s.exercises);
  const exercisesById = useMemo(() => {
    const map = new Map<string, Exercise>();
    exercises.forEach((e) => map.set(e.id, e));
    return map;
  }, [exercises]);

  const volume = useMemo(() => computeWeeklyVolumeByMuscle(days, exercisesById), [days, exercisesById]);

  if (volume.length === 0) return null;

  const maxSets = volume[0].sets;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Weekly Volume by Muscle</Text>
      {volume.map((v) => {
        const color = muscleColors[v.muscle] ?? colors.accent;
        return (
          <View key={v.muscle} style={styles.row}>
            <Text style={styles.label}>{v.muscle}</Text>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { width: `${Math.max(6, (v.sets / maxSets) * 100)}%`, backgroundColor: color },
                ]}
              />
            </View>
            <Text style={styles.count}>{v.sets}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  title: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { color: colors.textSecondary, fontSize: 12, width: 78 },
  barTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  count: { color: colors.textPrimary, fontSize: 12, fontWeight: '700', width: 20, textAlign: 'right' },
});
