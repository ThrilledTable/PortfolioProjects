import React, { useMemo } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '../store/useStore';
import ScreenContainer from '../components/ScreenContainer';
import { colors, radius, spacing } from '../theme/theme';
import { MoreStackParamList } from '../navigation/types';
import { Exercise } from '../types';
import { computeStreak, computeThisWeekVolume, computeTotalWorkouts } from '../utils/stats';
import { convertWeightTotal } from '../utils/units';

type Props = NativeStackScreenProps<MoreStackParamList, 'MoreHome'>;

export default function MoreHomeScreen({ navigation }: Props) {
  const clearActive = useStore((s) => s.clearActive);
  const sessions = useStore((s) => s.sessions);
  const exercises = useStore((s) => s.exercises);
  const unit = useStore((s) => s.settings.unit);

  const exerciseById = useMemo(() => {
    const map = new Map<string, Exercise>();
    exercises.forEach((e) => map.set(e.id, e));
    return map;
  }, [exercises]);

  const streak = useMemo(() => computeStreak(sessions), [sessions]);
  const totalWorkouts = useMemo(() => computeTotalWorkouts(sessions), [sessions]);
  const weekVolume = useMemo(
    () => computeThisWeekVolume(sessions, exerciseById),
    [sessions, exerciseById]
  );

  const resetAllData = () => {
    Alert.alert(
      'Reset All Data',
      'This will permanently delete all exercises, templates, mesocycles, and logged workouts.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('workout-app-storage');
            clearActive();
          },
        },
      ]
    );
  };

  return (
    <ScreenContainer style={{ paddingTop: spacing.md, paddingHorizontal: spacing.md }}>
      <Text style={styles.title}>More</Text>

      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{streak}</Text>
          <Text style={styles.statLabel}>Week Streak</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{totalWorkouts}</Text>
          <Text style={styles.statLabel}>Workouts</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{convertWeightTotal(weekVolume, unit).toLocaleString()}</Text>
          <Text style={styles.statLabel}>This Week ({unit})</Text>
        </View>
      </View>

      <Pressable style={styles.navRow} onPress={() => navigation.navigate('History')}>
        <Ionicons name="time-outline" size={20} color={colors.textPrimary} />
        <Text style={styles.navRowText}>Workout History</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>

      <Pressable style={styles.navRow} onPress={() => navigation.navigate('Settings')}>
        <Ionicons name="settings-outline" size={20} color={colors.textPrimary} />
        <Text style={styles.navRowText}>Settings</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.sectionBody}>
          A simple mesocycle-based workout tracker. All data is stored locally on this device.
        </Text>
      </View>
      <Pressable style={styles.dangerRow} onPress={resetAllData}>
        <Ionicons name="trash-outline" size={20} color={colors.danger} />
        <Text style={styles.dangerText}>Reset All Data</Text>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.textPrimary, fontSize: 28, fontWeight: '800', marginBottom: spacing.md },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { color: colors.textPrimary, fontSize: 22, fontWeight: '800' },
  statLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  statDivider: { width: 1, backgroundColor: colors.border, marginVertical: 4 },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  navRowText: { flex: 1, color: colors.textPrimary, fontWeight: '600', fontSize: 15 },
  section: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  sectionTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 15, marginBottom: 6 },
  sectionBody: { color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  dangerText: { color: colors.danger, fontWeight: '700' },
});
