// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { MselTechniqueStore } from './msel-technique.store';
import { MselTechniqueQuery } from './msel-technique.query';
import { Injectable } from '@angular/core';
import {
  MselTechnique,
  MselTechniqueService,
  MselTechniqueUpgrade,
} from 'src/app/generated/blueprint.api';
import { take, tap } from 'rxjs/operators';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class MselTechniqueDataService {
  readonly MselTechniqueList: Observable<MselTechnique[]>;
  private loadedMselId = '';

  constructor(
    private mselTechniqueStore: MselTechniqueStore,
    private mselTechniqueQuery: MselTechniqueQuery,
    private mselTechniqueService: MselTechniqueService,
  ) {
    this.MselTechniqueList = this.mselTechniqueQuery.selectAll();
  }

  loadByMsel(mselId: string) {
    this.loadedMselId = mselId;
    this.mselTechniqueStore.setLoading(true);
    this.mselTechniqueService
      .getMselTechniques(mselId)
      .pipe(
        tap(() => {
          this.mselTechniqueStore.setLoading(false);
        }),
        take(1),
      )
      .subscribe(
        (items) => {
          this.mselTechniqueStore.set(items);
        },
        (error) => {
          this.mselTechniqueStore.set([]);
        },
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
    this.mselTechniqueStore.set([]);
  }

  add(mselId: string, techniqueId: string) {
    this.mselTechniqueService
      .createMselTechnique({ mselId, techniqueId })
      .pipe(take(1))
      .subscribe((s) => {
        this.mselTechniqueStore.upsert(s.id, s);
      });
  }

  delete(id: string) {
    this.mselTechniqueService
      .deleteMselTechnique(id)
      .pipe(take(1))
      .subscribe(() => {
        this.mselTechniqueStore.remove(id);
      });
  }

  /** Moves the pool to another release and reloads it; the caller reports what was dropped. */
  upgrade(
    mselId: string,
    techniqueReleaseId: string,
  ): Observable<MselTechniqueUpgrade> {
    return this.mselTechniqueService
      .upgradeMselTechniques(mselId, techniqueReleaseId)
      .pipe(
        take(1),
        tap(() => this.loadByMsel(mselId)),
      );
  }
}
