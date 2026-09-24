import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useStore } from '../store/useStore';
import ScreenContainer from '../components/ScreenContainer';
import { useDialog } from '../components/DialogProvider';
import { colors, radius, spacing } from '../theme/theme';
import { MesosStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<MesosStackParamList, 'MesosList'>;

export default function MesosListScreen({ navigation }: Props) {
  const mesocycles = useStore((s) => s.mesocycles);
  const active = useStore((s) => s.active);
  const setActive = useStore((s) => s.setActive);
  const deleteMesocycle = useStore((s) => s.deleteMesocycle);
  const duplicateMesocycle = useStore((s) => s.duplicateMesocycle);
  const createNextMesocycle = useStore((s) => s.createNextMesocycle);
  const dialog = useDialog();

  const showActions = async (id: string, name: string) => {
    const action = await dialog.choose(name, [
      { value: 'next', label: 'Build Next Block' },
      { value: 'duplicate', label: 'Duplicate' },
      { value: 'delete', label: 'Delete', style: 'destructive' },
      { value: 'cancel', label: 'Cancel', style: 'cancel' },
    ]);
    if (action === 'next') {
      const next = createNextMesocycle(id);
      if (next) navigation.navigate('MesoEditor', { mesoId: next.id });
      return;
    }
    if (action === 'duplicate') {
      duplicateMesocycle(id);
      return;
    }
    if (action !== 'delete') return;
    const confirmed = await dialog.confirm('Delete Workout Plan', `Delete "${name}"?`, {
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (confirmed) deleteMesocycle(id);
  };

  return (
    <ScreenContainer style={{ paddingTop: spacing.md, paddingHorizontal: spacing.md }}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Workout Builder</Text>
        <Pressable style={styles.addButton} onPress={() => navigation.navigate('PlanBuilder')}>
          <Ionicons name="add" size={22} color={colors.textPrimary} />
        </Pressable>
      </View>
      <FlatList
        data={mesocycles}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        renderItem={({ item }) => {
          const isActive = active?.mesoId === item.id;
          return (
            <Pressable
              style={[styles.card, isActive && styles.cardActive]}
              onPress={() => navigation.navigate('MesoEditor', { mesoId: item.id })}
              onLongPress={() => showActions(item.id, item.name)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>
                  {item.weeks} week{item.weeks === 1 ? '' : 's'} · {item.days.length} day{item.days.length === 1 ? '' : 's'}
                </Text>
              </View>
              <Pressable
                style={[styles.activeButton, isActive && styles.activeButtonOn]}
                onPress={() => setActive(item.id, 1, 0)}
              >
                <Text style={[styles.activeButtonText, isActive && styles.activeButtonTextOn]}>
                  {isActive ? 'Active' : 'Set Active'}
                </Text>
              </Pressable>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>No workout plans yet. Tap + to build your training program.</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardActive: { borderWidth: 1, borderColor: colors.accent },
  name: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },
  meta: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
  activeButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeButtonOn: { backgroundColor: colors.accentMuted, borderColor: colors.accent },
  activeButtonText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  activeButtonTextOn: { color: colors.accent },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
});
