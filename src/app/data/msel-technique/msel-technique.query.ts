// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { QueryEntity } from '@datorama/akita';
import {
  MselTechniqueState,
  MselTechniqueStore,
} from './msel-technique.store';
import { Technique, MselTechnique } from 'src/app/generated/blueprint.api';
import { TechniqueFamily, techniqueFamily } from 'src/app/utilities/technique-family';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class MselTechniqueQuery extends QueryEntity<MselTechniqueState> {
  constructor(protected store: MselTechniqueStore) {
    super(store);
  }

  selectById(id: string): Observable<MselTechnique> {
    return this.selectEntity(id);
  }

  /**
   * The pool's techniques in id order, or only those of one family.
   */
  selectTechniques(family?: TechniqueFamily): Observable<Technique[]> {
    return this.selectAll().pipe(
      map((items) => items
        .map((m) => m.technique)
        .filter((t) => !!t && (!family || techniqueFamily(t) === family))
        .sort((a, b) => compareAttackIds(a.externalId, b.externalId)))
    );
  }
}

/** Orders technique ids numerically, with a parent before its sub-techniques. */
export function compareAttackIds(a: string, b: string): number {
  return (a || '').localeCompare(b || '', undefined, { numeric: true });
}
