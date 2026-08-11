import React from 'react';
import { NavigationContainer, DarkTheme, Theme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/theme';

import WorkoutHomeScreen from '../screens/WorkoutHomeScreen';
import ExerciseHistoryScreen from '../screens/ExerciseHistoryScreen';
import MesosListScreen from '../screens/MesosListScreen';
import PlanBuilderScreen from '../screens/PlanBuilderScreen';
import MesoEditorScreen from '../screens/MesoEditorScreen';
import TemplatesListScreen from '../screens/TemplatesListScreen';
import TemplateEditorScreen from '../screens/TemplateEditorScreen';
import ExercisesListScreen from '../screens/ExercisesListScreen';
import AddExerciseScreen from '../screens/AddExerciseScreen';
import MoreHomeScreen from '../screens/MoreHomeScreen';
import HistoryScreen from '../screens/HistoryScreen';
import SettingsScreen from '../screens/SettingsScreen';

import {
  WorkoutStackParamList,
  MesosStackParamList,
  TemplatesStackParamList,
  ExercisesStackParamList,
  MoreStackParamList,
} from './types';

const Tab = createBottomTabNavigator();
const WorkoutStack = createNativeStackNavigator<WorkoutStackParamList>();
const MesosStack = createNativeStackNavigator<MesosStackParamList>();
const TemplatesStack = createNativeStackNavigator<TemplatesStackParamList>();
const ExercisesStack = createNativeStackNavigator<ExercisesStackParamList>();
const MoreStack = createNativeStackNavigator<MoreStackParamList>();

const screenOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.textPrimary,
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.background },
};

function WorkoutStackNavigator() {
  return (
    <WorkoutStack.Navigator screenOptions={screenOptions}>
      <WorkoutStack.Screen name="WorkoutHome" component={WorkoutHomeScreen} options={{ headerShown: false }} />
      <WorkoutStack.Screen name="ExerciseHistory" component={ExerciseHistoryScreen} options={{ title: 'History' }} />
    </WorkoutStack.Navigator>
  );
}

function MesosStackNavigator() {
  return (
    <MesosStack.Navigator screenOptions={screenOptions}>
      <MesosStack.Screen name="MesosList" component={MesosListScreen} options={{ title: 'Workout Builder' }} />
      <MesosStack.Screen name="PlanBuilder" component={PlanBuilderScreen} options={{ title: 'New Workout Plan' }} />
      <MesosStack.Screen name="MesoEditor" component={MesoEditorScreen} options={{ title: 'Edit Workout Plan' }} />
    </MesosStack.Navigator>
  );
}

function TemplatesStackNavigator() {
  return (
    <TemplatesStack.Navigator screenOptions={screenOptions}>
      <TemplatesStack.Screen name="TemplatesList" component={TemplatesListScreen} options={{ title: 'Templates' }} />
      <TemplatesStack.Screen name="TemplateEditor" component={TemplateEditorScreen} options={{ title: 'Edit Template' }} />
    </TemplatesStack.Navigator>
  );
}

function ExercisesStackNavigator() {
  return (
    <ExercisesStack.Navigator screenOptions={screenOptions}>
      <ExercisesStack.Screen name="ExercisesList" component={ExercisesListScreen} options={{ title: 'Exercises' }} />
      <ExercisesStack.Screen name="ExerciseHistory" component={ExerciseHistoryScreen} options={{ title: 'History' }} />
      <ExercisesStack.Screen name="AddExercise" component={AddExerciseScreen} options={{ title: 'New Exercise', presentation: 'modal' }} />
    </ExercisesStack.Navigator>
  );
}

function MoreStackNavigator() {
  return (
    <MoreStack.Navigator screenOptions={screenOptions}>
      <MoreStack.Screen name="MoreHome" component={MoreHomeScreen} options={{ title: 'More' }} />
      <MoreStack.Screen name="History" component={HistoryScreen} options={{ title: 'Workout History' }} />
      <MoreStack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    </MoreStack.Navigator>
  );
}

const navTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.surface,
    text: colors.textPrimary,
    border: colors.border,
    primary: colors.accent,
  },
};

const tabIcon: Record<string, keyof typeof Ionicons.glyphMap> = {
  Workout: 'calendar-outline',
  Mesos: 'folder-outline',
  Templates: 'grid-outline',
  Exercises: 'barbell-outline',
  More: 'ellipsis-horizontal-circle-outline',
};

export default function RootNavigator() {
  return (
    <NavigationContainer theme={navTheme}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={tabIcon[route.name]} size={size} color={color} />
          ),
        })}
      >
        <Tab.Screen name="Workout" component={WorkoutStackNavigator} />
        <Tab.Screen name="Mesos" component={MesosStackNavigator} options={{ tabBarLabel: 'Builder' }} />
        <Tab.Screen name="Templates" component={TemplatesStackNavigator} />
        <Tab.Screen name="Exercises" component={ExercisesStackNavigator} />
        <Tab.Screen name="More" component={MoreStackNavigator} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
