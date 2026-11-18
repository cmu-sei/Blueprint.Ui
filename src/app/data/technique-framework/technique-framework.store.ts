// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { EntityState, EntityStore, StoreConfig } from '@datorama/akita';
import { TechniqueFramework } from 'src/app/generated/blueprint.api';
import { Injectable } from '@angular/core';

export interface TechniqueFrameworkState extends EntityState<TechniqueFramework> {}

@Injectable({
  providedIn: 'root',
})
@StoreConfig({ name: 'techniqueFrameworks' })
export class TechniqueFrameworkStore extends EntityStore<TechniqueFrameworkState> {
  constructor() {
    super();
  }
}
