// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { QueryEntity } from '@datorama/akita';
import { AttackReleaseState, AttackReleaseStore } from './attack-release.store';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class AttackReleaseQuery extends QueryEntity<AttackReleaseState> {
  constructor(protected store: AttackReleaseStore) {
    super(store);
  }
}
