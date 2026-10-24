// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the collection root for license information.

import { Injectable, inject } from '@angular/core';
import { Observable, asapScheduler, defer } from 'rxjs';
import { observeOn, shareReplay, tap, take } from 'rxjs/operators';
import { SystemPermission, SystemPermissionsService } from 'src/app/generated/blueprint.api';

@Injectable({
  providedIn: 'root',
})
export class PermissionDataService {
  private permissionsService = inject(SystemPermissionsService);

  private _permissions: SystemPermission[] = [];
  get permissions(): SystemPermission[] {
    return this._permissions;
  }

  private permissions$: Observable<SystemPermission[]>;
  private isLoaded = false;

  // Fetched once and shared: many components call load() as they mount together, and the
  // caller's system permissions do not change without a page reload. A failed fetch is not
  // kept, so the next call tries again.
  load(): Observable<SystemPermission[]> {
    if (!this.permissions$) {
      this.permissions$ = defer(() => this.permissionsService.getMySystemPermissions()).pipe(
        take(1),
        tap((x) => {
          this._permissions = x;
          this.isLoaded = true;
        }),
        shareReplay(1)
      );
    }
    // An answer already in hand is still delivered asynchronously, as the request is: callers
    // update stores in their subscriptions, and doing that synchronously in ngOnInit changes a
    // parent's bindings after they were checked (NG0100).
    return this.isLoaded ? this.permissions$.pipe(observeOn(asapScheduler)) : this.permissions$;
  }

  hasPermission(permission: SystemPermission) {
    return this._permissions.includes(permission);
  }

  canViewAdministration() {
    return this._permissions.some((y) => y.startsWith('View'));
  }
}
