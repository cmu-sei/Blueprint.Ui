// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Injectable } from '@angular/core';
import { CanDeactivate } from '@angular/router';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { MselPlus } from 'src/app/data/msel/msel-data.service';

@Injectable({ providedIn: 'root' })
export class IntegrationInProgressGuard implements CanDeactivate<any> {
  constructor(private mselQuery: MselQuery) {}

  canDeactivate(): boolean {
    const msel = this.mselQuery.getActive() as MselPlus;
    if (
      msel?.integrationStatus &&
      !msel.integrationStatus.startsWith('ERROR')
    ) {
      return confirm(
        'An integration push is in progress. Are you sure you want to leave?'
      );
    }
    return true;
  }
}
