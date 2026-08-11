export type WorkoutStackParamList = {
  WorkoutHome: undefined;
  ExerciseHistory: { exerciseId: string };
};

export type MesosStackParamList = {
  MesosList: undefined;
  PlanBuilder: undefined;
  MesoEditor: { mesoId?: string };
};

export type ExercisesStackParamList = {
  ExercisesList: undefined;
  ExerciseHistory: { exerciseId: string };
  AddExercise: undefined;
};

export type MoreStackParamList = {
  MoreHome: undefined;
  History: undefined;
  Settings: undefined;
};

export type RootTabParamList = {
  Workout: undefined;
  Mesos: { screen: keyof MesosStackParamList } | undefined;
  Exercises: undefined;
  More: undefined;
};
