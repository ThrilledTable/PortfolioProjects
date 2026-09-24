import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing } from '../theme/theme';

export type DialogChoiceStyle = 'default' | 'destructive' | 'cancel';

export interface DialogChoice<T extends string = string> {
  value: T;
  label: string;
  style?: DialogChoiceStyle;
}

interface PromptConfig {
  initialValue: string;
  placeholder?: string;
  multiline?: boolean;
  submitLabel: string;
  /** Offered only when there is an existing value to remove. */
  clearLabel?: string;
}

interface DialogRequest {
  title: string;
  message?: string;
  choices: DialogChoice[];
  prompt?: PromptConfig;
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
  /**
   * Free-text entry. Resolves the typed value, an empty string if cleared, or
   * null if dismissed -- so a caller can tell "removed it" from "changed my
   * mind", which matters when the value being edited already exists.
   */
  prompt: (
    title: string,
    options?: {
      message?: string;
      initialValue?: string;
      placeholder?: string;
      multiline?: boolean;
      submitLabel?: string;
      clearLabel?: string;
    }
  ) => Promise<string | null>;
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
  // The prompt's promise is created before any typing happens, so it cannot
  // close over the final text -- it reads this ref when the dialog settles.
  const draftRef = useRef('');

  const [draft, setDraft] = useState('');
  draftRef.current = draft;

  const present = useCallback(
    (title: string, choices: DialogChoice[], message?: string, prompt?: PromptConfig) => {
      return new Promise<string | null>((resolve) => {
        settled.current = false;
        if (prompt) setDraft(prompt.initialValue);
        setRequest({ title, message, choices, prompt, resolve });
      });
    },
    []
  );

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
      prompt: async (title, options) => {
        const initialValue = options?.initialValue ?? '';
        const choices: DialogChoice[] = [
          { value: 'submit', label: options?.submitLabel ?? 'Save' },
          ...(initialValue && options?.clearLabel
            ? [{ value: 'clear', label: options.clearLabel, style: 'destructive' as const }]
            : []),
          { value: 'cancel', label: 'Cancel', style: 'cancel' as const },
        ];
        const result = await present(title, choices, options?.message, {
          initialValue,
          placeholder: options?.placeholder,
          multiline: options?.multiline,
          submitLabel: options?.submitLabel ?? 'Save',
          clearLabel: options?.clearLabel,
        });
        if (result === null || result === 'cancel') return null;
        if (result === 'clear') return '';
        return draftRef.current;
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
            {!!request?.prompt && (
              <TextInput
                style={[styles.input, request.prompt.multiline && styles.inputMultiline]}
                value={draft}
                onChangeText={setDraft}
                placeholder={request.prompt.placeholder}
                placeholderTextColor={colors.textMuted}
                multiline={request.prompt.multiline}
                autoFocus
                onSubmitEditing={request.prompt.multiline ? undefined : () => settle('submit')}
              />
            )}
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
  input: {
    backgroundColor: colors.inputBackground,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  inputMultiline: { minHeight: 90, textAlignVertical: 'top' },
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
