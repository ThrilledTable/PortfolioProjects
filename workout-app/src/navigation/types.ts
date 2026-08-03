export type WorkoutStackParamList = {
  WorkoutHome: undefined;
  ExerciseHistory: { exerciseId: string };
};

export type MesosStackParamList = {
  MesosList: undefined;
  MesoEditor: { mesoId?: string };
};

export type TemplatesStackParamList = {
  TemplatesList: undefined;
  TemplateEditor: { templateId?: string };
};

export type ExercisesStackParamList = {
  ExercisesList: undefined;
  ExerciseHistory: { exerciseId: string };
  AddExercise: undefined;
};

export type MoreStackParamList = {
  MoreHome: undefined;
  History: undefined;
};
