// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatToolbarModule } from '@angular/material/toolbar';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import {
  CiteService,
  Msel,
  MselRole,
  SystemPermission,
  SystemPermissionsService,
  Team,
  TeamRole,
  TeamUser,
  TeamUserService,
  User,
} from 'src/app/generated/blueprint.api';
import { MselStore } from 'src/app/data/msel/msel.store';
import { MselUnitStore } from 'src/app/data/msel-unit/msel-unit.store';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { TeamStore } from 'src/app/data/team/team.store';
import { TeamUserStore } from 'src/app/data/team-user/team-user.store';
import { CurrentUserStore, UserStore } from 'src/app/data/user/user.store';
import { TeamUsersComponent } from './team-users.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { permissionApiStubs } from 'src/app/test-utils/mock-permission-data.service';

const ME = 'user-me';
const ALICE: User = { id: 'user-a', name: 'Alice' };
const BOB: User = { id: 'user-b', name: 'Bob' };
const TEAM: Team = { id: 'team-1', mselId: 'msel-1', name: 'Blue Team', shortName: 'BLUE' };
const ALICE_ON_TEAM: TeamUser = { id: 'tu-1', teamId: 'team-1', userId: 'user-a' };
const ALL_BUT_MANAGE_MSELS = Object.values(SystemPermission).filter((p) => p !== SystemPermission.ManageMsels);

function msel(roles: MselRole[] = []): Msel {
  return {
    id: 'msel-1',
    name: 'Exercise Alpha',
    createdBy: 'someone-else',
    userMselRoles: roles.map((role, i) => ({ id: `umr-${i}`, userId: ME, mselId: 'msel-1', role })),
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

async function renderTeamUsers(overrides: { permissions?: SystemPermission[]; roles?: MselRole[] } = {}) {
  const { permissions = [], roles = [] } = overrides;
  const citeApi = {
    getTeamRoles: vi.fn(() => of<TeamRole[]>([{ id: 'tr-1', name: 'Incident Commander' }])),
  } satisfies ApiStub<CiteService>;
  const teamUserApi = {
    createTeamUser: vi.fn((tu: TeamUser) => of<TeamUser>({ ...tu, id: 'tu-2' })),
    deleteTeamUser: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<TeamUserService>;
  // TeamUsersComponent loads the permissions itself in ngOnInit, so the real
  // service is provided over the stubbed endpoint, without priming it.
  const permissionApis = permissionApiStubs({ system: permissions });
  const rendered = await renderComponent(TeamUsersComponent, {
    imports: [
      MatButtonModule,
      MatFormFieldModule,
      MatIconModule,
      MatInputModule,
      MatPaginatorModule,
      MatSelectModule,
      MatSortModule,
      MatTableModule,
      MatToolbarModule,
    ],
    declarations: [TeamUsersComponent],
    providers: [
      { provide: SystemPermissionsService, useValue: permissionApis.systemPermissions },
      PermissionDataService,
      { provide: CiteService, useValue: citeApi },
      { provide: TeamUserService, useValue: teamUserApi },
      // The MSEL page loads all of this; the stores are seeded instead. Alice
      // and Bob are in the MSEL's contributing unit; Alice is on the team.
      {
        provide: MselStore,
        useFactory: () => {
          const store = new MselStore();
          store.set([msel(roles)]);
          store.setActive('msel-1');
          return store;
        },
      },
      {
        provide: CurrentUserStore,
        useFactory: () => {
          const store = new CurrentUserStore();
          store.update({ id: ME, name: 'Me' });
          return store;
        },
      },
      seeded(UserStore, [ALICE, BOB]),
      seeded(TeamStore, [TEAM]),
      seeded(TeamUserStore, [ALICE_ON_TEAM]),
      seeded(MselUnitStore, [{ id: 'mu-1', mselId: 'msel-1', unitId: 'unit-1', unit: { id: 'unit-1', users: [ALICE, BOB] } }]),
    ],
    inputs: { team: TEAM },
  });
  return { ...rendered, teamUserApi, permissionApis };
}

// The first table lists contributors to add, the second the team's members.
const contributors = () => screen.getAllByRole('table')[0];
const members = () => screen.getAllByRole('table')[1];

describe('TeamUsersComponent', () => {
  /**
   * Verifies: with ManageMsels, or as the MSEL owner, contributors can be added and members removed and given a team role.
   * Interacts with: real PermissionDataService over SystemPermissionsService (stub), MselPlus.hasRole, real stores and queries.
   * Data: ManageMsels with no role; or no permission with the Owner role. Bob is a contributor, Alice a member.
   */
  it.each([
    { label: 'with ManageMsels', permissions: [SystemPermission.ManageMsels], roles: [] },
    { label: 'as the MSEL owner', permissions: [], roles: [MselRole.Owner] },
  ])('manages team members $label', async ({ permissions, roles }) => {
    const { teamUserApi } = await renderTeamUsers({ permissions, roles });
    const user = userEvent.setup();

    expect(within(members()).getByRole('combobox')).toHaveAttribute('aria-disabled', 'false');
    await user.click(within(contributors()).getByRole('button', { name: 'Add Bob to Team' }));
    expect(teamUserApi.createTeamUser).toHaveBeenCalledWith({ teamId: 'team-1', userId: 'user-b' });

    // Same case as 'labels the Remove button without the member name'.
    const aliceRow = within(members()).getByText('Alice').closest('mat-row') as HTMLElement;
    await user.click(within(aliceRow).getByRole('button', { name: 'Remove from Team' }));
    expect(teamUserApi.deleteTeamUser).toHaveBeenCalledWith('tu-1');
  });

  /**
   * Verifies: without ManageMsels and not the owner, the members are listed but cannot be added, removed or given a role, even with EditMsels as an MSEL Editor.
   * Interacts with: real PermissionDataService (stubbed grants), TeamUsersComponent.canEditMsel.
   * Data: every permission but ManageMsels (near miss); MSEL roles Editor and Approver.
   */
  it('lists the team read-only without ManageMsels or ownership', async () => {
    await renderTeamUsers({ permissions: ALL_BUT_MANAGE_MSELS, roles: [MselRole.Editor, MselRole.Approver] });

    expect(within(members()).getByText('Alice')).toBeInTheDocument();
    expect(within(contributors()).getByText('Bob')).toBeInTheDocument();
    expect(within(contributors()).queryByRole('button', { name: 'Add Bob to Team' })).not.toBeInTheDocument();
    expect(within(members()).queryByRole('button', { name: /^Remove/ })).not.toBeInTheDocument();
    expect(within(members()).getByRole('combobox')).toHaveAttribute('aria-disabled', 'true');
  });

  /**
   * Verifies: the member's Remove button's accessible name is "Remove from Team", without the member (current behavior).
   * Interacts with: TeamUsersComponent template.
   * Data: ManageMsels; Alice on the team.
   */
  it('labels the Remove button without the member name', async () => {
    await renderTeamUsers({ permissions: [SystemPermission.ManageMsels] });

    // Current behavior; see agent-docs/ui-test-bugs/blueprint.ui.md.
    expect(within(members()).getByRole('button', { name: /^Remove/ })).toHaveAccessibleName('Remove from Team');
  });
});
