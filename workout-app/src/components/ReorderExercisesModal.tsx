import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../store/useStore';
import { TemplateExercise } from '../types';
import { colors, radius, spacing } from '../theme/theme';
import MuscleTag from './MuscleTag';

const ROW_HEIGHT = 64;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function DraggableRow({
  id,
  name,
  equipment,
  muscleGroup,
  isActive,
  dragY,
  onGrant,
  onMove,
  onRelease,
}: {
  id: string;
  name: string;
  equipment: string;
  muscleGroup: Parameters<typeof MuscleTag>[0]['muscle'];
  isActive: boolean;
  dragY: Animated.Value;
  onGrant: (id: string) => void;
  onMove: (id: string, dy: number) => void;
  onRelease: () => void;
}) {
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => onGrant(id),
      onPanResponderMove: (_, gesture) => onMove(id, gesture.dy),
      onPanResponderRelease: () => onRelease(),
      onPanResponderTerminate: () => onRelease(),
    })
  ).current;

  return (
    <Animated.View
      style={[
        styles.row,
        isActive && styles.rowActive,
        { transform: [{ translateY: isActive ? dragY : 0 }], zIndex: isActive ? 10 : 1 },
      ]}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.rowName} numberOfLines={1}>
          {name}
        </Text>
        <MuscleTag muscle={muscleGroup} />
      </View>
      <View {...panResponder.panHandlers} style={styles.handle} hitSlop={10}>
        <Ionicons name="reorder-three" size={24} color={colors.textMuted} />
      </View>
    </Animated.View>
  );
}

export default function ReorderExercisesModal({
  visible,
  exercises,
  onClose,
  onSave,
}: {
  visible: boolean;
  exercises: TemplateExercise[];
  onClose: () => void;
  onSave: (next: TemplateExercise[]) => void;
}) {
  const exercisesById = useStore((s) => s.exercises);
  const [items, setItems] = useState<TemplateExercise[]>(exercises);
  const [activeId, setActiveId] = useState<string | null>(null);
  const dragY = useRef(new Animated.Value(0)).current;
  const dragState = useRef<{ id: string; originIndex: number } | null>(null);

  useEffect(() => {
    if (visible) setItems(exercises);
  }, [visible, exercises]);

  const handleGrant = useCallback(
    (id: string) => {
      dragY.setValue(0);
      setActiveId(id);
      setItems((prev) => {
        dragState.current = { id, originIndex: prev.findIndex((it) => it.id === id) };
        return prev;
      });
    },
    [dragY]
  );

  const handleMove = useCallback(
    (id: string, dy: number) => {
      setItems((prev) => {
        const ds = dragState.current;
        if (!ds || ds.id !== id) return prev;
        const currentIndex = prev.findIndex((it) => it.id === id);
        const newIndex = clamp(Math.round(ds.originIndex + dy / ROW_HEIGHT), 0, prev.length - 1);
        let nextItems = prev;
        let effectiveIndex = currentIndex;
        if (newIndex !== currentIndex) {
          const next = [...prev];
          const [moved] = next.splice(currentIndex, 1);
          next.splice(newIndex, 0, moved);
          nextItems = next;
          effectiveIndex = newIndex;
        }
        dragY.setValue(dy - (effectiveIndex - ds.originIndex) * ROW_HEIGHT);
        return nextItems;
      });
    },
    [dragY]
  );

  const handleRelease = useCallback(() => {
    dragState.current = null;
    setActiveId(null);
    Animated.timing(dragY, { toValue: 0, duration: 120, useNativeDriver: false }).start();
  }, [dragY]);

  const save = () => {
    onSave(items);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Reorder Exercises</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={26} color={colors.textPrimary} />
          </Pressable>
        </View>
        <Text style={styles.hint}>Drag the handle to reorder.</Text>

        <ScrollView scrollEnabled={activeId === null} contentContainerStyle={{ paddingBottom: spacing.lg }}>
          {items.map((te) => {
            const ex = exercisesById.find((e) => e.id === te.exerciseId);
            if (!ex) return null;
            return (
              <DraggableRow
                key={te.id}
                id={te.id}
                name={ex.name}
                equipment={ex.equipment}
                muscleGroup={ex.muscleGroup}
                isActive={activeId === te.id}
                dragY={dragY}
                onGrant={handleGrant}
                onMove={handleMove}
                onRelease={handleRelease}
              />
            );
          })}
        </ScrollView>

        <Pressable style={styles.saveButton} onPress={save}>
          <Text style={styles.saveText}>Done</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 60, paddingHorizontal: spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  title: { color: colors.textPrimary, fontSize: 22, fontWeight: '800' },
  hint: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.md },
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowActive: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  rowName: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  handle: { paddingLeft: spacing.md, paddingVertical: spacing.sm },
  saveButton: {
    marginVertical: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
