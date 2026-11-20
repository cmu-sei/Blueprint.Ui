// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { take, tap } from 'rxjs/operators';
import {
  TechniqueFramework,
  TechniqueFrameworkService,
} from 'src/app/generated/blueprint.api';
import { TechniqueReleaseDataService } from 'src/app/data/technique-release/technique-release-data.service';
import { TechniqueFrameworkStore } from './technique-framework.store';

/** What an exported definition file holds: the definition without its id and counts. */
export type TechniqueFrameworkDefinition = Pick<
  TechniqueFramework,
  'name' | 'description' | 'domain' | 'isDefensive' | 'format' | 'settings'
>;

/** The definition of a framework as an export writes it and an import reads it. */
export function toDefinition(
  framework: TechniqueFramework,
): TechniqueFrameworkDefinition {
  return {
    name: framework.name,
    description: framework.description,
    domain: framework.domain,
    isDefensive: framework.isDefensive,
    format: framework.format,
    settings: framework.settings,
  };
}

/**
 * The technique framework definitions an administrator creates, edits, imports and exports. Blueprint ships
 * none. Releases show what their framework says, so they are reloaded after a change.
 */
@Injectable({
  providedIn: 'root',
})
export class TechniqueFrameworkDataService {
  private techniqueFrameworkStore = inject(TechniqueFrameworkStore);
  private techniqueFrameworkService = inject(TechniqueFrameworkService);
  private techniqueReleaseDataService = inject(TechniqueReleaseDataService);

  load() {
    this.techniqueFrameworkStore.setLoading(true);
    this.techniqueFrameworkService
      .getTechniqueFrameworks()
      .pipe(take(1))
      .subscribe({
        next: (frameworks) => {
          this.techniqueFrameworkStore.set(frameworks);
          this.techniqueFrameworkStore.setLoading(false);
        },
        error: () => {
          this.techniqueFrameworkStore.set([]);
          this.techniqueFrameworkStore.setLoading(false);
        },
      });
  }

  /** Creates a framework; also how an exported definition is imported. */
  create(
    definition: TechniqueFrameworkDefinition,
  ): Observable<TechniqueFramework> {
    return this.techniqueFrameworkService
      .createTechniqueFramework(definition as TechniqueFramework)
      .pipe(
        take(1),
        tap((framework) =>
          this.techniqueFrameworkStore.upsert(framework.id, framework),
        ),
      );
  }

  update(
    id: string,
    definition: TechniqueFrameworkDefinition,
  ): Observable<TechniqueFramework> {
    return this.techniqueFrameworkService
      .updateTechniqueFramework(id, { ...definition, id } as TechniqueFramework)
      .pipe(
        take(1),
        tap((framework) => {
          this.techniqueFrameworkStore.update(id, framework);
          this.techniqueReleaseDataService.load();
        }),
      );
  }

  delete(id: string) {
    this.techniqueFrameworkService
      .deleteTechniqueFramework(id)
      .pipe(take(1))
      .subscribe(() => {
        this.techniqueFrameworkStore.remove(id);
        this.techniqueReleaseDataService.load();
      });
  }
}
