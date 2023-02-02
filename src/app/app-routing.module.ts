/*
 Copyright 2023 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the 
 project root for license information.
*/

// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
/// Released unde^Ca MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ComnAuthGuardService } from '@cmusei/crucible-common';
import { AdminContainerComponent } from './components/admin/admin-container/admin-container.component';
import { HomeAppComponent } from './components/home-app/home-app.component';
import { MselComponent } from './components/msel/msel.component';
import { MselViewComponent } from './components/msel-view/msel-view.component';

export const ROUTES: Routes = [
  {
    path: '',
    component: HomeAppComponent,
    canActivate: [ComnAuthGuardService],
  },
  {
    path: 'msel/:mselid/view',
    component: MselViewComponent,
    canActivate: [ComnAuthGuardService],
  },
  {
    path: 'admin',
    component: AdminContainerComponent,
    canActivate: [ComnAuthGuardService],
  },
];

@NgModule({
  exports: [RouterModule],
  imports: [CommonModule, RouterModule.forRoot(ROUTES, {})],
})
export class AppRoutingModule {}
