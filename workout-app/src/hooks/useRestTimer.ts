import { useCallback, useEffect, useState } from 'react';
import { cancelScheduledNotification, scheduleRestFinishedNotification } from '../utils/notifications';
import { useNowTick } from './useNowTick';

export interface RestTimer {
  secondsLeft: number;
  totalSeconds: number;
  running: boolean;
}

interface TimerState {
  totalSeconds: number;
  /** Epoch ms the rest ends at. While paused, the clock it will end at once resumed. */
  endsAt: number;
  /** Epoch ms the timer was paused at, or null while it runs. */
  pausedAt: number | null;
}

const remainingSeconds = (s: TimerState, now: number) =>
  Math.max(0, Math.ceil((s.endsAt - (s.pausedAt ?? now)) / 1000));

/** Re-aims the deadline so `seconds` remain, from now or from where it was paused. */
const withRemaining = (s: TimerState, seconds: number): TimerState => ({
  totalSeconds: Math.max(s.totalSeconds, seconds),
  endsAt: (s.pausedAt ?? Date.now()) + seconds * 1000,
  pausedAt: s.pausedAt,
});

/**
 * A rest timer anchored to a wall-clock deadline rather than a decrementing
 * counter, so backgrounding the app (which throttles or suspends JS timers)
 * no longer makes the countdown drift. A local notification is scheduled for
 * the deadline so the rest still lands while the phone is in a pocket.
 */
export function useRestTimer(notificationsEnabled: boolean) {
  const [state, setState] = useState<TimerState | null>(null);
  const running = state !== null && state.pausedAt === null;

  useNowTick(running);

  // The notification is a reaction to the timer rather than something each
  // action fires: every path that changes or ends the rest replaces this
  // effect, and the cleanup is the cancel. That covers pause, skip, +/-15,
  // unmount, and a schedule that resolves after the rest is already gone.
  useEffect(() => {
    if (!notificationsEnabled || !state || state.pausedAt !== null) return;
    let cancelled = false;
    let scheduledId: string | null = null;
    void scheduleRestFinishedNotification(remainingSeconds(state, Date.now())).then((id) => {
      if (!id) return;
      if (cancelled) void cancelScheduledNotification(id);
      else scheduledId = id;
    });
    return () => {
      cancelled = true;
      if (scheduledId) void cancelScheduledNotification(scheduledId);
    };
  }, [state, notificationsEnabled]);

  const left = state ? remainingSeconds(state, Date.now()) : 0;

  // Retire the timer once it has run out. Done in an effect so render stays
  // pure; the notification has already fired by this point.
  useEffect(() => {
    if (running && left <= 0) setState(null);
  }, [running, left]);

  const start = useCallback((seconds: number) => {
    if (seconds <= 0) return;
    setState({ totalSeconds: seconds, endsAt: Date.now() + seconds * 1000, pausedAt: null });
  }, []);

  const toggleRunning = useCallback(() => {
    setState((prev) => {
      if (!prev) return prev;
      if (prev.pausedAt === null) return { ...prev, pausedAt: Date.now() };
      return { ...prev, endsAt: prev.endsAt + (Date.now() - prev.pausedAt), pausedAt: null };
    });
  }, []);

  const addTime = useCallback((delta: number) => {
    setState((prev) =>
      prev ? withRemaining(prev, Math.max(0, remainingSeconds(prev, Date.now()) + delta)) : prev
    );
  }, []);

  const skip = useCallback(() => setState(null), []);

  const timer: RestTimer | null = state
    ? { secondsLeft: left, totalSeconds: state.totalSeconds, running }
    : null;

  return { timer, start, toggleRunning, addTime, skip };
}
