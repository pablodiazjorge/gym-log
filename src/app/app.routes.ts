import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: 'workout/:dayType/:variant',
    loadComponent: () => import('./features/workout/workout').then((m) => m.Workout),
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
];
