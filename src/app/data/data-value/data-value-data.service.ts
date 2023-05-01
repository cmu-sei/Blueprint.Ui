/*
 Copyright 2023 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { DataValueStore } from './data-value.store';
import { DataValueQuery } from './data-value.query';
import { Injectable } from '@angular/core';
import {
  DataValue,
  DataValueService
} from 'src/app/generated/blueprint.api';
import { MselDataService } from '../msel/msel-data.service';
import { map, take, tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class DataValueDataService {

  constructor(
    private dataValueService: DataValueService,
    private mselDataService: MselDataService,
    private dataValueQuery: DataValueQuery,
    private dataValueStore: DataValueStore
  ) {}

  loadByMsel(mselId: string) {
    this.dataValueStore.setLoading(true);
    this.dataValueService
      .getByMsel(mselId)
      .pipe(
        tap(() => {
          this.dataValueStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (dataValues) => {
          this.dataValueStore.set(dataValues);
        },
        (error) => {
          this.dataValueStore.set([]);
        }
      );
  }

  loadById(id: string) {
    this.dataValueStore.setLoading(true);
    return this.dataValueService
      .getDataValue(id)
      .pipe(
        tap(() => {
          this.dataValueStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.dataValueStore.upsert(s.id, { ...s });
      });
  }

  unload() {
    this.dataValueStore.set([]);
  }

  add(dataValue: DataValue) {
    this.dataValueStore.setLoading(true);
    this.dataValueService
      .createDataValue(dataValue)
      .pipe(
        tap(() => {
          this.dataValueStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((dv) => {
        this.dataValueStore.upsert(dv.id, dv);
      });
  }

  updateDataValue(dataValue: DataValue) {
    this.dataValueStore.setLoading(true);
    this.dataValueService
      .updateDataValue(dataValue.id, dataValue)
      .pipe(
        tap(() => {
          this.dataValueStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((dv) => {
        this.dataValueStore.upsert(dv.id, dv);
      });
  }

  delete(id: string) {
    this.dataValueService
      .deleteDataValue(id)
      .pipe(take(1))
      .subscribe((r) => {
        this.deleteFromStore(id);
      });
  }

  updateStore(dataValue: DataValue) {
    this.dataValueStore.upsert(dataValue.id, dataValue);
  }

  deleteFromStore(id: string) {
    this.dataValueStore.remove(id);
  }

}
