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

/**
 * The colours most gyms paint their plates, so the drawing on screen maps onto
 * the rack you are standing at. Size still carries the weight on its own, so
 * this degrades fine in a gym of plain black iron.
 */
export const PLATE_COLORS: Record<WeightUnit, Record<number, string>> = {
  lbs: {
    45: '#2f6fdb',
    35: '#e0b63c',
    25: '#3f9e5a',
    10: '#c9c9ce',
    5: '#d8483f',
    2.5: '#9a6bd4',
  },
  kg: {
    25: '#d8483f',
    20: '#2f6fdb',
    15: '#e0b63c',
    10: '#3f9e5a',
    5: '#c9c9ce',
    2.5: '#9a6bd4',
    1.25: '#8a8a93',
  },
};

/**
 * Plate diameter relative to the heaviest in the set, near enough to the real
 * thing to be recognisable. Not derived from the weight: a 2.5 is nowhere near
 * a eighteenth of a 45 across.
 */
export const PLATE_RELATIVE_SIZE: Record<WeightUnit, Record<number, number>> = {
  lbs: { 45: 1, 35: 0.9, 25: 0.76, 10: 0.52, 5: 0.45, 2.5: 0.34 },
  kg: { 25: 1, 20: 0.93, 15: 0.84, 10: 0.72, 5: 0.52, 2.5: 0.4, 1.25: 0.3 },
};

export const plateColor = (unit: WeightUnit, weight: number): string =>
  PLATE_COLORS[unit][weight] ?? '#7c6cf6';

export const plateRelativeSize = (unit: WeightUnit, weight: number): number =>
  PLATE_RELATIVE_SIZE[unit][weight] ?? 0.6;

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
