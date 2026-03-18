// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Provider } from '@angular/core';
import { of } from 'rxjs';
import { SystemPermission } from '../generated/blueprint.api';
import { PermissionDataService } from '../data/permission/permission-data.service';

export function permissionProvider(
  systemPerms: SystemPermission[] = []
): Provider {
  return {
    provide: PermissionDataService,
    useValue: {
      permissions: systemPerms,
      load: () => of(systemPerms),
      hasPermission: (p: SystemPermission) => systemPerms.includes(p),
      canViewAdministration: () => systemPerms.some((y) => y.startsWith('View')),
    },
  };
}
