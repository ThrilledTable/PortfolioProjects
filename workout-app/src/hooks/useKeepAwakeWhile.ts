import { useEffect } from 'react';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

const TAG = 'workout-in-progress';

/**
 * Holds the screen on while `active` is true. expo-keep-awake's own
 * `useKeepAwake` is tied to a component's whole lifetime, and a workout screen
 * stays mounted long after the workout is finished.
 */
export function useKeepAwakeWhile(active: boolean) {
  useEffect(() => {
    if (!active) return;
    // Unsupported on web, and a failure here should never break logging.
    // Releasing a tag that was never held is the same harmless no-op.
    activateKeepAwakeAsync(TAG).catch(() => {});
    return () => {
      try {
        deactivateKeepAwake(TAG);
      } catch {
        // Already released, or unsupported on this platform.
      }
    };
  }, [active]);
}
