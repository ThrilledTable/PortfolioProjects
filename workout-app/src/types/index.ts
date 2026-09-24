export const MUSCLE_GROUPS = [
  'Traps',
  'Abs',
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Forearms',
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const EQUIPMENT_TYPES = [
  'Barbell',
  'Dumbbell',
  'Cable',
  'Machine',
  'Bodyweight',
  'Other',
] as const;

export type Equipment = (typeof EQUIPMENT_TYPES)[number];

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  custom?: boolean;
  /**
   * A cue or reminder pinned to this exercise. It belongs to the exercise
   * rather than a session, so it shows every time the exercise comes up,
   * in any plan.
   */
  note?: string;
}

export interface TargetSet {
  id: string;
  repRange: string;
  rir: number;
  restSeconds: number;
}

export interface TemplateExercise {
  id: string;
  exerciseId: string;
  sets: TargetSet[];
  /**
   * Exercises sharing a group id are a superset: performed back to back with
   * no rest between them, resting only after the last one. Adjacency is not
   * enforced by the type -- `groupedExercises` in utils/supersets treats a
   * group as broken if something ungrouped sits between its members.
   */
  supersetGroup?: string;
}

export interface MesoDay {
  id: string;
  name: string;
  muscleGroups: MuscleGroup[];
  exercises: TemplateExercise[];
}

export interface Mesocycle {
  id: string;
  name: string;
  weeks: number;
  days: MesoDay[];
  deloadWeeks: number[];
  /**
   * The block this one was generated from. Day ids are carried over with it,
   * which is what lets week 1 of a new block read last block's loads instead
   * of re-testing every lift from nothing.
   */
  continuesFrom?: string;
}

export type SetType = 'warmup' | 'working' | 'drop';

export interface LoggedSet {
  id: string;
  weight: string;
  reps: string;
  rir: string;
  logged: boolean;
  type: SetType;
}

export type PainFlag = 'none' | 'mild' | 'sharp';
export type PumpLevel = 'low' | 'medium' | 'high';
export type EffortLevel = 'easy' | 'moderate' | 'hard' | 'max';

export interface MuscleFeedback {
  pump: PumpLevel;
  effort: EffortLevel;
}

export interface SessionExercise {
  id: string;
  exerciseId: string;
  sets: LoggedSet[];
  painFlag?: PainFlag;
}

export interface WorkoutSession {
  id: string;
  mesoId: string;
  mesoName: string;
  week: number;
  dayId: string;
  dayName: string;
  date: string;
  completedAt?: string;
  notes?: string;
  exercises: SessionExercise[];
  muscleFeedback?: Partial<Record<MuscleGroup, MuscleFeedback>>;
}

export interface ActivePosition {
  mesoId: string;
  week: number;
  dayIndex: number;
}

export type WeightUnit = 'lbs' | 'kg';

/** A body-weight reading. `weight` is canonical lbs like every other weight. */
export interface BodyweightEntry {
  id: string;
  /** ISO date-time the reading was taken. */
  date: string;
  weight: number;
  note?: string;
}

export interface Settings {
  unit: WeightUnit;
  defaultRestSeconds: number;
  /** Fire a local notification when the rest timer runs out while the app is backgrounded. */
  restTimerNotifications: boolean;
  /** Hold the screen on while a workout is in progress. */
  keepAwakeDuringWorkout: boolean;
  /** Last bar weight picked in the plate calculator, in the display unit's own terms. */
  barWeight: number;
}
