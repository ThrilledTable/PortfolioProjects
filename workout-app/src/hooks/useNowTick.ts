import { useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

/**
 * Re-renders roughly once a second while `active`, for values derived from the
 * wall clock. Each timeout is re-aimed at the next whole second, so several
 * callers land in the same event-loop turn and React batches them into one
 * render instead of one each.
 *
 * Returns nothing: callers read `Date.now()` themselves. The tick only exists
 * to schedule the render.
 */
export function useNowTick(active: boolean) {
  const [, tick] = useState(0);

  useEffect(() => {
    if (!active) return;
    let timeout: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const untilNextSecond = 1000 - (Date.now() % 1000);
      timeout = setTimeout(() => {
        tick((n) => n + 1);
        schedule();
      }, untilNextSecond);
    };
    schedule();
    return () => clearTimeout(timeout);
  }, [active]);

  // A backgrounded app has its timers throttled or suspended, so re-render on
  // the way back in rather than waiting for a tick that may be overdue.
  useEffect(() => {
    if (!active) return;
    const onChange = (status: AppStateStatus) => {
      if (status === 'active') tick((n) => n + 1);
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [active]);
}
