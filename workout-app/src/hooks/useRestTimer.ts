import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { cancelScheduledNotification, scheduleRestFinishedNotification } from '../utils/notifications';

export interface RestTimer {
  secondsLeft: number;
  totalSeconds: number;
  running: boolean;
}

interface TimerState {
  totalSeconds: number;
  /** Epoch ms the rest ends at. Null while paused. */
  endsAt: number | null;
  /** Seconds left at the moment it was paused. Null while running. */
  pausedRemaining: number | null;
}

function remainingSeconds(state: TimerState, now: number) {
  if (state.pausedRemaining !== null) return state.pausedRemaining;
  if (state.endsAt === null) return 0;
  return Math.max(0, Math.ceil((state.endsAt - now) / 1000));
}

/**
 * A rest timer anchored to a wall-clock deadline rather than a decrementing
 * counter, so backgrounding the app (which throttles or suspends JS timers)
 * no longer makes the countdown drift. A local notification is scheduled for
 * the deadline so the timer still lands while the phone is in a pocket.
 */
export function useRestTimer(notificationsEnabled: boolean) {
  const [state, setState] = useState<TimerState | null>(null);
  const [, forceTick] = useState(0);

  // Mirrors `state` so the action callbacks can read the current timer without
  // doing their scheduling side effects inside a setState updater.
  const stateRef = useRef<TimerState | null>(null);
  stateRef.current = state;

  const notificationIdRef = useRef<string | null>(null);
  const generationRef = useRef(0);

  const clearNotification = useCallback(() => {
    generationRef.current++;
    const id = notificationIdRef.current;
    notificationIdRef.current = null;
    if (id) void cancelScheduledNotification(id);
  }, []);

  const scheduleNotification = useCallback(
    (seconds: number) => {
      clearNotification();
      if (!notificationsEnabled || seconds <= 0) return;
      // The id only arrives after the await, by which point the user may have
      // already skipped or restarted. Stamp a generation so a stale id cannot
      // overwrite a newer one and instead cancels itself.
      const generation = generationRef.current;
      void scheduleRestFinishedNotification(seconds).then((id) => {
        if (!id) return;
        if (generation !== generationRef.current) {
          void cancelScheduledNotification(id);
          return;
        }
        notificationIdRef.current = id;
      });
    },
    [notificationsEnabled, clearNotification]
  );

  // Drive re-renders while the timer runs. The displayed value is derived from
  // the deadline, so a missed or delayed tick costs nothing but a stale frame.
  useEffect(() => {
    if (!state || state.pausedRemaining !== null) return;
    const interval = setInterval(() => forceTick((n) => n + 1), 500);
    return () => clearInterval(interval);
  }, [state]);

  // Coming back to the foreground, re-render at once instead of waiting on a
  // timer the OS may have been suspending.
  useEffect(() => {
    const onChange = (status: AppStateStatus) => {
      if (status === 'active') forceTick((n) => n + 1);
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, []);

  const left = state ? remainingSeconds(state, Date.now()) : 0;

  // Retire the timer once it has run out. Done in an effect so render stays
  // pure; the notification has already fired by this point.
  useEffect(() => {
    if (state && state.pausedRemaining === null && left <= 0) {
      notificationIdRef.current = null;
      generationRef.current++;
      setState(null);
    }
  }, [state, left]);

  const start = useCallback(
    (seconds: number) => {
      if (seconds <= 0) return;
      setState({ totalSeconds: seconds, endsAt: Date.now() + seconds * 1000, pausedRemaining: null });
      scheduleNotification(seconds);
    },
    [scheduleNotification]
  );

  const toggleRunning = useCallback(() => {
    const prev = stateRef.current;
    if (!prev) return;
    if (prev.pausedRemaining !== null) {
      const seconds = prev.pausedRemaining;
      setState({ ...prev, endsAt: Date.now() + seconds * 1000, pausedRemaining: null });
      scheduleNotification(seconds);
      return;
    }
    clearNotification();
    setState({ ...prev, endsAt: null, pausedRemaining: remainingSeconds(prev, Date.now()) });
  }, [scheduleNotification, clearNotification]);

  const addTime = useCallback(
    (delta: number) => {
      const prev = stateRef.current;
      if (!prev) return;
      const next = Math.max(0, remainingSeconds(prev, Date.now()) + delta);
      const totalSeconds = Math.max(prev.totalSeconds, next);
      if (prev.pausedRemaining !== null) {
        setState({ totalSeconds, endsAt: null, pausedRemaining: next });
        return;
      }
      setState({ totalSeconds, endsAt: Date.now() + next * 1000, pausedRemaining: null });
      scheduleNotification(next);
    },
    [scheduleNotification]
  );

  const skip = useCallback(() => {
    clearNotification();
    setState(null);
  }, [clearNotification]);

  // Never leave a notification queued for a workout the user has walked away from.
  useEffect(() => clearNotification, [clearNotification]);

  const timer: RestTimer | null = state
    ? { secondsLeft: left, totalSeconds: state.totalSeconds, running: state.pausedRemaining === null }
    : null;

  return { timer, start, toggleRunning, addTime, skip };
}
