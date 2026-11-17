import { Exercise } from '../types';

let seq = 0;
const ex = (name: string, muscleGroup: Exercise['muscleGroup'], equipment: Exercise['equipment']): Exercise => ({
  id: `seed-${seq++}`,
  name,
  muscleGroup,
  equipment,
});

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
];
