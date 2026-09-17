import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const REST_CHANNEL_ID = 'rest-timer';

// react-native-web has no notification module behind this, and the Expo Go
// sandbox can reject any of these calls. Nothing here is important enough to
// crash a workout over, so every entry point swallows its own failures.
const supported = Platform.OS === 'ios' || Platform.OS === 'android';

let handlerInstalled = false;
let permissionGranted: boolean | null = null;

function installHandler() {
  if (handlerInstalled) return;
  handlerInstalled = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: false,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Asks once per app launch and caches the answer. Returns false on web, on a
 * denial, or if anything throws.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!supported) return false;
  if (permissionGranted !== null) return permissionGranted;
  try {
    installHandler();
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
      const asked = await Notifications.requestPermissionsAsync();
      granted = asked.granted;
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
 * the caller can cancel it if the timer is paused, adjusted, or skipped, or
 * null if scheduling was not possible.
 */
export async function scheduleRestFinishedNotification(seconds: number): Promise<string | null> {
  if (!supported || seconds <= 0) return null;
  const granted = await ensureNotificationPermission();
  if (!granted) return null;
  try {
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
  if (!supported || !id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Already fired or already gone — nothing to do.
  }
}
