import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme/theme';

export type DialogChoiceStyle = 'default' | 'destructive' | 'cancel';

export interface DialogChoice<T extends string = string> {
  value: T;
  label: string;
  style?: DialogChoiceStyle;
}

interface DialogRequest {
  title: string;
  message?: string;
  choices: DialogChoice[];
  resolve: (value: string | null) => void;
}

interface DialogApi {
  /** Simple acknowledgement. Resolves once dismissed. */
  alert: (title: string, message?: string) => Promise<void>;
  /** Yes/no confirmation. Resolves true only if the confirm action was chosen. */
  confirm: (
    title: string,
    message?: string,
    options?: { confirmLabel?: string; cancelLabel?: string; destructive?: boolean }
  ) => Promise<boolean>;
  /** Multi-choice sheet. Resolves the chosen value, or null if dismissed. */
  choose: <T extends string>(
    title: string,
    choices: DialogChoice<T>[],
    message?: string
  ) => Promise<T | null>;
}

const DialogContext = createContext<DialogApi | null>(null);

export function useDialog(): DialogApi {
  const api = useContext(DialogContext);
  if (!api) throw new Error('useDialog must be used inside a DialogProvider');
  return api;
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<DialogRequest | null>(null);
  // Guards against a resolve firing twice (e.g. backdrop dismiss racing a button press).
  const settled = useRef(true);

  const present = useCallback((title: string, choices: DialogChoice[], message?: string) => {
    return new Promise<string | null>((resolve) => {
      settled.current = false;
      setRequest({ title, message, choices, resolve });
    });
  }, []);

  const settle = useCallback(
    (value: string | null) => {
      if (settled.current) return;
      settled.current = true;
      setRequest((current) => {
        current?.resolve(value);
        return null;
      });
    },
    []
  );

  const api = useMemo<DialogApi>(
    () => ({
      alert: async (title, message) => {
        await present(title, [{ value: 'ok', label: 'OK' }], message);
      },
      confirm: async (title, message, options) => {
        const result = await present(
          title,
          [
            {
              value: 'confirm',
              label: options?.confirmLabel ?? 'OK',
              style: options?.destructive ? 'destructive' : 'default',
            },
            { value: 'cancel', label: options?.cancelLabel ?? 'Cancel', style: 'cancel' },
          ],
          message
        );
        return result === 'confirm';
      },
      choose: async (title, choices, message) => {
        const result = await present(title, choices as DialogChoice[], message);
        return result as never;
      },
    }),
    [present]
  );

  return (
    <DialogContext.Provider value={api}>
      {children}
      <Modal
        visible={request !== null}
        transparent
        animationType="fade"
        onRequestClose={() => settle(null)}
      >
        {/* Backdrop dismiss resolves null, which every caller treats as "no action taken". */}
        <Pressable style={styles.backdrop} onPress={() => settle(null)}>
          <Pressable style={styles.card} onPress={() => {}}>
            <Text style={styles.title}>{request?.title}</Text>
            {!!request?.message && <Text style={styles.message}>{request.message}</Text>}
            <View style={styles.choices}>
              {request?.choices.map((choice) => (
                <Pressable
                  key={choice.value}
                  style={[
                    styles.choice,
                    choice.style === 'destructive' && styles.choiceDestructive,
                    choice.style === 'cancel' && styles.choiceCancel,
                  ]}
                  onPress={() => settle(choice.value)}
                >
                  <Text
                    style={[
                      styles.choiceText,
                      choice.style === 'destructive' && styles.choiceTextDestructive,
                      choice.style === 'cancel' && styles.choiceTextCancel,
                    ]}
                  >
                    {choice.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </DialogContext.Provider>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#000000aa',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  title: { color: colors.textPrimary, fontSize: 17, fontWeight: '800' },
  message: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: spacing.sm },
  choices: { marginTop: spacing.lg, gap: spacing.sm },
  choice: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  choiceDestructive: { backgroundColor: colors.danger },
  choiceCancel: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  choiceText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  choiceTextDestructive: { color: '#fff' },
  choiceTextCancel: { color: colors.textSecondary },
});
