import { WeightUnit } from '../types';

const KG_PER_LB = 0.45359237;

export function lbsToKg(lbs: number): number {
  return lbs * KG_PER_LB;
}

export function kgToLbs(kg: number): number {
  return kg / KG_PER_LB;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Converts a canonical lbs value to a display string in the given unit. Empty/invalid input yields ''. */
export function formatWeightValue(lbsValue: string, unit: WeightUnit): string {
  if (lbsValue === '') return '';
  const lbs = Number(lbsValue);
  if (Number.isNaN(lbs)) return lbsValue;
  const display = unit === 'kg' ? lbsToKg(lbs) : lbs;
  return String(round(display));
}

/** Converts a value the user typed (in the given display unit) back to a canonical lbs string for storage. */
export function parseWeightInput(displayValue: string, unit: WeightUnit): string {
  if (displayValue === '') return '';
  const value = Number(displayValue);
  if (Number.isNaN(value)) return displayValue;
  const lbs = unit === 'kg' ? kgToLbs(value) : value;
  return String(round(lbs));
}

/** Converts a canonical lbs total (e.g. volume) to a rounded number in the given unit. */
export function convertWeightTotal(lbsValue: number, unit: WeightUnit): number {
  return Math.round(unit === 'kg' ? lbsToKg(lbsValue) : lbsValue);
}
