import { MesoDay, Mesocycle, TemplateExercise, WorkoutSession } from '../types';
import { genId } from './id';

const MIN_SETS = 1;
const MAX_SETS = 6;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/** "Upper / Lower" -> "Upper / Lower 2" -> "Upper / Lower 3". */
export function nextBlockName(name: string): string {
  const match = /^(.*?)(\d+)$/.exec(name.trim());
  if (!match) return `${name.trim()} 2`;
  return `${match[1]}${Number(match[2]) + 1}`;
}

/**
 * The last session of this day that is worth copying set counts from: the
 * most recent non-deload week. Deload weeks are deliberately lighter and
 * shorter, so carrying them forward would start the next block under-dosed.
 */
function lastWorkingSession(
  sessions: WorkoutSession[],
  meso: Mesocycle,
  dayId: string
): WorkoutSession | undefined {
  const forDay = sessions.filter((s) => s.mesoId === meso.id && s.dayId === dayId);
  const working = forDay.filter((s) => !meso.deloadWeeks.includes(s.week));
  const pool = working.length > 0 ? working : forDay;
  if (pool.length === 0) return undefined;
  return pool.reduce((latest, s) => (s.week > latest.week ? s : latest));
}

function carryExercise(
  te: TemplateExercise,
  previous: WorkoutSession | undefined,
  groupIds: Map<string, string>
): TemplateExercise {
  // Set counts already auto-regulate during a block, so the count the lifter
  // actually finished on is a better starting point than what was planned.
  const performed = previous?.exercises.find((se) => se.exerciseId === te.exerciseId);
  const targetCount = performed
    ? clamp(performed.sets.length, MIN_SETS, MAX_SETS)
    : te.sets.length;

  const template = te.sets[0];
  const sets = Array.from({ length: targetCount }, (_, i) => ({
    ...(te.sets[i] ?? template),
    id: genId(),
  }));

  let supersetGroup: string | undefined;
  if (te.supersetGroup) {
    if (!groupIds.has(te.supersetGroup)) groupIds.set(te.supersetGroup, genId());
    supersetGroup = groupIds.get(te.supersetGroup);
  }

  return {
    id: genId(),
    exerciseId: te.exerciseId,
    sets,
    ...(supersetGroup ? { supersetGroup } : {}),
  };
}

/**
 * Builds the block that follows `meso`: same days and exercises, set counts
 * taken from where the last block actually finished, and `continuesFrom` set
 * so progression can read across the boundary.
 *
 * Day ids are deliberately reused. Sessions are keyed by mesocycle *and* day,
 * so nothing collides -- but it gives the new block a stable handle on "the
 * same day, last time round".
 */
export function buildNextMesocycle(meso: Mesocycle, sessions: WorkoutSession[]): Mesocycle {
  // Superset ids are remapped per block, but a group spanning one day must
  // stay one group, so the map is shared across that day only.
  const days: MesoDay[] = meso.days.map((day) => {
    const previous = lastWorkingSession(sessions, meso, day.id);
    const groupIds = new Map<string, string>();
    return {
      id: day.id,
      name: day.name,
      muscleGroups: day.muscleGroups,
      exercises: day.exercises.map((te) => carryExercise(te, previous, groupIds)),
    };
  });

  return {
    id: genId(),
    name: nextBlockName(meso.name),
    weeks: meso.weeks,
    days,
    deloadWeeks: [...meso.deloadWeeks],
    continuesFrom: meso.id,
  };
}

/** True once every day of the final week has been marked complete. */
export function isMesocycleComplete(meso: Mesocycle, sessions: WorkoutSession[]): boolean {
  if (meso.days.length === 0) return false;
  return meso.days.every((day) =>
    sessions.some(
      (s) => s.mesoId === meso.id && s.dayId === day.id && s.week === meso.weeks && !!s.completedAt
    )
  );
}
