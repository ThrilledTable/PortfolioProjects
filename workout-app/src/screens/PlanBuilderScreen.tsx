import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useStore } from '../store/useStore';
import ScreenContainer from '../components/ScreenContainer';
import { useDialog } from '../components/DialogProvider';
import { colors, muscleColors, radius, spacing } from '../theme/theme';
import { MesosStackParamList } from '../navigation/types';
import { MUSCLE_GROUPS, MuscleGroup } from '../types';
import { buildProgramDays, buildSuggestedDays, suggestSplit } from '../utils/planBuilder';
import { STARTER_PROGRAMS, StarterProgram } from '../data/starterPrograms';

type Props = NativeStackScreenProps<MesosStackParamList, 'PlanBuilder'>;

const DAY_OPTIONS = [1, 2, 3, 4, 5, 6];

export default function PlanBuilderScreen({ navigation }: Props) {
  const exercises = useStore((s) => s.exercises);
  const addMesocycle = useStore((s) => s.addMesocycle);
  const defaultRestSeconds = useStore((s) => s.settings.defaultRestSeconds);
  const dialog = useDialog();

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
      dialog.alert('Name required', 'Please enter a name for your workout plan.');
      return;
    }
    const weeksNum = Math.max(1, Number(weeks) || 1);
    const days = buildSuggestedDays(daysPerWeek, focusMuscles, exercises, defaultRestSeconds);
    // addMesocycle makes this the active plan when nothing else holds the slot.
    const meso = addMesocycle(name.trim(), weeksNum, days, [weeksNum]);
    navigation.replace('MesoEditor', { mesoId: meso.id });
  };

  const startFromProgram = (program: StarterProgram) => {
    const days = buildProgramDays(program, exercises);
    // The program names itself unless the user has typed something of their own.
    const meso = addMesocycle(
      name.trim() || program.name,
      program.weeks,
      days,
      [program.deloadWeek]
    );
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

        <Text style={styles.label}>Start From a Program</Text>
        <Text style={styles.sublabel}>
          Ready-made blocks you can use as-is or edit. Picking one builds it straight away.
        </Text>
        {STARTER_PROGRAMS.map((program) => (
          <Pressable key={program.id} style={styles.programCard} onPress={() => startFromProgram(program)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.programName}>{program.name}</Text>
              <Text style={styles.programMeta}>
                {program.daysPerWeek} days/week · {program.weeks} weeks · deload week {program.deloadWeek}
              </Text>
              <Text style={styles.programSummary}>{program.summary}</Text>
              <Text style={styles.programBestFor}>{program.bestFor}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ))}

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or build around your focus</Text>
          <View style={styles.dividerLine} />
        </View>

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
  sublabel: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginBottom: spacing.sm },
  programCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  programName: { color: colors.textPrimary, fontSize: 16, fontWeight: '800' },
  programMeta: { color: colors.accent, fontSize: 12, fontWeight: '700', marginTop: 2 },
  programSummary: { color: colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 6 },
  programBestFor: { color: colors.textMuted, fontSize: 12, marginTop: 4, fontStyle: 'italic' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
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
