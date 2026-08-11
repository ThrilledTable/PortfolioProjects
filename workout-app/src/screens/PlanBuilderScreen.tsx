import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useStore } from '../store/useStore';
import ScreenContainer from '../components/ScreenContainer';
import { colors, muscleColors, radius, spacing } from '../theme/theme';
import { MesosStackParamList } from '../navigation/types';
import { MUSCLE_GROUPS, MuscleGroup } from '../types';
import { buildSuggestedDays, suggestSplit } from '../utils/planBuilder';

type Props = NativeStackScreenProps<MesosStackParamList, 'PlanBuilder'>;

const DAY_OPTIONS = [1, 2, 3, 4, 5, 6];

export default function PlanBuilderScreen({ navigation }: Props) {
  const exercises = useStore((s) => s.exercises);
  const addMesocycle = useStore((s) => s.addMesocycle);
  const defaultRestSeconds = useStore((s) => s.settings.defaultRestSeconds);

  const [name, setName] = useState('');
  const [weeks, setWeeks] = useState('6');
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [focusMuscles, setFocusMuscles] = useState<MuscleGroup[]>([]);

  const split = useMemo(() => suggestSplit(daysPerWeek), [daysPerWeek]);

  const toggleFocus = (m: MuscleGroup) => {
    setFocusMuscles((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  };

  const generate = () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter a name for your workout plan.');
      return;
    }
    const weeksNum = Math.max(1, Number(weeks) || 1);
    const days = buildSuggestedDays(daysPerWeek, focusMuscles, exercises, defaultRestSeconds);
    const meso = addMesocycle(name.trim(), weeksNum, days, [weeksNum]);
    navigation.replace('MesoEditor', { mesoId: meso.id });
  };

  const buildManually = () => navigation.replace('MesoEditor', {});

  return (
    <ScreenContainer style={{ padding: spacing.md }}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>
          Answer a few questions and we'll put together a full workout plan for you — you can fine-tune
          anything afterward.
        </Text>

        <Text style={styles.label}>Plan Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Summer Strength Block"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Weeks</Text>
        <TextInput
          style={styles.input}
          value={weeks}
          onChangeText={(v) => setWeeks(v.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
        />

        <Text style={styles.label}>Days per Week</Text>
        <View style={styles.chipRow}>
          {DAY_OPTIONS.map((d) => (
            <Pressable
              key={d}
              style={[styles.dayChip, daysPerWeek === d && styles.dayChipSelected]}
              onPress={() => setDaysPerWeek(d)}
            >
              <Text style={[styles.dayChipText, daysPerWeek === d && styles.dayChipTextSelected]}>{d}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>What do you want to focus on?</Text>
        <Text style={styles.hint}>Optional — selected muscle groups get extra exercises in your plan.</Text>
        <View style={styles.chipRow}>
          {MUSCLE_GROUPS.map((m) => {
            const selected = focusMuscles.includes(m);
            const color = muscleColors[m] ?? colors.accent;
            return (
              <Pressable
                key={m}
                style={[
                  styles.focusChip,
                  { borderColor: selected ? color : colors.border },
                  selected && { backgroundColor: color + '33' },
                ]}
                onPress={() => toggleFocus(m)}
              >
                <Text style={[styles.focusChipText, selected && { color }]}>{m}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Your Suggested Split</Text>
        <View style={styles.splitPreview}>
          {split.map((dayType, i) => (
            <View key={i} style={styles.splitRow}>
              <Text style={styles.splitDayNum}>Day {i + 1}</Text>
              <Text style={styles.splitDayType}>{dayType}</Text>
            </View>
          ))}
        </View>

        <Pressable style={styles.generateButton} onPress={generate}>
          <Text style={styles.generateText}>Generate My Plan</Text>
        </Pressable>

        <Pressable style={styles.manualButton} onPress={buildManually}>
          <Text style={styles.manualText}>Or build one manually</Text>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  intro: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: spacing.sm },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  hint: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  dayChip: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipSelected: { backgroundColor: colors.accentMuted, borderColor: colors.accent },
  dayChipText: { color: colors.textSecondary, fontWeight: '700' },
  dayChipTextSelected: { color: colors.textPrimary },
  focusChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
  },
  focusChipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  splitPreview: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  splitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  splitDayNum: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  splitDayType: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
  generateButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  generateText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  manualButton: { marginTop: spacing.md, alignItems: 'center', paddingVertical: 10, marginBottom: spacing.xl },
  manualText: { color: colors.textSecondary, fontWeight: '600' },
});
