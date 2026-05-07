// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { MselCompetencyStore } from './msel-competency.store';
import { MselCompetencyQuery } from './msel-competency.query';
import { Injectable } from '@angular/core';
import {
  MselCompetency,
  MselCompetencyService,
} from 'src/app/generated/blueprint.api';
import { take, tap } from 'rxjs/operators';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class MselCompetencyDataService {
  readonly MselCompetencyList: Observable<MselCompetency[]>;

  constructor(
    private mselCompetencyStore: MselCompetencyStore,
    private mselCompetencyQuery: MselCompetencyQuery,
    private mselCompetencyService: MselCompetencyService
  ) {
    this.MselCompetencyList = this.mselCompetencyQuery.selectAll();
  }

  loadByMsel(mselId: string) {
    this.mselCompetencyStore.setLoading(true);
    this.mselCompetencyService
      .getMselCompetencies(mselId)
      .pipe(
        tap(() => {
          this.mselCompetencyStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (mselCompetencies) => {
          this.mselCompetencyStore.set(mselCompetencies);
        },
        (error) => {
          this.mselCompetencyStore.set([]);
        }
      );
  }

  unload() {
    this.mselCompetencyStore.set([]);
  }

  add(mselCompetency: MselCompetency) {
    this.mselCompetencyStore.setLoading(true);
    this.mselCompetencyService
      .createMselCompetency(mselCompetency)
      .pipe(
        tap(() => {
          this.mselCompetencyStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.mselCompetencyStore.add(s);
      });
  }

  delete(id: string) {
    this.mselCompetencyService
      .deleteMselCompetency(id)
      .pipe(take(1))
      .subscribe((r) => {
        this.mselCompetencyStore.remove(id);
      });
  }

  updateStore(mselCompetency: MselCompetency) {
    this.mselCompetencyStore.upsert(mselCompetency.id, mselCompetency);
  }

  deleteFromStore(id: string) {
    this.mselCompetencyStore.remove(id);
  }
}
