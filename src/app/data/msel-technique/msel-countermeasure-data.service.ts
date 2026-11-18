// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { distinctUntilChanged, map, take } from 'rxjs/operators';
import {
  MselTechniqueService,
  MselCountermeasures,
} from 'src/app/generated/blueprint.api';
import { MselTechniqueQuery } from './msel-technique.query';

/**
 * The countermeasures of a MSEL's attack techniques, for the whole pool, from the defensive release it is
 * pinned to, else the newest with mappings. Reloaded whenever the pool changes.
 */
@Injectable({
  providedIn: 'root',
})
export class MselCountermeasureDataService {
  private mselTechniqueService = inject(MselTechniqueService);
  private mselTechniqueQuery = inject(MselTechniqueQuery);

  private readonly subject = new BehaviorSubject<
    MselCountermeasures | undefined
  >(undefined);
  readonly countermeasures$: Observable<MselCountermeasures | undefined> =
    this.subject.asObservable();
  private loadedMselId = '';
  // the latest load; a response to an earlier one, or one made before unload, is dropped
  private request = 0;
  private loadedPoolKey = '';
  loading = false;

  constructor() {
    this.mselTechniqueQuery
      .selectAll()
      .pipe(
        map((items) =>
          items
            .map((m) => m.techniqueId)
            .sort()
            .join(','),
        ),
        distinctUntilChanged(),
      )
      .subscribe((poolKey) => {
        if (
          this.loadedMselId &&
          poolKey !== this.loadedPoolKey &&
          !this.mselTechniqueQuery.getValue().loading
        ) {
          this.load(this.loadedMselId);
        }
      });
  }

  load(mselId: string) {
    this.loadedMselId = mselId;
    const request = ++this.request;
    this.loadedPoolKey = this.poolKey();
    this.loading = true;
    this.mselTechniqueService
      .getMselCountermeasures(mselId)
      .pipe(take(1))
      .subscribe({
        next: (result) => {
          if (request !== this.request) return;
          this.loading = false;
          this.subject.next(result);
        },
        error: () => {
          if (request !== this.request) return;
          this.loading = false;
          this.subject.next({
            mselId,
            techniqueReleaseId: null,
            hasMappings: false,
            techniques: [],
          });
        },
      });
  }

  /** Reloads the loaded MSEL's countermeasures, as after mappings are imported: its pool has not changed. */
  refresh() {
    if (this.loadedMselId) {
      this.load(this.loadedMselId);
    }
  }

  /** Loads the countermeasures unless they are already the given MSEL's. */
  ensureLoaded(mselId: string) {
    if (mselId && mselId !== this.loadedMselId) {
      this.load(mselId);
    }
  }

  unload() {
    this.loadedMselId = '';
    this.request++;
    this.loadedPoolKey = '';
    this.subject.next(undefined);
  }

  private poolKey(): string {
    return this.mselTechniqueQuery
      .getAll()
      .map((m) => m.techniqueId)
      .sort()
      .join(',');
  }
}
