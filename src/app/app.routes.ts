// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Routes } from '@angular/router';
import { ComnAuthGuardService } from '@cmusei/crucible-common';

import { IntegrationInProgressGuard } from './services/integration-in-progress.guard';

export const ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/landing/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [ComnAuthGuardService],
  },
  {
    path: 'build',
    loadComponent: () => import('./components/home-app/home-app.component').then(m => m.HomeAppComponent),
    canActivate: [ComnAuthGuardService],
    canDeactivate: [IntegrationInProgressGuard],
  },
  {
    path: 'join',
    loadComponent: () => import('./components/landing/join/join.component').then(m => m.JoinComponent),
    canActivate: [ComnAuthGuardService],
  },
  {
    path: 'launch',
    loadComponent: () => import('./components/landing/launch/launch.component').then(m => m.LaunchComponent),
    canActivate: [ComnAuthGuardService],
  },
  {
    path: 'manage',
    loadComponent: () => import('./components/landing/manage/manage.component').then(m => m.ManageComponent),
    canActivate: [ComnAuthGuardService],
  },
  {
    path: 'starter',
    loadComponent: () => import('./components/starter/starter.component').then(m => m.StarterComponent),
    canActivate: [ComnAuthGuardService],
  },
  {
    path: 'assess',
    loadComponent: () => import('./components/assessor-page/assessor-page.component').then(m => m.AssessorPageComponent),
    canActivate: [ComnAuthGuardService],
  },
  {
    path: 'msel/:mselid/view',
    loadComponent: () => import('./components/msel-view/msel-view.component').then(m => m.MselViewComponent),
    canActivate: [ComnAuthGuardService],
  },
  {
    path: 'mselpage/:id',
    loadComponent: () => import('./components/msel-page/msel-page.component').then(m => m.MselPageComponent),
    canActivate: [ComnAuthGuardService],
  },
  {
    path: 'admin',
    loadComponent: () => import('./components/admin/admin-container/admin-container.component').then(m => m.AdminContainerComponent),
    canActivate: [ComnAuthGuardService],
  },
  {
    path: 'eventdetail',
    loadComponent: () => import('./components/event-detail-page/event-detail-page.component').then(m => m.EventDetailPageComponent),
    canActivate: [ComnAuthGuardService],
  },
];
