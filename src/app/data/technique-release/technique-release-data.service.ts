// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { TechniqueReleaseStore } from './technique-release.store';
import { Injectable } from '@angular/core';
import { TechniqueRelease, TechniqueReleaseNotice, TechniqueReleaseService, TechniqueCountermeasureImport } from 'src/app/generated/blueprint.api';
import { take, tap } from 'rxjs/operators';
import { Observable } from 'rxjs';

/**
 * The releases an administrator has imported. Techniques are read-only; only the publisher and notice fields change.
 */
@Injectable({
  providedIn: 'root',
})
export class TechniqueReleaseDataService {
  constructor(
    private techniqueReleaseStore: TechniqueReleaseStore,
    private techniqueReleaseService: TechniqueReleaseService
  ) {}

  load() {
    this.techniqueReleaseStore.setLoading(true);
    this.techniqueReleaseService
      .getTechniqueReleases()
      .pipe(
        tap(() => {
          this.techniqueReleaseStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (releases) => {
          this.techniqueReleaseStore.set(releases);
        },
        (error) => {
          this.techniqueReleaseStore.set([]);
        }
      );
  }

  import(file: Blob, version: string): Observable<TechniqueRelease> {
    this.techniqueReleaseStore.setLoading(true);
    return this.techniqueReleaseService
      .importTechniqueRelease(file, version || undefined)
      .pipe(
        take(1),
        tap({
          next: (release) => {
            this.techniqueReleaseStore.setLoading(false);
            this.techniqueReleaseStore.add(release);
          },
          error: () => this.techniqueReleaseStore.setLoading(false),
        })
      );
  }

  /** Imports a mappings file onto a defensive release and shows the stored count on its row. */
  importCountermeasures(releaseId: string, file: Blob): Observable<TechniqueCountermeasureImport> {
    this.techniqueReleaseStore.setLoading(true);
    return this.techniqueReleaseService
      .importTechniqueCountermeasures(releaseId, file)
      .pipe(
        take(1),
        tap({
          next: (result) => {
            this.techniqueReleaseStore.setLoading(false);
            this.techniqueReleaseStore.update(releaseId, { countermeasureCount: result.pairsStored });
          },
          error: () => this.techniqueReleaseStore.setLoading(false),
        })
      );
  }

  /** Saves a release's source, source URL, notice and terms URL. */
  updateNotice(id: string, notice: TechniqueReleaseNotice): Observable<TechniqueRelease> {
    return this.techniqueReleaseService
      .updateTechniqueRelease(id, notice)
      .pipe(
        take(1),
        tap((release) => this.techniqueReleaseStore.update(id, release))
      );
  }

  delete(id: string) {
    this.techniqueReleaseService
      .deleteTechniqueRelease(id)
      .pipe(take(1))
      .subscribe(() => {
        this.techniqueReleaseStore.remove(id);
      });
  }
}
