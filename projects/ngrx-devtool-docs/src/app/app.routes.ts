import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  {
    path: 'home',
    loadComponent: () => import('./home').then(m => m.Home)
  },
  {
    path: 'features',
    loadComponent: () => import('./features').then(m => m.Features)
  },
  {
    path: 'run-locally',
    loadComponent: () => import('./run-locally').then(m => m.RunLocally)
  },
  {
    path: 'installation',
    loadComponent: () => import('./installation').then(m => m.Installation)
  },
  {
    path: 'configuration',
    loadComponent: () => import('./configuration').then(m => m.Configuration)
  },
  {
    path: 'quick-start',
    loadComponent: () => import('./quick-start').then(m => m.QuickStart)
  },
  {
    path: 'how-it-works',
    loadComponent: () => import('./how-it-works').then(m => m.HowItWorks)
  },
  {
    path: 'action-monitoring',
    loadComponent: () => import('./action-monitoring').then(m => m.ActionMonitoring)
  },
  {
    path: 'effect-tracking',
    loadComponent: () => import('./effect-tracking').then(m => m.EffectTracking)
  },
  {
    path: 'state-visualization',
    loadComponent: () => import('./state-visualization').then(m => m.StateVisualization)
  },
  {
    path: 'diff-viewer',
    loadComponent: () => import('./diff-viewer').then(m => m.DiffViewer)
  },
  {
    path: 'performance',
    loadComponent: () => import('./performance').then(m => m.Performance)
  },
  {
    path: 'common-issues',
    loadComponent: () => import('./common-issues').then(m => m.CommonIssues)
  },
  {
    path: 'faq',
    loadComponent: () => import('./faq').then(m => m.Faq)
  },
  { path: '**', redirectTo: 'home' }
];
