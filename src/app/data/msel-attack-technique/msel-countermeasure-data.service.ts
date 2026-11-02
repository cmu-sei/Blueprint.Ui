// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { distinctUntilChanged, map, take } from 'rxjs/operators';
import { MselAttackTechniqueService, MselCountermeasures } from 'src/app/generated/blueprint.api';
import { MselAttackTechniqueQuery } from './msel-attack-technique.query';

/**
 * The D3FEND countermeasures of a MSEL's attack techniques, as the API answers them for the whole pool: from the
 * D3FEND release the defensive techniques are pinned to, else the newest with mappings. Loaded once per MSEL and
 * again whenever the pool changes, since adding an attack technique adds a group and adding the first defensive
 * technique may pin a different release.
 */
@Injectable({
  providedIn: 'root',
})
export class MselCountermeasureDataService {
  private mselAttackTechniqueService = inject(MselAttackTechniqueService);
  private mselAttackTechniqueQuery = inject(MselAttackTechniqueQuery);

  private readonly subject = new BehaviorSubject<MselCountermeasures | undefined>(undefined);
  readonly countermeasures$: Observable<MselCountermeasures | undefined> = this.subject.asObservable();
  private loadedMselId = '';
  private loadedPoolKey = '';
  loading = false;

  constructor() {
    this.mselAttackTechniqueQuery.selectAll()
      .pipe(
        map(items => items.map(m => m.attackTechniqueId).sort().join(',')),
        distinctUntilChanged()
      )
      .subscribe(poolKey => {
        if (this.loadedMselId && poolKey !== this.loadedPoolKey && !this.mselAttackTechniqueQuery.getValue().loading) {
          this.load(this.loadedMselId);
        }
      });
  }

  load(mselId: string) {
    this.loadedMselId = mselId;
    this.loadedPoolKey = this.poolKey();
    this.loading = true;
    this.mselAttackTechniqueService
      .getMselCountermeasures(mselId)
      .pipe(take(1))
      .subscribe({
        next: result => {
          this.loading = false;
          this.subject.next(result);
        },
        error: () => {
          this.loading = false;
          this.subject.next({ mselId, attackReleaseId: null, hasMappings: false, techniques: [] });
        },
      });
  }

  /** Loads the countermeasures unless they are already the given MSEL's. */
  ensureLoaded(mselId: string) {
    if (mselId && mselId !== this.loadedMselId) {
      this.load(mselId);
    }
  }

  unload() {
    this.loadedMselId = '';
    this.loadedPoolKey = '';
    this.subject.next(undefined);
  }

  private poolKey(): string {
    return this.mselAttackTechniqueQuery.getAll().map(m => m.attackTechniqueId).sort().join(',');
  }
}
