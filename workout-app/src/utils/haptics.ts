import { isNativePlatform } from './platform';

// Imported lazily so the native module stays off the startup path, and out of
// the web bundle's critical path where it can never do anything.
const haptics = () => import('expo-haptics');

/** A light tick, for confirming a tap landed without looking at the screen. */
export async function tapFeedback() {
  if (!isNativePlatform) return;
  try {
    const Haptics = await haptics();
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Haptics are a nicety; a device without them must not break logging.
  }
}

/** A stronger double-beat, for finishing something (a set, an exercise). */
export async function successFeedback() {
  if (!isNativePlatform) return;
  try {
    const Haptics = await haptics();
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // As above.
  }
}
