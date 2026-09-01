import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../store/useStore';
import ScreenContainer from '../components/ScreenContainer';
import { colors, radius, spacing } from '../theme/theme';
import { WeightUnit } from '../types';
import { exportBackup, importBackup } from '../utils/backup';

export default function SettingsScreen() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const getBackupData = useStore((s) => s.getBackupData);
  const restoreFromBackup = useStore((s) => s.restoreFromBackup);

  const [restText, setRestText] = useState(String(settings.defaultRestSeconds));
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const commitRestSeconds = () => {
    const seconds = Math.max(0, Number(restText) || 0);
    updateSettings({ defaultRestSeconds: seconds });
    setRestText(String(seconds));
  };

  const selectUnit = (unit: WeightUnit) => updateSettings({ unit });

  const handleExport = async () => {
    setExporting(true);
    const result = await exportBackup(getBackupData());
    setExporting(false);
    if (!result.success) {
      Alert.alert('Export Failed', result.message ?? 'Something went wrong.');
    }
  };

  const handleImport = async () => {
    setImporting(true);
    const result = await importBackup();
    setImporting(false);
    if (!result.success || !result.data) {
      if (result.message && result.message !== 'Cancelled.') {
        Alert.alert('Import Failed', result.message);
      }
      return;
    }
    const data = result.data;
    Alert.alert(
      'Replace All Data?',
      'This will overwrite every exercise, template, mesocycle, and logged workout currently on this device with the contents of the backup file.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Replace',
          style: 'destructive',
          onPress: () => {
            restoreFromBackup(data);
            setRestText(String(data.settings.defaultRestSeconds));
          },
        },
      ]
    );
  };

  return (
    <ScreenContainer style={{ padding: spacing.md }}>
      <Text style={styles.label}>Weight Unit</Text>
      <View style={styles.unitRow}>
        {(['lbs', 'kg'] as WeightUnit[]).map((u) => (
          <Pressable
            key={u}
            style={[styles.unitChip, settings.unit === u && styles.unitChipSelected]}
            onPress={() => selectUnit(u)}
          >
            <Text style={[styles.unitChipText, settings.unit === u && styles.unitChipTextSelected]}>
              {u.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Default Rest Time (seconds)</Text>
      <TextInput
        style={styles.input}
        value={restText}
        onChangeText={(v) => setRestText(v.replace(/[^0-9]/g, ''))}
        onBlur={commitRestSeconds}
        keyboardType="number-pad"
      />
      <Text style={styles.hint}>Used as the starting rest time when you add a new set to a template or day.</Text>

      <Text style={styles.label}>Backup</Text>
      <Pressable style={styles.actionRow} onPress={handleExport} disabled={exporting}>
        <Ionicons name="download-outline" size={20} color={colors.textPrimary} />
        <Text style={styles.actionRowText}>{exporting ? 'Exporting…' : 'Export Data'}</Text>
      </Pressable>
      <Pressable style={styles.actionRow} onPress={handleImport} disabled={importing}>
        <Ionicons name="cloud-upload-outline" size={20} color={colors.textPrimary} />
        <Text style={styles.actionRowText}>{importing ? 'Importing…' : 'Import Data'}</Text>
      </Pressable>
      <Text style={styles.hint}>
        Export saves a JSON backup of everything on this device. Import replaces all current data with the
        contents of a previously exported file.
      </Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  unitRow: { flexDirection: 'row', gap: spacing.sm },
  unitChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unitChipSelected: { backgroundColor: colors.accentMuted, borderColor: colors.accent },
  unitChipText: { color: colors.textSecondary, fontWeight: '700' },
  unitChipTextSelected: { color: colors.textPrimary },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: spacing.xs },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  actionRowText: { color: colors.textPrimary, fontWeight: '600', fontSize: 15 },
});
