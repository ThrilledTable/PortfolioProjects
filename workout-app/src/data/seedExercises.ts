import { Exercise } from '../types';

let seq = 0;
const ex = (name: string, muscleGroup: Exercise['muscleGroup'], equipment: Exercise['equipment']): Exercise => ({
  id: `seed-${seq++}`,
  name,
  muscleGroup,
  equipment,
});

/**
 * Bumped whenever exercises are added below. A saved install records the
 * version it was seeded at, so a later release can top it up exactly once --
 * and an exercise you delete after that stays deleted.
 */
export const SEED_VERSION = 2;

export const SEED_EXERCISES: Exercise[] = [
  // Traps
  ex('Barbell Bent Over Shrug', 'Traps', 'Barbell'),
  ex('Barbell Shrug', 'Traps', 'Barbell'),
  ex('Dumbbell Shrug', 'Traps', 'Dumbbell'),
  ex('Cable Shrug', 'Traps', 'Cable'),
  // Abs
  ex('Cable Rope Crunch', 'Abs', 'Cable'),
  ex('Hanging Leg Raise', 'Abs', 'Bodyweight'),
  ex('Plank', 'Abs', 'Bodyweight'),
  ex('Machine Crunch', 'Abs', 'Machine'),
  ex('Sit Up', 'Abs', 'Bodyweight'),
  // Chest
  ex('Barbell Bench Press', 'Chest', 'Barbell'),
  ex('Incline Dumbbell Press', 'Chest', 'Dumbbell'),
  ex('Cable Fly', 'Chest', 'Cable'),
  ex('Machine Chest Press', 'Chest', 'Machine'),
  ex('Push Up', 'Chest', 'Bodyweight'),
  // Back
  ex('Deadlift', 'Back', 'Barbell'),
  ex('Pull Up', 'Back', 'Bodyweight'),
  ex('Barbell Row', 'Back', 'Barbell'),
  ex('Lat Pulldown', 'Back', 'Cable'),
  ex('Seated Cable Row', 'Back', 'Cable'),
  ex('T-Bar Row', 'Back', 'Machine'),
  // Shoulders
  ex('Overhead Press', 'Shoulders', 'Barbell'),
  ex('Dumbbell Lateral Raise', 'Shoulders', 'Dumbbell'),
  ex('Cable Lateral Raise', 'Shoulders', 'Cable'),
  ex('Machine Shoulder Press', 'Shoulders', 'Machine'),
  ex('Rear Delt Fly', 'Shoulders', 'Dumbbell'),
  // Biceps
  ex('Barbell Curl', 'Biceps', 'Barbell'),
  ex('Dumbbell Curl', 'Biceps', 'Dumbbell'),
  ex('Cable Curl', 'Biceps', 'Cable'),
  ex('Preacher Curl', 'Biceps', 'Machine'),
  // Triceps
  ex('Cable Tricep Pushdown', 'Triceps', 'Cable'),
  ex('Skull Crusher', 'Triceps', 'Barbell'),
  ex('Overhead Tricep Extension', 'Triceps', 'Dumbbell'),
  ex('Dips', 'Triceps', 'Bodyweight'),
  // Quads
  ex('Barbell Back Squat', 'Quads', 'Barbell'),
  ex('Leg Press', 'Quads', 'Machine'),
  ex('Leg Extension', 'Quads', 'Machine'),
  ex('Walking Lunge', 'Quads', 'Dumbbell'),
  // Hamstrings
  ex('Romanian Deadlift', 'Hamstrings', 'Barbell'),
  ex('Lying Leg Curl', 'Hamstrings', 'Machine'),
  ex('Seated Leg Curl', 'Hamstrings', 'Machine'),
  // Glutes
  ex('Hip Thrust', 'Glutes', 'Barbell'),
  ex('Cable Kickback', 'Glutes', 'Cable'),
  ex('Glute Bridge', 'Glutes', 'Bodyweight'),
  // Calves
  ex('Standing Calf Raise', 'Calves', 'Machine'),
  ex('Seated Calf Raise', 'Calves', 'Machine'),
  // Forearms
  ex('Wrist Curl', 'Forearms', 'Dumbbell'),
  ex('Farmer Carry', 'Forearms', 'Dumbbell'),

  // ---------------------------------------------------------------------
  // Added later. These are APPENDED rather than slotted in beside their
  // muscle group above, because ids are positional (`seed-<n>`) and every
  // saved plan and logged session points at one. Inserting here would quietly
  // repoint all of them. The list is sorted for display, so the order in this
  // file is not what you see.
  // ---------------------------------------------------------------------

  // Traps
  ex('Machine Shrug', 'Traps', 'Machine'),
  ex('Cable Upright Row', 'Traps', 'Cable'),
  ex('Scapular Pull Up', 'Traps', 'Bodyweight'),
  ex('Prone Y Raise', 'Traps', 'Bodyweight'),
  ex('Prone T Raise', 'Traps', 'Bodyweight'),

  // Abs
  ex('Barbell Rollout', 'Abs', 'Barbell'),
  ex('Dumbbell Side Bend', 'Abs', 'Dumbbell'),
  ex('Dumbbell Russian Twist', 'Abs', 'Dumbbell'),
  ex('Cable Woodchopper', 'Abs', 'Cable'),

  // Chest
  ex('Dumbbell Fly', 'Chest', 'Dumbbell'),
  ex('Pec Deck', 'Chest', 'Machine'),
  ex('Chest Dip', 'Chest', 'Bodyweight'),
  ex('Decline Push Up', 'Chest', 'Bodyweight'),

  // Back
  ex('Dumbbell Row', 'Back', 'Dumbbell'),
  ex('Inverted Row', 'Back', 'Bodyweight'),
  ex('Chin Up', 'Back', 'Bodyweight'),

  // Shoulders
  ex('Cable Face Pull', 'Shoulders', 'Cable'),
  ex('Pike Push Up', 'Shoulders', 'Bodyweight'),
  ex('Handstand Push Up', 'Shoulders', 'Bodyweight'),
  ex('Wall Handstand Hold', 'Shoulders', 'Bodyweight'),

  // Biceps
  ex('Hammer Curl', 'Biceps', 'Dumbbell'),
  ex('Machine Bicep Curl', 'Biceps', 'Machine'),
  ex('Close Grip Chin Up', 'Biceps', 'Bodyweight'),
  ex('Underhand Inverted Row', 'Biceps', 'Bodyweight'),
  ex('Ring Curl', 'Biceps', 'Bodyweight'),

  // Triceps
  ex('Close Grip Bench Press', 'Triceps', 'Barbell'),
  ex('Cable Overhead Extension', 'Triceps', 'Cable'),
  ex('Machine Tricep Extension', 'Triceps', 'Machine'),
  ex('Diamond Push Up', 'Triceps', 'Bodyweight'),
  ex('Bench Dip', 'Triceps', 'Bodyweight'),

  // Quads
  ex('Goblet Squat', 'Quads', 'Dumbbell'),
  ex('Hack Squat', 'Quads', 'Machine'),
  ex('Bodyweight Squat', 'Quads', 'Bodyweight'),
  ex('Bulgarian Split Squat', 'Quads', 'Bodyweight'),
  ex('Step Up', 'Quads', 'Bodyweight'),

  // Hamstrings
  ex('Good Morning', 'Hamstrings', 'Barbell'),
  ex('Dumbbell Romanian Deadlift', 'Hamstrings', 'Dumbbell'),
  ex('Cable Pull Through', 'Hamstrings', 'Cable'),
  ex('Nordic Curl', 'Hamstrings', 'Bodyweight'),
  ex('Single Leg Romanian Deadlift', 'Hamstrings', 'Bodyweight'),
  ex('Glute Ham Raise', 'Hamstrings', 'Bodyweight'),

  // Glutes
  ex('Sumo Deadlift', 'Glutes', 'Barbell'),
  ex('Dumbbell Bulgarian Split Squat', 'Glutes', 'Dumbbell'),
  ex('Hip Abduction Machine', 'Glutes', 'Machine'),
  ex('Smith Machine Hip Thrust', 'Glutes', 'Machine'),
  ex('Single Leg Glute Bridge', 'Glutes', 'Bodyweight'),
  ex('Frog Pump', 'Glutes', 'Bodyweight'),

  // Calves
  ex('Barbell Calf Raise', 'Calves', 'Barbell'),
  ex('Dumbbell Calf Raise', 'Calves', 'Dumbbell'),
  ex('Dumbbell Single Leg Calf Raise', 'Calves', 'Dumbbell'),
  ex('Leg Press Calf Raise', 'Calves', 'Machine'),
  ex('Bodyweight Calf Raise', 'Calves', 'Bodyweight'),
  ex('Single Leg Calf Raise', 'Calves', 'Bodyweight'),
  ex('Donkey Calf Raise', 'Calves', 'Bodyweight'),

  // Forearms
  ex('Reverse Curl', 'Forearms', 'Barbell'),
  ex('Cable Wrist Curl', 'Forearms', 'Cable'),
  ex('Cable Reverse Wrist Curl', 'Forearms', 'Cable'),
  ex('Cable Reverse Curl', 'Forearms', 'Cable'),
  ex('Dead Hang', 'Forearms', 'Bodyweight'),
  ex('Towel Hang', 'Forearms', 'Bodyweight'),
  ex('Fingertip Push Up', 'Forearms', 'Bodyweight'),
];
