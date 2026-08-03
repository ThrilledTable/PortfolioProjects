import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '../store/useStore';
import ScreenContainer from '../components/ScreenContainer';
import { colors, radius, spacing } from '../theme/theme';

export default function MoreHomeScreen() {
  const clearActive = useStore((s) => s.clearActive);

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
