// Copyright 2023 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { XApiService as GeneratedXApiService } from '../../generated/blueprint.api';
import { ComnSettingsService } from '@cmusei/crucible-common';

@Injectable({
  providedIn: 'root',
})
export class XApiService {
  private enabled: boolean;

  constructor(
    private generatedXApiService: GeneratedXApiService,
    private settingsService: ComnSettingsService
  ) {
    this.enabled = this.settingsService.settings.XApiEnabled ?? false;
  }

  /**
   * Logs xAPI viewed statement when user views a MSEL
   */
  viewedMsel(id: string): Observable<any> {
    if (!this.enabled) {
      return of(null);
    }
    return this.generatedXApiService.viewedMsel(id).pipe(
      catchError((error) => {
        console.error('xAPI tracking error:', error);
        return of(null);
      })
    );
  }

  /**
   * Logs xAPI viewed statement when user views the join page
   */
  viewedJoinPage(): Observable<any> {
    if (!this.enabled) {
      return of(null);
    }
    return this.generatedXApiService.viewedJoinPage().pipe(
      catchError((error) => {
        console.error('xAPI tracking error:', error);
        return of(null);
      })
    );
  }
}
