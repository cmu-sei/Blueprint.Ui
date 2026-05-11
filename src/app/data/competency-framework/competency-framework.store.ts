// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { EntityState, EntityStore, StoreConfig } from '@datorama/akita';
import { CompetencyFramework } from 'src/app/generated/blueprint.api';
import { Injectable } from '@angular/core';

export interface CompetencyFrameworkState extends EntityState<CompetencyFramework> {}

@Injectable({
  providedIn: 'root',
})
@StoreConfig({ name: 'competencyFrameworks' })
export class CompetencyFrameworkStore extends EntityStore<CompetencyFrameworkState> {
  constructor() {
    super();
  }
}
