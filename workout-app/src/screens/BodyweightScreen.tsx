import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenContainer from '../components/ScreenContainer';
import ProgressChart, { ChartPoint } from '../components/ProgressChart';
import { useDialog } from '../components/DialogProvider';
import { useStore } from '../store/useStore';
import { colors, radius, spacing } from '../theme/theme';
import { formatWeightValue, parseWeightInput } from '../utils/units';

const round = (n: number) => Math.round(n * 10) / 10;

export default function BodyweightScreen() {
  const entries = useStore((s) => s.bodyweight);
  const addEntry = useStore((s) => s.addBodyweightEntry);
  const deleteEntry = useStore((s) => s.deleteBodyweightEntry);
  const unit = useStore((s) => s.settings.unit);
  const dialog = useDialog();

  const [weightText, setWeightText] = useState('');
  const [noteText, setNoteText] = useState('');

  // Entries are stored newest first; the chart reads left to right in time.
  const points: ChartPoint[] = useMemo(
    () =>
      [...entries]
        .reverse()
        .map((e) => ({ date: e.date, value: Number(formatWeightValue(String(e.weight), unit)) })),
    [entries, unit]
  );

  const latest = entries[0];
  const previous = entries[1];
  const change =
    latest && previous
      ? Number(formatWeightValue(String(latest.weight), unit)) -
        Number(formatWeightValue(String(previous.weight), unit))
      : null;

  const save = () => {
    const lbs = Number(parseWeightInput(weightText.trim(), unit));
    if (!Number.isFinite(lbs) || lbs <= 0) return;
    addEntry(lbs, noteText);
    setWeightText('');
    setNoteText('');
  };

  const confirmDelete = async (id: string) => {
    const ok = await dialog.confirm('Delete Entry', 'Remove this weigh-in?', {
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok) deleteEntry(id);
  };

  return (
    <ScreenContainer style={{ padding: spacing.md }}>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        ListHeaderComponent={
          <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
            <View style={styles.card}>
              <Text style={styles.label}>Today's Weight ({unit})</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={weightText}
                  onChangeText={(v) => setWeightText(v.replace(/[^0-9.]/g, ''))}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  onSubmitEditing={save}
                />
                <Pressable
                  style={[styles.saveButton, !weightText.trim() && styles.saveButtonDisabled]}
                  onPress={save}
                  disabled={!weightText.trim()}
                >
                  <Text style={styles.saveButtonText}>Log</Text>
                </Pressable>
              </View>
              <TextInput
                style={[styles.input, { marginTop: spacing.sm }]}
                value={noteText}
                onChangeText={setNoteText}
                placeholder="Note (optional) — e.g. morning, after coffee"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={styles.hint}>
                Weigh in at the same time of day; the trend is the signal, any single reading is
                mostly water.
              </Text>
            </View>

            {latest && (
              <View style={styles.summaryCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.summaryValue}>
                    {formatWeightValue(String(latest.weight), unit)} {unit}
                  </Text>
                  <Text style={styles.summaryMeta}>
                    latest · {new Date(latest.date).toLocaleDateString()}
                  </Text>
                </View>
                {change !== null && (
                  <View style={styles.deltaBox}>
                    <Ionicons
                      name={change > 0 ? 'arrow-up' : change < 0 ? 'arrow-down' : 'remove'}
                      size={14}
                      color={change === 0 ? colors.textMuted : colors.textSecondary}
                    />
                    <Text style={styles.deltaText}>
                      {change === 0 ? 'no change' : `${round(Math.abs(change))} ${unit}`}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {points.length >= 2 && (
              <View style={styles.card}>
                <ProgressChart title="Body Weight" unit={unit} points={points} />
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.entryRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.entryWeight}>
                {formatWeightValue(String(item.weight), unit)} {unit}
              </Text>
              <Text style={styles.entryDate}>
                {new Date(item.date).toLocaleDateString()}
                {item.note ? ` · ${item.note}` : ''}
              </Text>
            </View>
            <Pressable onPress={() => confirmDelete(item.id)} hitSlop={12} style={styles.deleteButton}>
              <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No weigh-ins yet. Log one above to start the trend.</Text>
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md },
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  inputRow: { flexDirection: 'row', gap: spacing.sm },
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
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: spacing.sm },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  summaryValue: { color: colors.textPrimary, fontSize: 26, fontWeight: '800' },
  summaryMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  deltaBox: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deltaText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  entryWeight: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  entryDate: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  deleteButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
});
