// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { QueryEntity } from '@datorama/akita';
import {
  MselAttackTechniqueState,
  MselAttackTechniqueStore,
} from './msel-attack-technique.store';
import { AttackTechnique, MselAttackTechnique } from 'src/app/generated/blueprint.api';
import { TechniqueFamily, techniqueFamily } from 'src/app/utilities/technique-family';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class MselAttackTechniqueQuery extends QueryEntity<MselAttackTechniqueState> {
  constructor(protected store: MselAttackTechniqueStore) {
    super(store);
  }

  selectById(id: string): Observable<MselAttackTechnique> {
    return this.selectEntity(id);
  }

  /**
   * The pool's techniques, in id order (T1003 before T1059, T1059 before T1059.001), or only the ones of one
   * family: the attack techniques (ATT&CK, ATLAS) or the defensive ones (D3FEND).
   */
  selectTechniques(family?: TechniqueFamily): Observable<AttackTechnique[]> {
    return this.selectAll().pipe(
      map((items) => items
        .map((m) => m.attackTechnique)
        .filter((t) => !!t && (!family || techniqueFamily(t) === family))
        .sort((a, b) => compareAttackIds(a.externalId, b.externalId)))
    );
  }
}

/** Orders ATT&CK ids numerically, so T1059.010 follows T1059.009 and a parent precedes its sub-techniques. */
export function compareAttackIds(a: string, b: string): number {
  return (a || '').localeCompare(b || '', undefined, { numeric: true });
}
