// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { AttackReleaseStore } from './attack-release.store';
import { Injectable } from '@angular/core';
import { AttackRelease, AttackReleaseService, AttackTechniqueCountermeasureImport } from 'src/app/generated/blueprint.api';
import { take, tap } from 'rxjs/operators';
import { Observable } from 'rxjs';

/** The ATT&CK releases an administrator has imported. Releases are read-only: import a new one, never edit. */
@Injectable({
  providedIn: 'root',
})
export class AttackReleaseDataService {
  constructor(
    private attackReleaseStore: AttackReleaseStore,
    private attackReleaseService: AttackReleaseService
  ) {}

  load() {
    this.attackReleaseStore.setLoading(true);
    this.attackReleaseService
      .getAttackReleases()
      .pipe(
        tap(() => {
          this.attackReleaseStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (releases) => {
          this.attackReleaseStore.set(releases);
        },
        (error) => {
          this.attackReleaseStore.set([]);
        }
      );
  }

  import(file: Blob, version: string): Observable<AttackRelease> {
    this.attackReleaseStore.setLoading(true);
    return this.attackReleaseService
      .importAttackRelease(file, version || undefined)
      .pipe(
        take(1),
        tap({
          next: (release) => {
            this.attackReleaseStore.setLoading(false);
            this.attackReleaseStore.add(release);
          },
          error: () => this.attackReleaseStore.setLoading(false),
        })
      );
  }

  /** Imports d3fend-full-mappings.json onto a D3FEND release and shows the stored count on its row. */
  importCountermeasures(releaseId: string, file: Blob): Observable<AttackTechniqueCountermeasureImport> {
    this.attackReleaseStore.setLoading(true);
    return this.attackReleaseService
      .importAttackTechniqueCountermeasures(releaseId, file)
      .pipe(
        take(1),
        tap({
          next: (result) => {
            this.attackReleaseStore.setLoading(false);
            this.attackReleaseStore.update(releaseId, { countermeasureCount: result.pairsStored });
          },
          error: () => this.attackReleaseStore.setLoading(false),
        })
      );
  }

  delete(id: string) {
    this.attackReleaseService
      .deleteAttackRelease(id)
      .pipe(take(1))
      .subscribe(() => {
        this.attackReleaseStore.remove(id);
      });
  }
}
