// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import { of, BehaviorSubject } from 'rxjs';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { AdminRolesComponent } from './admin-roles.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { SystemRoleDataService } from 'src/app/data/system-role/system-role-data.service';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { SystemRole } from 'src/app/generated/blueprint.api';

async function renderAdminRoles(
  overrides: {
    canEdit?: boolean;
    roles?: SystemRole[];
  } = {},
) {
  const { canEdit = false, roles = [] } = overrides;
  const rolesSubject = new BehaviorSubject<SystemRole[]>(roles);

  return renderComponent(AdminRolesComponent, {
    declarations: [AdminRolesComponent],
    imports: [MatTableModule, MatCheckboxModule],
    providers: [
      {
        provide: SystemRoleDataService,
        useValue: {
          roles$: rolesSubject.asObservable(),
          getRoles: () => of(roles),
          editRole: () => of({}),
          createRole: () => of({}),
          deleteRole: () => of({}),
        },
      },
      {
        provide: PermissionDataService,
        useValue: {
          permissions: [],
          load: () => of([]),
          hasPermission: () => canEdit,
          canViewAdministration: () => false,
        },
      },
      {
        provide: DialogService,
        useValue: {
          confirm: () => of({ confirm: true }),
        },
      },
    ],
  });
}

describe('AdminRolesComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderAdminRoles();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display Permissions column header', async () => {
    await renderAdminRoles();
    expect(screen.getByText('Permissions')).toBeInTheDocument();
  });

  it('should display permission names in the table', async () => {
    await renderAdminRoles();
    // The "All" pseudo-permission should be listed
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('should set canEdit based on ManageRoles permission', async () => {
    const { fixture } = await renderAdminRoles({ canEdit: true });
    expect(fixture.componentInstance.canEdit).toBe(true);
  });

  it('should show Add New Role button when canEdit is true', async () => {
    const { fixture } = await renderAdminRoles({ canEdit: true });
    fixture.detectChanges();
    const addButton = fixture.nativeElement.querySelector(
      'button[mattooltip="Add New Role"]',
    );
    expect(addButton).toBeTruthy();
  });

  it('should not show Add New Role button when canEdit is false', async () => {
    const { fixture } = await renderAdminRoles({ canEdit: false });
    fixture.detectChanges();
    const addButton = fixture.nativeElement.querySelector(
      'button[mattooltip="Add New Role"]',
    );
    expect(addButton).toBeNull();
  });

  it('should display role names as column headers', async () => {
    const roles: SystemRole[] = [
      {
        id: 'role-1',
        name: 'SuperAdmin',
        permissions: [],
        allPermissions: true,
        immutable: true,
      },
    ];
    await renderAdminRoles({ roles });
    expect(screen.getByText('SuperAdmin')).toBeInTheDocument();
  });
});
