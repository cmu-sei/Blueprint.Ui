// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { SystemPermission, SystemRole, SystemRolesService } from 'src/app/generated/blueprint.api';
import { AdminRolesComponent } from './admin-roles.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { permissionDataProviders } from 'src/app/test-utils/mock-permission-data.service';

const ADMIN: SystemRole = { id: 'role-admin', name: 'Administrator', immutable: true, allPermissions: true, permissions: [] };
const ANALYST: SystemRole = { id: 'role-analyst', name: 'Analyst', immutable: false, allPermissions: false, permissions: [SystemPermission.ViewMsels] };
// Every system permission except ManageRoles: the near miss for the denied cases.
const ALL_BUT_MANAGE_ROLES = Object.values(SystemPermission).filter((p) => p !== SystemPermission.ManageRoles);

async function renderRoles(permissions: SystemPermission[]) {
  const rolesApi = {
    getSystemRoles: vi.fn(() => of(structuredClone([ADMIN, ANALYST]))),
    updateSystemRole: vi.fn((id: string, role: SystemRole) => of(structuredClone(role))),
    deleteSystemRole: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<SystemRolesService>;
  // The user confirms every dialog.
  const confirm = vi.fn(() => dialogRefStub<unknown, boolean>(true).dialogRef);
  const dialog = { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>;
  const rendered = await renderComponent(AdminRolesComponent, {
    imports: [
      MatButtonModule,
      MatCheckboxModule,
      MatFormFieldModule,
      MatIconModule,
      MatInputModule,
      MatTableModule,
      MatTooltipModule,
    ],
    declarations: [AdminRolesComponent],
    providers: [
      ...permissionDataProviders({ system: permissions }),
      { provide: SystemRolesService, useValue: rolesApi },
      { provide: CrucibleDialogService, useValue: dialog },
    ],
  });
  return { ...rendered, rolesApi, confirm };
}

const table = () => screen.getByRole('table');
// The header buttons carry only a tooltip, which Material exposes as the accessible description.
const queryDescribed = (description: string) => within(table()).queryByRole('button', { description });
// The matrix has a checkbox per role and permission; a role query over all of them is slow,
// so the inputs are counted directly.
const enabledCheckboxes = () =>
  Array.from(table().querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).filter((c) => !c.disabled);
// The rows: "All" plus one per system permission.
const ROWS = Object.values(SystemPermission).length + 1;

describe('AdminRolesComponent', () => {
  /**
   * Verifies: with ManageRoles the user can add roles, rename and delete the mutable role, and toggle its permissions; the immutable role stays locked.
   * Interacts with: real PermissionDataService (grants: ManageRoles), SystemRolesService.getSystemRoles (stub), real SystemRoleDataService.
   * Data: Administrator (immutable, all permissions) and Analyst (ViewMsels).
   */
  it('lets ManageRoles edit the mutable roles', async () => {
    const { rolesApi } = await renderRoles([SystemPermission.ManageRoles]);

    expect(rolesApi.getSystemRoles).toHaveBeenCalledTimes(1);
    expect(queryDescribed('Add New Role')).toBeInTheDocument();
    expect(within(table()).getAllByRole('button', { description: 'Rename Role' })).toHaveLength(1);
    expect(within(table()).getAllByRole('button', { description: 'Delete Role' })).toHaveLength(1);
    // Analyst's checkboxes only; Administrator is immutable.
    expect(enabledCheckboxes()).toHaveLength(ROWS);
  });

  /**
   * Verifies: without ManageRoles there is no Add, Rename or Delete, and every permission checkbox is disabled.
   * Interacts with: real PermissionDataService (grants: every permission but ManageRoles).
   * Data: near miss: ViewRoles and every other Manage permission; Administrator and Analyst.
   */
  it('makes the role matrix read-only without ManageRoles', async () => {
    await renderRoles(ALL_BUT_MANAGE_ROLES);

    expect(within(table()).getByText('Analyst')).toBeInTheDocument();
    expect(queryDescribed('Add New Role')).not.toBeInTheDocument();
    expect(queryDescribed('Rename Role')).not.toBeInTheDocument();
    expect(queryDescribed('Delete Role')).not.toBeInTheDocument();
    expect(enabledCheckboxes()).toHaveLength(0);
  });

  /**
   * Verifies: ticking a permission for a role saves the role with that permission added.
   * Interacts with: mat-checkbox change, SystemRolesService.updateSystemRole (stub).
   * Data: ManageRoles granted; Analyst gets the next unticked permission.
   */
  it('saves a permission ticked for a role', async () => {
    const { rolesApi } = await renderRoles([SystemPermission.ManageRoles]);
    const user = userEvent.setup();
    const createMselsRow = within(table()).getByText(SystemPermission.CreateMsels).closest('tr') as HTMLElement;

    await user.click(within(createMselsRow).getByRole('checkbox'));

    expect(rolesApi.updateSystemRole).toHaveBeenCalledWith(
      'role-analyst',
      expect.objectContaining({ permissions: [SystemPermission.ViewMsels, SystemPermission.CreateMsels] }),
    );
  });

  /**
   * Verifies: confirming Delete deletes the role through the API and removes its column from the matrix.
   * Interacts with: CrucibleDialogService.confirm (stub, confirms), SystemRolesService.deleteSystemRole (stub), real SystemRoleDataService and SystemRoleQuery.
   * Data: ManageRoles granted; Analyst.
   */
  it('deletes a role after confirmation', async () => {
    const { fixture, rolesApi, confirm } = await renderRoles([SystemPermission.ManageRoles]);
    const user = userEvent.setup();

    await user.click(within(table()).getByRole('button', { description: 'Delete Role' }));

    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delete Role', message: 'Are you sure that you want to delete Analyst?', confirmText: 'Delete' }));
    expect(rolesApi.deleteSystemRole).toHaveBeenCalledWith('role-analyst');
    fixture.detectChanges();
    expect(within(table()).queryByText('Analyst')).not.toBeInTheDocument();
    expect(within(table()).getByText('Administrator')).toBeInTheDocument();
  });
});
