import { Platform } from 'react-native';

/**
 * True where Expo's native modules exist. On web they are absent, so anything
 * built on them has to degrade to a no-op rather than throw.
 */
export const isNativePlatform = Platform.OS === 'ios' || Platform.OS === 'android';
