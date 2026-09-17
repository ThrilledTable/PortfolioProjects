import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { colors, spacing } from '../theme/theme';

const VIEW_WIDTH = 320;
const VIEW_HEIGHT = 130;
const PADDING_X = 14;
const PADDING_Y = 18;

export interface ChartPoint {
  date: string;
  value: number;
}

function formatShortDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function ProgressChart({
  title,
  unit,
  points,
}: {
  title: string;
  unit: string;
  points: ChartPoint[];
}) {
  if (points.length === 0) {
    return null;
  }

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const coords = points.map((p, i) => {
    const x =
      points.length === 1
        ? VIEW_WIDTH / 2
        : PADDING_X + (i / (points.length - 1)) * (VIEW_WIDTH - PADDING_X * 2);
    const y = PADDING_Y + (1 - (p.value - min) / range) * (VIEW_HEIGHT - PADDING_Y * 2);
    return { x, y };
  });

  const polylinePoints = coords.map((c) => `${c.x},${c.y}`).join(' ');
  const latest = points[points.length - 1];
  const first = points[0];
  const delta = latest.value - first.value;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        {points.length > 1 && (
          <Text style={[styles.delta, delta >= 0 ? styles.deltaUp : styles.deltaDown]}>
            {delta >= 0 ? '+' : ''}
            {delta} {unit} since {formatShortDate(first.date)}
          </Text>
        )}
      </View>
      <Text style={styles.latestValue}>
        {latest.value} <Text style={styles.latestUnit}>{unit}</Text>
      </Text>

      <Svg width="100%" height={VIEW_HEIGHT} viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}>
        <Line
          x1={PADDING_X}
          y1={VIEW_HEIGHT - PADDING_Y}
          x2={VIEW_WIDTH - PADDING_X}
          y2={VIEW_HEIGHT - PADDING_Y}
          stroke={colors.border}
          strokeWidth={1}
        />
        {points.length > 1 && (
          <Polyline points={polylinePoints} fill="none" stroke={colors.accent} strokeWidth={2} />
        )}
        {coords.map((c, i) => (
          <Circle key={i} cx={c.x} cy={c.y} r={3.5} fill={colors.accent} />
        ))}
      </Svg>

      <View style={styles.axisRow}>
        <Text style={styles.axisLabel}>{formatShortDate(first.date)}</Text>
        {points.length > 1 && <Text style={styles.axisLabel}>{formatShortDate(latest.date)}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  delta: { fontSize: 12, fontWeight: '700' },
  deltaUp: { color: colors.success },
  deltaDown: { color: colors.danger },
  latestValue: { color: colors.textPrimary, fontSize: 26, fontWeight: '800', marginTop: 2, marginBottom: spacing.xs },
  latestUnit: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },
  axisRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  axisLabel: { color: colors.textMuted, fontSize: 11 },
});
