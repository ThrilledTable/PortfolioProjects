import { Platform } from 'react-native';
import { isNativePlatform } from './platform';

const REST_CHANNEL_ID = 'rest-timer';

// Imported lazily: expo-notifications does real work at import time (it
// registers a push-token listener and warns about Expo Go), and this app only
// ever schedules local notifications. Deferring it moves that cost off app
// launch and onto the first set the user logs.
const notifications = () => import('expo-notifications');

// react-native-web has no notification module behind this, and the Expo Go
// sandbox can reject any of these calls. Nothing here is important enough to
// crash a workout over, so every entry point swallows its own failures.
let permissionGranted: boolean | null = null;

/** Asks once per app launch and caches the answer. False on web or on denial. */
async function ensureNotificationPermission(): Promise<boolean> {
  if (!isNativePlatform) return false;
  if (permissionGranted !== null) return permissionGranted;
  try {
    const Notifications = await notifications();
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: false,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(REST_CHANNEL_ID, {
        name: 'Rest timer',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
      });
    }
    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted && existing.canAskAgain) {
      granted = (await Notifications.requestPermissionsAsync()).granted;
    }
    permissionGranted = granted;
    return granted;
  } catch {
    permissionGranted = false;
    return false;
  }
}

/**
 * Fires a local notification `seconds` from now. Returns the scheduled id so
 * the caller can cancel it if the rest is paused, adjusted, or skipped, or
 * null if scheduling was not possible.
 */
export async function scheduleRestFinishedNotification(seconds: number): Promise<string | null> {
  if (!isNativePlatform || seconds <= 0) return null;
  if (!(await ensureNotificationPermission())) return null;
  try {
    const Notifications = await notifications();
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Rest is up',
        body: 'Time for your next set.',
        sound: 'default',
        ...(Platform.OS === 'android' ? { channelId: REST_CHANNEL_ID } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.round(seconds)),
      },
    });
  } catch {
    return null;
  }
}

export async function cancelScheduledNotification(id: string | null | undefined) {
  if (!isNativePlatform || !id) return;
  try {
    const Notifications = await notifications();
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Already fired or already gone -- nothing to do.
  }
}
