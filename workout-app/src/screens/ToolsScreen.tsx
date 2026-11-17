import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import { useStore } from '../store/useStore';
import { colors, radius, spacing } from '../theme/theme';
import { BAR_OPTIONS, computePlateLoad, PLATE_DENOMINATIONS } from '../utils/plates';
import { estimate1RM, weightForReps } from '../utils/suggestion';

/** Rep counts worth showing a predicted working weight for. */
const REP_TARGETS = [1, 3, 5, 8, 10, 12, 15];

const round = (n: number) => Math.round(n * 10) / 10;

function PlateCalculator() {
  const unit = useStore((s) => s.settings.unit);
  const barWeight = useStore((s) => s.settings.barWeight);
  const updateSettings = useStore((s) => s.updateSettings);

  const [targetText, setTargetText] = useState('');
  const bars = BAR_OPTIONS[unit];

  // The saved bar may be from the other unit (45 while on kg), so fall back to
  // that unit's standard bar rather than showing nothing selected.
  const activeBar = bars.some((b) => b.weight === barWeight) ? barWeight : bars[0].weight;

  const target = Number(targetText);
  const load = useMemo(
    () => (targetText.trim() ? computePlateLoad(target, activeBar, PLATE_DENOMINATIONS[unit]) : null),
    [targetText, target, activeBar, unit]
  );

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Plate Calculator</Text>
      <Text style={styles.cardHint}>What to hang on each side of the bar.</Text>

      <Text style={styles.label}>Bar</Text>
      <View style={styles.chipRow}>
        {bars.map((bar) => (
          <Pressable
            key={bar.label}
            style={[styles.chip, activeBar === bar.weight && styles.chipActive]}
            onPress={() => updateSettings({ barWeight: bar.weight })}
          >
            <Text style={[styles.chipText, activeBar === bar.weight && styles.chipTextActive]}>
              {bar.label}
            </Text>
            <Text style={styles.chipSub}>
              {bar.weight} {unit}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Target Weight ({unit})</Text>
      <TextInput
        style={styles.input}
        value={targetText}
        onChangeText={(v) => setTargetText(v.replace(/[^0-9.]/g, ''))}
        keyboardType="decimal-pad"
        placeholder={unit === 'kg' ? 'e.g. 100' : 'e.g. 225'}
        placeholderTextColor={colors.textMuted}
      />

      {load && load.problem === 'below-bar' && (
        <Text style={styles.warn}>
          That is lighter than the bar on its own ({activeBar} {unit}).
        </Text>
      )}

      {load && load.problem !== 'below-bar' && (
        <View style={styles.resultBox}>
          {load.perSide.length === 0 ? (
            <Text style={styles.resultBig}>Just the bar</Text>
          ) : (
            <View style={styles.plateRow}>
              {load.perSide.flatMap((p) =>
                Array.from({ length: p.count }, (_, i) => (
                  <View key={`${p.weight}-${i}`} style={styles.plateChip}>
                    <Text style={styles.plateChipText}>{p.weight}</Text>
                  </View>
                ))
              )}
            </View>
          )}
          <Text style={styles.resultMeta}>per side</Text>
          <Text style={styles.resultTotal}>
            Total on the bar: {load.achievable} {unit}
          </Text>
          {load.shortBy > 0 && (
            <Text style={styles.warn}>
              {round(load.shortBy)} {unit} short — no smaller plate to split the difference.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

function OneRepMaxCalculator() {
  const unit = useStore((s) => s.settings.unit);
  const [weightText, setWeightText] = useState('');
  const [repsText, setRepsText] = useState('');

  const weight = Number(weightText);
  const reps = Number(repsText);
  const oneRepMax = weightText.trim() && repsText.trim() ? estimate1RM(weight, reps) : 0;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>1RM Estimator</Text>
      <Text style={styles.cardHint}>
        A set you have actually done, turned into an estimated one-rep max and the weights that
        should land near other rep counts.
      </Text>

      <View style={styles.inputRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Weight ({unit})</Text>
          <TextInput
            style={styles.input}
            value={weightText}
            onChangeText={(v) => setWeightText(v.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.textMuted}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Reps</Text>
          <TextInput
            style={styles.input}
            value={repsText}
            onChangeText={(v) => setRepsText(v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={colors.textMuted}
          />
        </View>
      </View>

      {oneRepMax > 0 && (
        <View style={styles.resultBox}>
          <Text style={styles.resultBig}>
            {round(oneRepMax)} {unit}
          </Text>
          <Text style={styles.resultMeta}>estimated 1RM</Text>

          <View style={styles.table}>
            {REP_TARGETS.map((r) => (
              <View key={r} style={styles.tableRow}>
                <Text style={styles.tableReps}>{r} rep{r === 1 ? '' : 's'}</Text>
                <Text style={styles.tableWeight}>
                  {round(weightForReps(oneRepMax, r))} {unit}
                </Text>
              </View>
            ))}
          </View>

          <Text style={styles.cardHint}>
            Epley's formula. It is a decent guide up to about 10 reps and drifts optimistic past
            that — treat the high-rep rows as a starting point, not a prescription.
          </Text>
        </View>
      )}
    </View>
  );
}

export default function ToolsScreen() {
  return (
    <ScreenContainer style={{ padding: spacing.md }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: spacing.xl, gap: spacing.md }}>
        <PlateCalculator />
        <OneRepMaxCalculator />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md },
  cardTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '800' },
  cardHint: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 4 },
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBackground,
    alignItems: 'center',
    minWidth: 74,
  },
  chipActive: { backgroundColor: colors.accentMuted, borderColor: colors.accent },
  chipText: { color: colors.textSecondary, fontWeight: '700', fontSize: 13 },
  chipTextActive: { color: colors.textPrimary },
  chipSub: { color: colors.textMuted, fontSize: 10, marginTop: 1 },
  input: {
    backgroundColor: colors.inputBackground,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputRow: { flexDirection: 'row', gap: spacing.sm },
  resultBox: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  resultBig: { color: colors.textPrimary, fontSize: 30, fontWeight: '800' },
  resultMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  resultTotal: { color: colors.textSecondary, fontSize: 13, marginTop: spacing.sm, fontWeight: '600' },
  plateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  plateChip: {
    minWidth: 44,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
  },
  plateChipText: { color: colors.textPrimary, fontWeight: '800', fontSize: 15 },
  warn: { color: '#e0b23c', fontSize: 12, marginTop: spacing.sm, textAlign: 'center' },
  table: { alignSelf: 'stretch', marginTop: spacing.md, gap: 2 },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.inputBackground,
  },
  tableReps: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  tableWeight: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
});
