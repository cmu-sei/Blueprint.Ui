// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { MselAttackTechniqueStore } from './msel-attack-technique.store';
import { MselAttackTechniqueQuery } from './msel-attack-technique.query';
import { Injectable } from '@angular/core';
import {
  MselAttackTechnique,
  MselAttackTechniqueService,
  MselAttackTechniqueUpgrade,
} from 'src/app/generated/blueprint.api';
import { take, tap } from 'rxjs/operators';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class MselAttackTechniqueDataService {
  readonly MselAttackTechniqueList: Observable<MselAttackTechnique[]>;
  private loadedMselId = '';

  constructor(
    private mselAttackTechniqueStore: MselAttackTechniqueStore,
    private mselAttackTechniqueQuery: MselAttackTechniqueQuery,
    private mselAttackTechniqueService: MselAttackTechniqueService
  ) {
    this.MselAttackTechniqueList = this.mselAttackTechniqueQuery.selectAll();
  }

  loadByMsel(mselId: string) {
    this.loadedMselId = mselId;
    this.mselAttackTechniqueStore.setLoading(true);
    this.mselAttackTechniqueService
      .getMselAttackTechniques(mselId)
      .pipe(
        tap(() => {
          this.mselAttackTechniqueStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (items) => {
          this.mselAttackTechniqueStore.set(items);
        },
        (error) => {
          this.mselAttackTechniqueStore.set([]);
        }
      );
  }

  /** Loads the pool unless it is already the given MSEL's, for views that only read it. */
  ensureLoaded(mselId: string) {
    if (mselId && mselId !== this.loadedMselId) {
      this.loadByMsel(mselId);
    }
  }

  unload() {
    this.loadedMselId = '';
    this.mselAttackTechniqueStore.set([]);
  }

  add(mselId: string, attackTechniqueId: string) {
    this.mselAttackTechniqueService
      .createMselAttackTechnique({ mselId, attackTechniqueId })
      .pipe(take(1))
      .subscribe((s) => {
        this.mselAttackTechniqueStore.upsert(s.id, s);
      });
  }

  delete(id: string) {
    this.mselAttackTechniqueService
      .deleteMselAttackTechnique(id)
      .pipe(take(1))
      .subscribe(() => {
        this.mselAttackTechniqueStore.remove(id);
      });
  }

  /** Moves the pool to another release and reloads it; the caller reports what was dropped. */
  upgrade(mselId: string, attackReleaseId: string): Observable<MselAttackTechniqueUpgrade> {
    return this.mselAttackTechniqueService
      .upgradeMselAttackTechniques(mselId, attackReleaseId)
      .pipe(
        take(1),
        tap(() => this.loadByMsel(mselId))
      );
  }
}
