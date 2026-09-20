import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenContainer from '../components/ScreenContainer';
import { useDialog } from '../components/DialogProvider';
import { useSyncStore } from '../store/useSyncStore';
import { colors, radius, spacing } from '../theme/theme';

function formatWhen(iso: string | null): string {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'never';
  const minutes = Math.floor((Date.now() - then) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString();
}

function SignedOut() {
  const signIn = useSyncStore((s) => s.signIn);
  const signUp = useSyncStore((s) => s.signUp);
  const status = useSyncStore((s) => s.status);
  const error = useSyncStore((s) => s.error);

  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const busy = status === 'working';
  const submit = async () => {
    try {
      if (mode === 'signIn') await signIn(email.trim(), password);
      else await signUp(email.trim(), password);
      setPassword('');
    } catch {
      // The store has already put the message in `error`; nothing to add.
    }
  };

  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.tabRow}>
        {(['signIn', 'signUp'] as const).map((m) => (
          <Pressable
            key={m}
            style={[styles.tab, mode === m && styles.tabActive]}
            onPress={() => setMode(m)}
          >
            <Text style={[styles.tabText, mode === m && styles.tabTextActive]}>
              {m === 'signIn' ? 'Sign In' : 'Create Account'}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.blurb}>
        {mode === 'signIn'
          ? 'Sign in to back up your workouts and keep them in step across your devices.'
          : 'Create an account to back up your workouts. Your data stays yours — nothing is shared with anyone else.'}
      </Text>

      <View>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          placeholder="you@example.com"
          placeholderTextColor={colors.textMuted}
          editable={!busy}
        />
      </View>

      <View>
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textContentType={mode === 'signUp' ? 'newPassword' : 'password'}
          placeholder={mode === 'signUp' ? 'At least 10 characters' : 'Your password'}
          placeholderTextColor={colors.textMuted}
          editable={!busy}
          onSubmitEditing={submit}
        />
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <Pressable
        style={[styles.primaryButton, busy && styles.buttonDisabled]}
        onPress={submit}
        disabled={busy || !email.trim() || !password}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryButtonText}>
            {mode === 'signIn' ? 'Sign In' : 'Create Account'}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

function ConflictCard() {
  const conflict = useSyncStore((s) => s.conflict);
  const resolveConflict = useSyncStore((s) => s.resolveConflict);
  const status = useSyncStore((s) => s.status);
  if (!conflict) return null;

  const serverSessions = conflict.data.sessions?.length ?? 0;
  return (
    <View style={styles.conflictCard}>
      <Text style={styles.conflictTitle}>This account changed somewhere else</Text>
      <Text style={styles.conflictBody}>
        The cloud copy was saved {formatWhen(conflict.updatedAt)}
        {conflict.deviceLabel ? ` from ${conflict.deviceLabel}` : ''} and has {serverSessions} logged
        workout{serverSessions === 1 ? '' : 's'}. This device also has changes that were never
        uploaded. Keeping one replaces the other.
      </Text>
      <View style={styles.conflictButtons}>
        <Pressable
          style={[styles.secondaryButton, status === 'working' && styles.buttonDisabled]}
          onPress={() => resolveConflict('server')}
          disabled={status === 'working'}
        >
          <Text style={styles.secondaryButtonText}>Use cloud copy</Text>
        </Pressable>
        <Pressable
          style={[styles.primaryButton, { flex: 1 }, status === 'working' && styles.buttonDisabled]}
          onPress={() => resolveConflict('local')}
          disabled={status === 'working'}
        >
          <Text style={styles.primaryButtonText}>Keep this device</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SignedIn() {
  const account = useSyncStore((s) => s.account);
  const status = useSyncStore((s) => s.status);
  const error = useSyncStore((s) => s.error);
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt);
  const revision = useSyncStore((s) => s.lastSyncedRevision);
  const sync = useSyncStore((s) => s.sync);
  const signOut = useSyncStore((s) => s.signOut);
  const conflict = useSyncStore((s) => s.conflict);
  const dialog = useDialog();

  const busy = status === 'working';

  const confirmSignOut = async () => {
    const ok = await dialog.confirm(
      'Sign Out',
      'Your workouts stay on this device. You can sign back in any time to pick the backup up again.',
      { confirmLabel: 'Sign Out' }
    );
    if (ok) await signOut();
  };

  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.accountCard}>
        <Ionicons name="cloud-done-outline" size={22} color={colors.success} />
        <View style={{ flex: 1 }}>
          <Text style={styles.accountEmail}>{account?.email}</Text>
          <Text style={styles.accountMeta}>
            {revision === 0 ? 'Not backed up yet' : `Last synced ${formatWhen(lastSyncedAt)}`}
          </Text>
        </View>
      </View>

      <ConflictCard />

      {error && !conflict && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!conflict && (
        <Pressable
          style={[styles.primaryButton, busy && styles.buttonDisabled]}
          onPress={sync}
          disabled={busy}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Sync Now</Text>}
        </Pressable>
      )}

      <Text style={styles.hint}>
        Syncing uploads this device's workouts and pulls anything newer from your other devices. It
        does not happen on its own — tap Sync Now when you want it.
      </Text>

      <Pressable style={styles.dangerRow} onPress={confirmSignOut} disabled={busy}>
        <Ionicons name="log-out-outline" size={20} color={colors.danger} />
        <Text style={styles.dangerText}>Sign Out</Text>
      </Pressable>
    </View>
  );
}

export default function AccountScreen() {
  const token = useSyncStore((s) => s.token);
  return (
    <ScreenContainer style={{ padding: spacing.md }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: spacing.xl }}>
        {token ? <SignedIn /> : <SignedOut />}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  tabRow: { flexDirection: 'row', gap: spacing.sm },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.accentMuted, borderColor: colors.accent },
  tabText: { color: colors.textSecondary, fontWeight: '700' },
  tabTextActive: { color: colors.textPrimary },
  blurb: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  secondaryButton: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  secondaryButtonText: { color: colors.textPrimary, fontWeight: '700', fontSize: 15 },
  buttonDisabled: { opacity: 0.6 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: spacing.sm,
  },
  errorText: { color: colors.danger, flex: 1, fontSize: 13 },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  accountEmail: { color: colors.textPrimary, fontWeight: '700', fontSize: 15 },
  accountMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  conflictCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#e0b23c',
    padding: spacing.md,
    gap: spacing.sm,
  },
  conflictTitle: { color: '#e0b23c', fontWeight: '800', fontSize: 15 },
  conflictBody: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  conflictButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
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
