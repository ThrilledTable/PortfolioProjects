import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError, authApi, NetworkError, SyncPullResponse, syncApi } from '../api/client';
import { BackupData, isValidBackupData, useStore } from './useStore';

export type SyncStatus = 'idle' | 'working' | 'error';

export interface Account {
  id: string;
  email: string;
}

/** What the server holds when it disagrees with this device. */
export interface SyncConflict {
  revision: number;
  data: BackupData;
  updatedAt: string | null;
  deviceLabel: string | null;
}

interface SyncState {
  account: Account | null;
  token: string | null;
  /** The server revision this device last agreed with. 0 means nothing synced. */
  lastSyncedRevision: number;
  /** Fingerprint of the data at that point, so local edits since are detectable. */
  lastSyncedHash: string | null;
  lastSyncedAt: string | null;
  status: SyncStatus;
  error: string | null;
  conflict: SyncConflict | null;

  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  sync: () => Promise<void>;
  resolveConflict: (keep: 'local' | 'server') => Promise<void>;
  dismissError: () => void;
}

/** FNV-1a. Not a security hash -- just "did this change since last sync". */
function fingerprint(value: unknown): string {
  const json = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) {
    hash ^= json.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${hash.toString(16)}:${json.length}`;
}

const deviceLabel = () =>
  ({ ios: 'iPhone', android: 'Android', web: 'Browser' } as Record<string, string>)[Platform.OS] ??
  Platform.OS;

/** Turns any thrown value into something worth showing a person. */
function describe(error: unknown): string {
  if (error instanceof NetworkError) return error.message;
  if (error instanceof ApiError) return error.message;
  return 'Something went wrong. Try again.';
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set, get) => {
      /** Replaces local data wholesale with a server copy. */
      const adoptServer = (pull: SyncPullResponse) => {
        if (!pull.data || !isValidBackupData(pull.data)) {
          throw new ApiError(500, 'bad_backup', 'The cloud copy could not be read.');
        }
        useStore.getState().restoreFromBackup(pull.data);
        set({
          lastSyncedRevision: pull.revision,
          lastSyncedHash: fingerprint(pull.data),
          lastSyncedAt: new Date().toISOString(),
        });
      };

      const pushLocal = async (token: string, baseRevision: number) => {
        const data = useStore.getState().getBackupData();
        const { revision } = await syncApi.push(token, baseRevision, data, deviceLabel());
        set({
          lastSyncedRevision: revision,
          lastSyncedHash: fingerprint(data),
          lastSyncedAt: new Date().toISOString(),
        });
      };

      const afterAuth = (token: string, account: Account) => {
        // A new sign-in knows nothing about what the server holds, so the next
        // sync must reconcile rather than assume this device is current.
        set({
          token,
          account,
          status: 'idle',
          error: null,
          conflict: null,
          lastSyncedRevision: 0,
          lastSyncedHash: null,
          lastSyncedAt: null,
        });
      };

      return {
        account: null,
        token: null,
        lastSyncedRevision: 0,
        lastSyncedHash: null,
        lastSyncedAt: null,
        status: 'idle',
        error: null,
        conflict: null,

        signUp: async (email, password) => {
          set({ status: 'working', error: null });
          try {
            const res = await authApi.register(email, password);
            afterAuth(res.token, res.user);
            await get().sync();
          } catch (error) {
            set({ status: 'error', error: describe(error) });
            throw error;
          }
        },

        signIn: async (email, password) => {
          set({ status: 'working', error: null });
          try {
            const res = await authApi.login(email, password);
            afterAuth(res.token, res.user);
            await get().sync();
          } catch (error) {
            set({ status: 'error', error: describe(error) });
            throw error;
          }
        },

        signOut: async () => {
          const { token } = get();
          // Local data is deliberately left alone: signing out of the backup
          // should not wipe the workouts on the device.
          set({
            account: null,
            token: null,
            lastSyncedRevision: 0,
            lastSyncedHash: null,
            lastSyncedAt: null,
            status: 'idle',
            error: null,
            conflict: null,
          });
          if (token) await authApi.logout(token).catch(() => {});
        },

        sync: async () => {
          const { token, lastSyncedRevision, lastSyncedHash } = get();
          if (!token) return;
          set({ status: 'working', error: null });
          try {
            const pull = await syncApi.pull(token);
            const localData = useStore.getState().getBackupData();
            const localChanged = fingerprint(localData) !== lastSyncedHash;

            if (pull.revision === lastSyncedRevision) {
              if (localChanged) await pushLocal(token, lastSyncedRevision);
              else set({ lastSyncedAt: new Date().toISOString() });
              set({ status: 'idle' });
              return;
            }

            // The server moved on. If this device has nothing of its own to
            // lose, take the server's copy; otherwise the user has to choose.
            if (!localChanged) {
              adoptServer(pull);
              set({ status: 'idle' });
              return;
            }

            if (!pull.data || !isValidBackupData(pull.data)) {
              throw new ApiError(500, 'bad_backup', 'The cloud copy could not be read.');
            }
            set({
              status: 'idle',
              conflict: {
                revision: pull.revision,
                data: pull.data,
                updatedAt: pull.updatedAt,
                deviceLabel: pull.deviceLabel,
              },
            });
          } catch (error) {
            if (error instanceof ApiError && error.status === 401) {
              set({
                account: null,
                token: null,
                status: 'error',
                error: 'Your session expired. Sign in again.',
              });
              return;
            }
            set({ status: 'error', error: describe(error) });
          }
        },

        resolveConflict: async (keep) => {
          const { token, conflict } = get();
          if (!token || !conflict) return;
          set({ status: 'working', error: null });
          try {
            if (keep === 'server') {
              adoptServer({
                revision: conflict.revision,
                data: conflict.data as unknown as Record<string, unknown>,
                updatedAt: conflict.updatedAt,
                deviceLabel: conflict.deviceLabel,
              });
            } else {
              // Push on top of the revision we just saw, which is what makes
              // this an overwrite rather than another conflict.
              await pushLocal(token, conflict.revision);
            }
            set({ status: 'idle', conflict: null });
          } catch (error) {
            set({ status: 'error', error: describe(error) });
          }
        },

        dismissError: () => set({ error: null, status: 'idle' }),
      };
    },
    {
      name: 'workout-app-sync',
      storage: createJSONStorage(() => AsyncStorage),
      // Transient UI state must not come back from storage looking live.
      partialize: (s) => ({
        account: s.account,
        token: s.token,
        lastSyncedRevision: s.lastSyncedRevision,
        lastSyncedHash: s.lastSyncedHash,
        lastSyncedAt: s.lastSyncedAt,
      }),
    }
  )
);
