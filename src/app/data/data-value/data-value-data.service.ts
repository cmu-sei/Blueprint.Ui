// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
/// Released unde^Ca MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Injectable } from '@angular/core';
import {
  DataValue,
  DataValueService
} from 'src/app/generated/blueprint.api';
import { MselDataService } from '../msel/msel-data.service';
import { take } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class DataValueDataService {

  constructor(
    private dataValueService: DataValueService,
    private mselDataService: MselDataService
  ) {}

  add(dataValue: DataValue) {
    this.dataValueService.createDataValue(dataValue);
  }

  updateDataValue(dataValue: DataValue) {
    this.dataValueService
      .updateDataValue(dataValue.id, dataValue)
      .pipe(take(1))
      .subscribe((n) => {
        this.mselDataService.updateDataValue(n);
      });
  }
}
