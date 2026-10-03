// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// Provides the app's REAL PermissionDataService over a stubbed "my
// permissions" endpoint, so the gate logic under test is the production code.
// Blueprint's PermissionDataService only holds system permissions; MSEL and
// team roles arrive on the MSEL itself and are seeded through the MSEL store.

import { inject, Provider } from '@angular/core';
import { vi } from 'vitest';
import { of } from 'rxjs';
import {
  SystemPermission,
  SystemPermissionsService,
} from '../generated/blueprint.api';
import { PermissionDataService } from '../data/permission/permission-data.service';
import { ApiStub } from './api-stub';

export interface PermissionGrants {
  system?: SystemPermission[];
}

export function permissionApiStubs(grants: PermissionGrants = {}) {
  return {
    systemPermissions: {
      getMySystemPermissions: vi.fn(() => of([...(grants.system ?? [])])),
    } satisfies ApiStub<SystemPermissionsService>,
  };
}

export function permissionDataProviders(
  grants: PermissionGrants = {},
): Provider[] {
  const stubs = permissionApiStubs(grants);
  return [
    { provide: SystemPermissionsService, useValue: stubs.systemPermissions },
    {
      provide: PermissionDataService,
      // inject() resolves the stub above (or a test's own override) with the
      // real type, so the partial stub needs no cast.
      useFactory: () => {
        const service = new PermissionDataService(
          inject(SystemPermissionsService),
        );
        // For components that read the cached permissions without calling
        // load() themselves (admin-users, admin-roles, admin-groups);
        // StarterComponent loads them when the app opens. A component that
        // calls load() in ngOnInit (top bar, admin container, MSEL list) is
        // tested with permissionApiStubs() plus the plain service instead.
        service.load().subscribe();
        return service;
      },
    },
  ];
}
