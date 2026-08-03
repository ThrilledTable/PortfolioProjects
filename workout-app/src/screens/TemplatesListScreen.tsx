import React from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useStore } from '../store/useStore';
import ScreenContainer from '../components/ScreenContainer';
import { colors, radius, spacing } from '../theme/theme';
import { TemplatesStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<TemplatesStackParamList, 'TemplatesList'>;

export default function TemplatesListScreen({ navigation }: Props) {
  const templates = useStore((s) => s.templates);
  const deleteTemplate = useStore((s) => s.deleteTemplate);

  const confirmDelete = (id: string, name: string) => {
    Alert.alert('Delete Template', `Delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteTemplate(id) },
    ]);
  };

  return (
    <ScreenContainer style={{ paddingTop: 60, paddingHorizontal: spacing.md }}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Templates</Text>
        <Pressable style={styles.addButton} onPress={() => navigation.navigate('TemplateEditor', {})}>
          <Ionicons name="add" size={22} color={colors.textPrimary} />
        </Pressable>
      </View>
      <FlatList
        data={templates}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => navigation.navigate('TemplateEditor', { templateId: item.id })}
            onLongPress={() => confirmDelete(item.id, item.name)}
          >
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>{item.exercises.length} exercise{item.exercises.length === 1 ? '' : 's'}</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No templates yet. Tap + to create one.</Text>
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  title: { color: colors.textPrimary, fontSize: 28, fontWeight: '800' },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  name: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },
  meta: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
});
