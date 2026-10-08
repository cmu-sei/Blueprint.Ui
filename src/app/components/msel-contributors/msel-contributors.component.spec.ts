// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import {
  Msel,
  MselRole,
  MselUnit,
  MselUnitService,
  SystemPermission,
  SystemPermissionsService,
  Unit,
  UnitService,
  UserMselRole,
  UserMselRoleService,
} from 'src/app/generated/blueprint.api';
import { MselStore } from 'src/app/data/msel/msel.store';
import { MselUnitStore } from 'src/app/data/msel-unit/msel-unit.store';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { UserMselRoleStore } from 'src/app/data/user-msel-role/user-msel-role.store';
import { MselContributorsComponent } from './msel-contributors.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { permissionApiStubs } from 'src/app/test-utils/mock-permission-data.service';

const ME = 'user-me';
const BLUE_UNIT: Unit = { id: 'unit-1', name: 'Blue Cell', shortName: 'BLUE', users: [{ id: 'user-a', name: 'Alice' }] };
const BLUE_CONTRIBUTES: MselUnit = { id: 'mu-1', mselId: 'msel-1', unitId: 'unit-1', unit: BLUE_UNIT };
const ALICE_EDITS: UserMselRole = { id: 'umr-a', userId: 'user-a', mselId: 'msel-1', role: MselRole.Editor };
const ALL_BUT_MANAGE_MSELS = Object.values(SystemPermission).filter((p) => p !== SystemPermission.ManageMsels);

function msel(myRoles: MselRole[] = []): Msel {
  return {
    id: 'msel-1',
    name: 'Exercise Alpha',
    createdBy: 'someone-else',
    userMselRoles: myRoles.map((role, i) => ({ id: `umr-me-${i}`, userId: ME, mselId: 'msel-1', role })),
  };
}

function seeded<S extends { set(entities: unknown[]): void }>(Store: new () => S, entities: unknown[]) {
  return {
    provide: Store,
    useFactory: () => {
      const store = new Store();
      store.set(structuredClone(entities));
      return store;
    },
  };
}

async function renderContributors(overrides: { permissions?: SystemPermission[]; myRoles?: MselRole[]; mselUnits?: MselUnit[] } = {}) {
  const { permissions = [], myRoles = [], mselUnits = [BLUE_CONTRIBUTES] } = overrides;
  const unitApi = {
    getUnits: vi.fn(() => of(structuredClone([BLUE_UNIT, { id: 'unit-2', name: 'Red Cell', shortName: 'RED', users: [] }]))),
  } satisfies ApiStub<UnitService>;
  const mselUnitApi = {
    deleteMselUnit: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<MselUnitService>;
  const roleApi = {
    createUserMselRole: vi.fn((umr: UserMselRole) => of<UserMselRole>({ ...umr, id: 'umr-new' })),
  } satisfies ApiStub<UserMselRoleService>;
  // The user confirms every dialog.
  const confirm = vi.fn(() => dialogRefStub<unknown, boolean>(true).dialogRef);
  const dialog = { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>;
  // MselContributorsComponent loads the permissions itself in ngOnInit, so the
  // real service is provided over the stubbed endpoint, without priming it.
  const permissionApis = permissionApiStubs({ system: permissions });
  const rendered = await renderComponent(MselContributorsComponent, {
    imports: [
      MatButtonModule,
      MatFormFieldModule,
      MatIconModule,
      MatInputModule,
      MatMenuModule,
      MatPaginatorModule,
      MatSelectModule,
      MatSortModule,
      MatTableModule,
      MatTooltipModule,
    ],
    declarations: [MselContributorsComponent],
    providers: [
      { provide: SystemPermissionsService, useValue: permissionApis.systemPermissions },
      PermissionDataService,
      { provide: UnitService, useValue: unitApi },
      { provide: MselUnitService, useValue: mselUnitApi },
      { provide: UserMselRoleService, useValue: roleApi },
      { provide: CrucibleDialogService, useValue: dialog },
      // The MSEL page loads the MSEL, its contributing units and roles; the stores are seeded instead.
      {
        provide: MselStore,
        useFactory: () => {
          const store = new MselStore();
          store.set([msel(myRoles)]);
          store.setActive('msel-1');
          return store;
        },
      },
      seeded(MselUnitStore, mselUnits),
      seeded(UserMselRoleStore, [ALICE_EDITS]),
    ],
    inputs: { loggedInUserId: ME },
  });
  return { ...rendered, unitApi, mselUnitApi, roleApi, confirm };
}

const table = () => screen.getByRole('table');
async function expandBlue() {
  const user = userEvent.setup();
  await user.click(within(table()).getByText('Blue Cell'));
  return user;
}

describe('MselContributorsComponent', () => {
  // The users who may manage contributors: ManageMsels, or the Owner role.
  const MANAGERS = [
    { label: 'with ManageMsels', permissions: [SystemPermission.ManageMsels], myRoles: [] },
    { label: 'as the MSEL owner', permissions: [], myRoles: [MselRole.Owner] },
  ];

  /**
   * Verifies: with ManageMsels, or as the MSEL owner, contributor units can be added and removed.
   * Interacts with: real PermissionDataService over SystemPermissionsService (stub), MselPlus.hasRole, UnitService.getUnits (stub).
   * Data: ManageMsels with no role; or the Owner role. Blue Cell contributes.
   */
  it.each(MANAGERS)('offers adding and removing units $label', async ({ permissions, myRoles }) => {
    const { unitApi } = await renderContributors({ permissions, myRoles });

    expect(unitApi.getUnits).toHaveBeenCalledTimes(1);
    expect(within(table()).getByTitle('Add a contributor unit')).toBeInTheDocument();
    expect(within(table()).getByTitle('Remove unit from MSEL')).toBeInTheDocument();
  });

  /**
   * Verifies: with ManageMsels, or as the MSEL owner, a member's MSEL roles can be changed.
   * Interacts with: the expanded unit's role select, UserMselRoleService.createUserMselRole (stub).
   * Data: ManageMsels with no role; or the Owner role. Alice, an Editor in Blue Cell, is made an Approver too.
   */
  it.each(MANAGERS)('changes a member role $label', async ({ permissions, myRoles }) => {
    const { roleApi } = await renderContributors({ permissions, myRoles });

    const user = await expandBlue();
    const roles = screen.getByLabelText('MSEL Roles');
    expect(roles).toHaveAttribute('aria-disabled', 'false');
    await user.click(roles);
    // Scoped to the open listbox: a role query with a name over the whole page is slow.
    await user.click(within(screen.getByRole('listbox')).getByText('Approver'));

    expect(roleApi.createUserMselRole).toHaveBeenCalledWith({ userId: 'user-a', mselId: 'msel-1', role: MselRole.Approver });
  });

  /**
   * Verifies: without ManageMsels and not the owner the contributors are read-only: no add or remove, and the role select is disabled.
   * Interacts with: real PermissionDataService (stubbed grants), MselContributorsComponent.canManageMsel.
   * Data: every permission but ManageMsels (near miss: EditMsels); MSEL roles Editor and Approver.
   */
  it('lists contributors read-only without ManageMsels or ownership', async () => {
    await renderContributors({ permissions: ALL_BUT_MANAGE_MSELS, myRoles: [MselRole.Editor, MselRole.Approver] });

    expect(within(table()).queryByTitle('Add a contributor unit')).not.toBeInTheDocument();
    expect(within(table()).queryByTitle('Remove unit from MSEL')).not.toBeInTheDocument();
    await expandBlue();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByLabelText('MSEL Roles')).toHaveAttribute('aria-disabled', 'true');
  });

  /**
   * Verifies: canViewMsel, which neither the template nor any other code calls (dead code), holds with ViewMsels or for a member of a contributing unit, and not otherwise.
   * Interacts with: MselContributorsComponent.canViewMsel, real PermissionDataService, real MselUnitQuery.
   * Data: ViewMsels; or the user in Blue Cell; or neither (near miss: every other permission).
   */
  it.each([
    { label: 'with ViewMsels', permissions: [SystemPermission.ViewMsels], inUnit: false, expected: true },
    { label: 'as a contributing unit member', permissions: [], inUnit: true, expected: true },
    { label: 'otherwise', permissions: Object.values(SystemPermission).filter((p) => p !== SystemPermission.ViewMsels), inUnit: false, expected: false },
  ])('canViewMsel (unused) is $expected $label', async ({ permissions, inUnit, expected }) => {
    const units = inUnit ? [{ ...BLUE_CONTRIBUTES, unit: { ...BLUE_UNIT, users: [{ id: ME, name: 'Me' }] } }] : [BLUE_CONTRIBUTES];
    const { fixture } = await renderContributors({ permissions, mselUnits: units });

    expect(fixture.componentInstance.canViewMsel()).toBe(expected);
  });

  /**
   * Verifies: confirming Remove deletes the contributing unit through the API.
   * Interacts with: CrucibleDialogService.confirm (stub, confirms), MselUnitService.deleteMselUnit (stub).
   * Data: ManageMsels; Blue Cell.
   */
  it('removes a contributing unit after confirmation', async () => {
    const { mselUnitApi, confirm } = await renderContributors({ permissions: [SystemPermission.ManageMsels] });
    const user = userEvent.setup();

    await user.click(within(table()).getByTitle('Remove unit from MSEL'));

    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Remove Contributor' }));
    expect(mselUnitApi.deleteMselUnit).toHaveBeenCalledWith('mu-1');
  });
});
