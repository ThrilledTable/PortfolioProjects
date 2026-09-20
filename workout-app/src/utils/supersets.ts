import { TemplateExercise } from '../types';

export interface ExerciseGroup {
  /** The shared superset id, or null for a plain single exercise. */
  supersetGroup: string | null;
  exercises: TemplateExercise[];
}

/**
 * Walks a day's exercises in order and collects consecutive runs sharing a
 * superset id. Only adjacent members count: if reordering has separated two
 * exercises that share an id, they become two groups rather than silently
 * pairing things the user can no longer see next to each other.
 */
export function groupedExercises(exercises: TemplateExercise[]): ExerciseGroup[] {
  const groups: ExerciseGroup[] = [];
  for (const exercise of exercises) {
    const last = groups[groups.length - 1];
    if (
      exercise.supersetGroup &&
      last &&
      last.supersetGroup === exercise.supersetGroup
    ) {
      last.exercises.push(exercise);
      continue;
    }
    groups.push({ supersetGroup: exercise.supersetGroup ?? null, exercises: [exercise] });
  }
  // A group id that ended up with one member is not a superset any more.
  return groups.map((g) => (g.exercises.length === 1 ? { ...g, supersetGroup: null } : g));
}

/** Where `exerciseId` sits within its superset, for labelling and rest logic. */
export interface SupersetPosition {
  /** 0-based index within the group. */
  index: number;
  size: number;
  isLast: boolean;
  /** 'A', 'B', 'C'... as lifters usually write them. */
  letter: string;
}

export function supersetPositions(
  exercises: TemplateExercise[]
): Map<string, SupersetPosition> {
  const positions = new Map<string, SupersetPosition>();
  for (const group of groupedExercises(exercises)) {
    if (!group.supersetGroup) continue;
    group.exercises.forEach((exercise, index) => {
      positions.set(exercise.id, {
        index,
        size: group.exercises.length,
        isLast: index === group.exercises.length - 1,
        letter: String.fromCharCode(65 + index),
      });
    });
  }
  return positions;
}

/**
 * How long to rest after logging a set, given where the exercise sits in a
 * superset. Mid-superset the answer is "none" -- the point is to move straight
 * to the next movement -- and the full prescribed rest is taken only after the
 * round is finished.
 */
export function restAfterSet(
  configuredRest: number,
  position: SupersetPosition | undefined
): number {
  if (!position) return configuredRest;
  return position.isLast ? configuredRest : 0;
}

/** Assigns a fresh group id to a run of exercises, or clears it. */
export function withSupersetGroup(
  exercises: TemplateExercise[],
  ids: string[],
  group: string | null
): TemplateExercise[] {
  const target = new Set(ids);
  return exercises.map((exercise) => {
    if (!target.has(exercise.id)) return exercise;
    if (group === null) {
      const { supersetGroup: _dropped, ...rest } = exercise;
      return rest;
    }
    return { ...exercise, supersetGroup: group };
  });
}

/**
 * Links or unlinks the boundary between exercise `index` and the one after it.
 *
 * Unlinking splits the group in two rather than dissolving it: breaking A-B-C
 * between A and B should leave B and C still paired. Linking merges whatever
 * groups either side already belongs to, so joining the end of one superset to
 * the start of another produces a single longer one.
 *
 * A group left holding one member is not cleaned up -- `groupedExercises`
 * already treats it as a plain exercise, and rewriting neighbours on every
 * toggle would churn ids for no visible gain.
 */
export function toggleSupersetLink(
  exercises: TemplateExercise[],
  index: number,
  newGroupId: () => string
): TemplateExercise[] {
  const first = exercises[index];
  const second = exercises[index + 1];
  if (!first || !second) return exercises;

  const linked = Boolean(first.supersetGroup) && first.supersetGroup === second.supersetGroup;

  if (linked) {
    const existing = first.supersetGroup;
    const fresh = newGroupId();
    return exercises.map((exercise, i) =>
      i > index && exercise.supersetGroup === existing
        ? { ...exercise, supersetGroup: fresh }
        : exercise
    );
  }

  const firstGroup = first.supersetGroup;
  const secondGroup = second.supersetGroup;
  const merged = firstGroup ?? secondGroup ?? newGroupId();
  return exercises.map((exercise, i) => {
    if (i === index || i === index + 1) return { ...exercise, supersetGroup: merged };
    if (firstGroup && exercise.supersetGroup === firstGroup) {
      return { ...exercise, supersetGroup: merged };
    }
    if (secondGroup && exercise.supersetGroup === secondGroup) {
      return { ...exercise, supersetGroup: merged };
    }
    return exercise;
  });
}

/** True when these two adjacent exercises are currently in the same superset. */
export function isLinkedToNext(exercises: TemplateExercise[], index: number): boolean {
  const first = exercises[index];
  const second = exercises[index + 1];
  return Boolean(first?.supersetGroup) && first?.supersetGroup === second?.supersetGroup;
}
