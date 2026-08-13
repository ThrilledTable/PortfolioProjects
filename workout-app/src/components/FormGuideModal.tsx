import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FormFigure from './FormFigure';
import MuscleTag from './MuscleTag';
import { colors, radius, spacing } from '../theme/theme';
import { Exercise } from '../types';
import { getFormGuide } from '../data/formGuides';

export default function FormGuideModal({
  visible,
  exercise,
  onClose,
}: {
  visible: boolean;
  exercise: Exercise | null;
  onClose: () => void;
}) {
  if (!exercise) return null;
  const guide = getFormGuide(exercise.name, exercise.muscleGroup);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.title}>{exercise.name}</Text>
              <MuscleTag muscle={exercise.muscleGroup} />
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </Pressable>
          </View>

          <View style={styles.figureWrap}>
            <FormFigure pose={guide.pose} size={140} />
          </View>

          <View style={styles.cuesList}>
            {guide.cues.map((cue, i) => (
              <View key={i} style={styles.cueRow}>
                <View style={styles.cueDot} />
                <Text style={styles.cueText}>{cue}</Text>
              </View>
            ))}
          </View>

          <Pressable style={styles.doneButton} onPress={onClose}>
            <Text style={styles.doneText}>Got it</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#000000aa',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm },
  title: { color: colors.textPrimary, fontSize: 19, fontWeight: '800' },
  figureWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginVertical: spacing.md,
  },
  cuesList: { gap: spacing.sm, marginBottom: spacing.md },
  cueRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  cueDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent, marginTop: 7 },
  cueText: { color: colors.textSecondary, fontSize: 14, flex: 1, lineHeight: 20 },
  doneButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  doneText: { color: '#fff', fontWeight: '700' },
});
