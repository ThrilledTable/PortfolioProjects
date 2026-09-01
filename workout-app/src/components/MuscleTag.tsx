import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MuscleGroup } from '../types';
import { muscleColors, radius, spacing } from '../theme/theme';

export default function MuscleTag({ muscle }: { muscle: MuscleGroup }) {
  const color = muscleColors[muscle] ?? '#7c6cf6';
  return (
    <View style={[styles.tag, { backgroundColor: color + '33', borderColor: color + '55' }]}>
      <View style={[styles.bars]}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.bar, { backgroundColor: color }]} />
        ))}
      </View>
      <Text style={[styles.text, { color }]}>{muscle.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: 6,
  },
  bars: {
    flexDirection: 'row',
    gap: 2,
    alignItems: 'flex-end',
    height: 12,
  },
  bar: {
    width: 3,
    height: 10,
    borderRadius: 1,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
