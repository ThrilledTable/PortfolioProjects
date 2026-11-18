import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import { useStore } from '../store/useStore';
import { colors, radius, spacing } from '../theme/theme';
import {
  BAR_OPTIONS,
  computePlateLoad,
  PLATE_DENOMINATIONS,
  PlateCount,
  plateColor,
  plateRelativeSize,
} from '../utils/plates';
import { estimate1RM, weightForReps } from '../utils/suggestion';
import { WeightUnit } from '../types';

/** Rep counts worth showing a predicted working weight for. */
const REP_TARGETS = [1, 3, 5, 8, 10, 12, 15];

const round = (n: number) => Math.round(n * 10) / 10;

/** Heights in px for the slim bar at the top of the result card. */
const BAR_PLATE_MAX_HEIGHT = 64;
const BAR_PLATE_MIN_HEIGHT = 16;

const plateHeight = (rel: number, max: number, min: number) =>
  Math.round(min + rel * (max - min));

/**
 * One sleeve's worth of plates. Heaviest sits against the shaft, so the
 * outermost plate is the lightest -- which is how they go on in real life.
 */
function Sleeve({
  perSide,
  unit,
  side,
}: {
  perSide: PlateCount[];
  unit: WeightUnit;
  side: 'left' | 'right';
}) {
  const plates = perSide.flatMap((p) =>
    Array.from({ length: p.count }, () => p.weight)
  );
  const ordered = side === 'left' ? [...plates].reverse() : plates;
  return (
    <>
      {ordered.map((weight, i) => {
        const rel = plateRelativeSize(unit, weight);
        return (
          <View
            key={`${side}-${weight}-${i}`}
            style={{
              width: Math.round(6 + rel * 4),
              height: plateHeight(rel, BAR_PLATE_MAX_HEIGHT, BAR_PLATE_MIN_HEIGHT),
              borderRadius: 2,
              backgroundColor: plateColor(unit, weight),
            }}
          />
        );
      })}
    </>
  );
}

function BarbellGraphic({ perSide, unit }: { perSide: PlateCount[]; unit: WeightUnit }) {
  return (
    <View style={styles.barbell}>
      <View style={styles.barEndCap} />
      <Sleeve perSide={perSide} unit={unit} side="left" />
      <View style={styles.barShaft} />
      <Sleeve perSide={perSide} unit={unit} side="right" />
      <View style={styles.barEndCap} />
    </View>
  );
}

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
          <BarbellGraphic perSide={load.perSide} unit={unit} />

          {load.perSide.length === 0 ? (
            <Text style={styles.resultBig}>Just the bar</Text>
          ) : (
            <>
              <Text style={styles.resultMeta}>per side</Text>
              <View style={styles.tally}>
                {load.perSide.map((p, i) => {
                  const rel = plateRelativeSize(unit, p.weight);
                  return (
                    <View
                      key={p.weight}
                      style={[styles.tallyRow, i === load.perSide.length - 1 && styles.tallyRowLast]}
                    >
                      <View style={styles.tallyGlyphCell}>
                        <View
                          style={{
                            width: Math.round(7 + rel * 4),
                            height: plateHeight(rel, 38, 14),
                            borderRadius: 3,
                            backgroundColor: plateColor(unit, p.weight),
                          }}
                        />
                      </View>
                      <Text style={styles.tallyWeight}>
                        {p.weight} <Text style={styles.tallyUnit}>{unit}</Text>
                      </Text>
                      <Text style={styles.tallyCount}>× {p.count}</Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total on the bar</Text>
            <Text style={styles.totalValue}>
              {load.achievable} <Text style={styles.tallyUnit}>{unit}</Text>
            </Text>
          </View>
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
  resultMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
  },
  barbell: {
    // The card centres its children, so without this the row collapses to the
    // width of the plates and the shaft has nothing to grow into -- a barbell
    // that reads as a dumbbell.
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: BAR_PLATE_MAX_HEIGHT + 12,
    gap: 2,
  },
  barEndCap: { width: 5, height: 12, borderRadius: 2, backgroundColor: '#4a4a52' },
  barShaft: { flex: 1, minWidth: 12, height: 6, backgroundColor: '#4a4a52' },
  tally: { alignSelf: 'stretch', marginTop: spacing.xs },
  tallyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tallyRowLast: { borderBottomWidth: 0 },
  tallyGlyphCell: { width: 26, alignItems: 'center' },
  tallyWeight: { flex: 1, color: colors.textPrimary, fontSize: 17, fontWeight: '700' },
  tallyUnit: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  tallyCount: { color: colors.textPrimary, fontSize: 19, fontWeight: '800' },
  totalRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    marginTop: spacing.sm,
  },
  totalLabel: { color: colors.textSecondary, fontSize: 13 },
  totalValue: { color: colors.textPrimary, fontSize: 20, fontWeight: '800' },
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
