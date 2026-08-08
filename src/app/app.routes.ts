import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: 'workout/routine/:routineId',
    loadComponent: () => import('./features/workout/workout').then((m) => m.Workout),
  },
  {
    path: 'workout/:dayType',
    loadComponent: () => import('./features/workout/workout').then((m) => m.Workout),
  },
  {
    path: 'routines',
    loadComponent: () => import('./features/routines/routines-list').then((m) => m.RoutinesList),
  },
  {
    path: 'routines/new',
    loadComponent: () => import('./features/routines/routine-editor').then((m) => m.RoutineEditor),
  },
  {
    path: 'routines/:routineId/edit',
    loadComponent: () => import('./features/routines/routine-editor').then((m) => m.RoutineEditor),
  },
  {
    path: 'exercises',
    loadComponent: () =>
      import('./features/exercise-library/exercise-library').then((m) => m.ExerciseLibrary),
  },
  {
    path: 'history',
    loadComponent: () => import('./features/history/history').then((m) => m.History),
  },
  {
    path: 'history/:sessionId',
    loadComponent: () => import('./features/history/session-detail').then((m) => m.SessionDetail),
  },
  {
    path: 'analysis',
    loadComponent: () => import('./features/analysis/analysis').then((m) => m.Analysis),
  },
  {
    path: 'additional',
    loadComponent: () => import('./features/additional/additional').then((m) => m.Additional),
  },
  {
    path: 'profile',
    loadComponent: () => import('./features/profile/profile').then((m) => m.Profile),
  },
];
