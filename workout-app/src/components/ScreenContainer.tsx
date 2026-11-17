import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/theme';

export default function ScreenContainer({
  children,
  style,
  /**
   * Clear the status bar / notch. Only for screens with no navigator header of
   * their own -- a stack header already sits below the inset, so adding it here
   * as well would pad the screen twice.
   */
  insetTop = false,
  /** Gap between the inset and the content, when `insetTop` is on. */
  extraTop = 0,
}: {
  children?: React.ReactNode;
  style?: ViewStyle;
  insetTop?: boolean;
  extraTop?: number;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.container,
        style,
        // Last, so it beats any paddingTop the caller's style set -- including
        // the `padding` shorthand.
        insetTop ? { paddingTop: insets.top + extraTop } : null,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
