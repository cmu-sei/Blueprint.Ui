// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { distinctUntilChanged, map, take } from 'rxjs/operators';
import { MselTechniqueService, MselCountermeasures } from 'src/app/generated/blueprint.api';
import { MselTechniqueQuery } from './msel-technique.query';

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
  private mselTechniqueService = inject(MselTechniqueService);
  private mselTechniqueQuery = inject(MselTechniqueQuery);

  private readonly subject = new BehaviorSubject<MselCountermeasures | undefined>(undefined);
  readonly countermeasures$: Observable<MselCountermeasures | undefined> = this.subject.asObservable();
  private loadedMselId = '';
  private loadedPoolKey = '';
  loading = false;

  constructor() {
    this.mselTechniqueQuery.selectAll()
      .pipe(
        map(items => items.map(m => m.techniqueId).sort().join(',')),
        distinctUntilChanged()
      )
      .subscribe(poolKey => {
        if (this.loadedMselId && poolKey !== this.loadedPoolKey && !this.mselTechniqueQuery.getValue().loading) {
          this.load(this.loadedMselId);
        }
      });
  }

  load(mselId: string) {
    this.loadedMselId = mselId;
    this.loadedPoolKey = this.poolKey();
    this.loading = true;
    this.mselTechniqueService
      .getMselCountermeasures(mselId)
      .pipe(take(1))
      .subscribe({
        next: result => {
          this.loading = false;
          this.subject.next(result);
        },
        error: () => {
          this.loading = false;
          this.subject.next({ mselId, techniqueReleaseId: null, hasMappings: false, techniques: [] });
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
    return this.mselTechniqueQuery.getAll().map(m => m.techniqueId).sort().join(',');
  }
}
