// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ComnAuthGuardService } from '@cmusei/crucible-common';
import { AdminContainerComponent } from './components/admin/admin-container/admin-container.component';
import { HomeAppComponent } from './components/home-app/home-app.component';
import { MselPageComponent } from './components/msel-page/msel-page.component';
import { MselViewComponent } from './components/msel-view/msel-view.component';
import { DashboardComponent } from './components/landing/dashboard/dashboard.component';
import { JoinComponent } from './components/landing/join/join.component';
import { LaunchComponent } from './components/landing/launch/launch.component';
import { ManageComponent } from './components/landing/manage/manage.component';
import { StarterComponent } from './components/starter/starter.component';
import { EventDetailPageComponent } from './components/event-detail-page/event-detail-page.component';

export const ROUTES: Routes = [
  {
    path: '',
    component: DashboardComponent,
    canActivate: [ComnAuthGuardService],
  },
  {
    path: 'build',
    component: HomeAppComponent,
    canActivate: [ComnAuthGuardService],
  },
  {
    path: 'join',
    component: JoinComponent,
    canActivate: [ComnAuthGuardService],
  },
  {
    path: 'launch',
    component: LaunchComponent,
    canActivate: [ComnAuthGuardService],
  },
  {
    path: 'manage',
    component: ManageComponent,
    canActivate: [ComnAuthGuardService],
  },
  {
    path: 'starter',
    component: StarterComponent,
    canActivate: [ComnAuthGuardService],
  },
  {
    path: 'msel/:mselid/view',
    component: MselViewComponent,
    canActivate: [ComnAuthGuardService],
  },
  {
    path: 'mselpage/:id',
    component: MselPageComponent,
    canActivate: [ComnAuthGuardService],
  },
  {
    path: 'admin',
    component: AdminContainerComponent,
    canActivate: [ComnAuthGuardService],
  },
  {
    path: 'eventdetail',
    component: EventDetailPageComponent,
    canActivate: [ComnAuthGuardService],
  },
];

@NgModule({
  exports: [RouterModule],
  imports: [CommonModule, RouterModule.forRoot(ROUTES, {})],
})
export class AppRoutingModule {}
