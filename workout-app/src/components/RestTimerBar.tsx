import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme/theme';

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function RestTimerBar({
  secondsLeft,
  totalSeconds,
  running,
  onToggleRunning,
  onAddTime,
  onSkip,
}: {
  secondsLeft: number;
  totalSeconds: number;
  running: boolean;
  onToggleRunning: () => void;
  onAddTime: (delta: number) => void;
  onSkip: () => void;
}) {
  const progress = totalSeconds > 0 ? Math.max(0, Math.min(1, secondsLeft / totalSeconds)) : 0;

  return (
    <View style={styles.container}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Rest</Text>
        <Text style={styles.time}>{formatTime(secondsLeft)}</Text>
        <View style={styles.controls}>
          <Pressable style={styles.iconButton} onPress={() => onAddTime(-15)} hitSlop={8}>
            <Text style={styles.iconButtonText}>-15</Text>
          </Pressable>
          <Pressable style={styles.playButton} onPress={onToggleRunning} hitSlop={8}>
            <Ionicons name={running ? 'pause' : 'play'} size={18} color="#fff" />
          </Pressable>
          <Pressable style={styles.iconButton} onPress={() => onAddTime(15)} hitSlop={8}>
            <Text style={styles.iconButtonText}>+15</Text>
          </Pressable>
          <Pressable style={styles.skipButton} onPress={onSkip} hitSlop={8}>
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceAlt,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 6,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  progressTrack: {
    height: 3,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressFill: {
    height: 3,
    backgroundColor: colors.accent,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { color: colors.textSecondary, fontWeight: '700', fontSize: 13, flex: 1 },
  time: { color: colors.textPrimary, fontWeight: '800', fontSize: 20, marginRight: spacing.md },
  controls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconButtonText: { color: colors.textSecondary, fontWeight: '700', fontSize: 12 },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButton: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
