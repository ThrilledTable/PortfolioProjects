import React from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../store/useStore';
import { Template } from '../types';
import { colors, radius, spacing } from '../theme/theme';

export default function TemplatePickerModal({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (template: Template) => void;
}) {
  const templates = useStore((s) => s.templates);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Load Template</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={26} color={colors.textPrimary} />
          </Pressable>
        </View>
        <FlatList
          data={templates}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: spacing.lg }}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => {
                onSelect(item);
                onClose();
              }}
            >
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>{item.exercises.length} exercise{item.exercises.length === 1 ? '' : 's'}</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>No templates yet. Create one from the Templates tab.</Text>
          }
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 60, paddingHorizontal: spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  title: { color: colors.textPrimary, fontSize: 22, fontWeight: '800' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  name: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
  meta: { color: colors.textSecondary, fontSize: 13 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
});
