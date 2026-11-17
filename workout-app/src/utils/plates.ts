import { WeightUnit } from '../types';

/**
 * Plates are physical objects, so the denominations follow the unit the gym
 * actually stocks rather than being converted from a canonical value.
 */
export const PLATE_DENOMINATIONS: Record<WeightUnit, number[]> = {
  lbs: [45, 35, 25, 10, 5, 2.5],
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
};

/** Common bar weights, in the unit's own terms. */
export const BAR_OPTIONS: Record<WeightUnit, { label: string; weight: number }[]> = {
  lbs: [
    { label: 'Barbell', weight: 45 },
    { label: 'Womens', weight: 35 },
    { label: 'EZ / Short', weight: 25 },
    { label: 'Technique', weight: 15 },
    { label: 'None', weight: 0 },
  ],
  kg: [
    { label: 'Barbell', weight: 20 },
    { label: 'Womens', weight: 15 },
    { label: 'EZ / Short', weight: 10 },
    { label: 'Technique', weight: 7 },
    { label: 'None', weight: 0 },
  ],
};

export interface PlateCount {
  weight: number;
  count: number;
}

export interface PlateLoad {
  /** Plates for ONE side of the bar, heaviest first. */
  perSide: PlateCount[];
  /** What the bar actually weighs once loaded with those plates. */
  achievable: number;
  /** How far short of the target that lands, in the same unit. */
  shortBy: number;
  /** Set when no loading is possible at all, with the reason. */
  problem: 'below-bar' | 'not-reachable' | null;
}

const EPSILON = 0.001;

/**
 * Greedy largest-first, which is optimal for every standard plate set because
 * each denomination divides evenly into the ones above it. Plates are assumed
 * unlimited -- a gym running out of 45s is not something the app can know.
 */
export function computePlateLoad(
  target: number,
  bar: number,
  denominations: number[]
): PlateLoad {
  if (!Number.isFinite(target) || target <= 0) {
    return { perSide: [], achievable: bar, shortBy: 0, problem: 'not-reachable' };
  }
  if (target < bar - EPSILON) {
    return { perSide: [], achievable: bar, shortBy: 0, problem: 'below-bar' };
  }

  let remaining = (target - bar) / 2;
  const perSide: PlateCount[] = [];
  for (const plate of [...denominations].sort((a, b) => b - a)) {
    const count = Math.floor((remaining + EPSILON) / plate);
    if (count > 0) {
      perSide.push({ weight: plate, count });
      remaining -= count * plate;
    }
  }

  const loaded = perSide.reduce((sum, p) => sum + p.weight * p.count, 0);
  const achievable = bar + loaded * 2;
  const shortBy = Math.round((target - achievable) * 100) / 100;
  return {
    perSide,
    achievable: Math.round(achievable * 100) / 100,
    shortBy,
    // An exact bar with no plates is a valid answer; nothing loadable AND
    // short of the target is not.
    problem: perSide.length === 0 && shortBy > EPSILON ? 'not-reachable' : null,
  };
}

/** "45 + 25 + 10" for a one-line summary of one side. */
export function describePerSide(perSide: PlateCount[]): string {
  if (perSide.length === 0) return 'Empty bar';
  return perSide
    .flatMap((p) => Array.from({ length: p.count }, () => String(p.weight)))
    .join(' + ');
}
