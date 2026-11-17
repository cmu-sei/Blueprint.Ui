// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { QueryEntity } from '@datorama/akita';
import { TechniqueReleaseState, TechniqueReleaseStore } from './technique-release.store';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class TechniqueReleaseQuery extends QueryEntity<TechniqueReleaseState> {
  constructor(protected store: TechniqueReleaseStore) {
    super(store);
  }
}
