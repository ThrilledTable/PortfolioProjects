import React from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FormFigure from './FormFigure';
import MuscleTag from './MuscleTag';
import { colors, radius, spacing } from '../theme/theme';
import { Exercise } from '../types';
import { getFormGuide } from '../data/formGuides';
import { getExerciseImages } from '../data/exerciseImages';

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
  const photos = getExerciseImages(exercise.name);

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

          {photos.length > 0 ? (
            // Two frames, usually start and end of the movement, side by side so
            // the shape of the lift reads at a glance.
            <View style={styles.photoRow}>
              {photos.map((photo, i) => (
                // The frame owns the aspect ratio: react-native-web lets an
                // Image's intrinsic height win over aspectRatio, which stretched
                // these into tall crops.
                <View key={i} style={styles.photoFrame}>
                  <Image source={photo} style={styles.photo} resizeMode="cover" />
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.figureWrap}>
              <FormFigure pose={guide.pose} size={140} />
            </View>
          )}

          <ScrollView style={styles.cuesScroll} contentContainerStyle={styles.cuesList}>
            {guide.cues.map((cue, i) => (
              <View key={i} style={styles.cueRow}>
                <View style={styles.cueDot} />
                <Text style={styles.cueText}>{cue}</Text>
              </View>
            ))}
          </ScrollView>

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
  // Row children stretch to the tallest sibling by default, which overrode
  // aspectRatio and produced tall crops instead of the whole frame.
  photoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, marginVertical: spacing.md },
  photoFrame: {
    flex: 1,
    aspectRatio: 3 / 2,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  photo: { width: '100%', height: '100%' },
  cuesScroll: { maxHeight: 190 },
  cuesList: { gap: spacing.sm, paddingBottom: spacing.md },
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
