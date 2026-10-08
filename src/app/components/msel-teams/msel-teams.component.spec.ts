// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, Input } from '@angular/core';
import { By } from '@angular/platform-browser';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import {
  CiteService,
  Msel,
  MselRole,
  SystemPermission,
  SystemPermissionsService,
  Team,
  TeamService,
  TeamType,
} from 'src/app/generated/blueprint.api';
import { MselStore } from 'src/app/data/msel/msel.store';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { TeamStore } from 'src/app/data/team/team.store';
import { MselTeamsComponent } from './msel-teams.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { permissionApiStubs } from 'src/app/test-utils/mock-permission-data.service';
import { unstubbed } from 'src/app/test-utils/unstubbed';

@Component({ selector: 'app-team-users', template: '', standalone: false })
class TeamUsersStub {
  @Input() team: Team;
}

const ME = 'user-me';
const BLUE: Team = { id: 'team-1', mselId: 'msel-1', name: 'Blue Team', shortName: 'BLUE', email: 'blue@example.com', citeTeamTypeId: 'tt-1', canTeamMemberInvite: true };
const ALL_BUT_MANAGE_MSELS = Object.values(SystemPermission).filter((p) => p !== SystemPermission.ManageMsels);

function msel(roles: MselRole[] = []): Msel {
  return {
    id: 'msel-1',
    name: 'Exercise Alpha',
    createdBy: 'someone-else',
    userMselRoles: roles.map((role, i) => ({ id: `umr-${i}`, userId: ME, mselId: 'msel-1', role })),
  };
}

async function renderMselTeams(overrides: { permissions?: SystemPermission[]; roles?: MselRole[] } = {}) {
  const { permissions = [], roles = [] } = overrides;
  const citeApi = {
    getTeamTypes: vi.fn(() => of<TeamType[]>([{ id: 'tt-1', name: 'Agency' }])),
  } satisfies ApiStub<CiteService>;
  const teamApi = {
    deleteTeam: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<TeamService>;
  // The user confirms every dialog.
  const confirm = vi.fn(() => dialogRefStub<unknown, boolean>(true).dialogRef);
  const dialog = { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>;
  // MselTeamsComponent loads the permissions itself in ngOnInit, so the real
  // service is provided over the stubbed endpoint, without priming it.
  const permissionApis = permissionApiStubs({ system: permissions });
  const rendered = await renderComponent(MselTeamsComponent, {
    imports: [
      MatButtonModule,
      MatCheckboxModule,
      MatFormFieldModule,
      MatIconModule,
      MatInputModule,
      MatMenuModule,
      MatPaginatorModule,
      MatSortModule,
      MatTableModule,
      MatTooltipModule,
    ],
    declarations: [MselTeamsComponent, TeamUsersStub],
    providers: [
      { provide: SystemPermissionsService, useValue: permissionApis.systemPermissions },
      PermissionDataService,
      { provide: CiteService, useValue: citeApi },
      { provide: TeamService, useValue: teamApi },
      { provide: CrucibleDialogService, useValue: dialog },
      unstubbed(MatDialog),
      // The MSEL page loads the MSEL and its teams; the stores are seeded instead.
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
        provide: TeamStore,
        useFactory: () => {
          const store = new TeamStore();
          store.set([structuredClone(BLUE)]);
          return store;
        },
      },
    ],
    inputs: { loggedInUserId: ME },
  });
  return { ...rendered, teamApi, confirm };
}

const table = () => screen.getByRole('table');
const ACTIONS = ['Add a team', 'Edit Blue Team', 'Delete team'];

describe('MselTeamsComponent', () => {
  /**
   * Verifies: the MSEL's teams are listed with email, CITE team type and the open-invite flag (read-only).
   * Interacts with: real TeamQuery and MselQuery (seeded), CiteService.getTeamTypes (stub).
   * Data: BLUE, an Agency team whose members can invite.
   */
  it('lists the MSEL teams', async () => {
    await renderMselTeams({ permissions: [SystemPermission.ManageMsels] });

    const row = within(within(table()).getByText('BLUE').closest('tr') as HTMLElement);
    expect(row.getByText('blue@example.com')).toBeInTheDocument();
    expect(row.getByText('Agency')).toBeInTheDocument();
    expect(row.getByRole('checkbox')).toBeChecked();
    expect(row.getByRole('checkbox')).toBeDisabled();
  });

  /**
   * Verifies: with ManageMsels, or as the MSEL owner, teams can be added, edited and deleted.
   * Interacts with: real PermissionDataService over SystemPermissionsService (stub), MselPlus.hasRole.
   * Data: ManageMsels with no role; or no permission with the Owner role.
   */
  it.each([
    { label: 'with ManageMsels', permissions: [SystemPermission.ManageMsels], roles: [] },
    { label: 'as the MSEL owner', permissions: [], roles: [MselRole.Owner] },
  ])('offers team actions $label', async ({ permissions, roles }) => {
    await renderMselTeams({ permissions, roles });

    for (const name of ACTIONS) {
      expect(within(table()).getByRole('button', { name })).toBeInTheDocument();
    }
  });

  /**
   * Verifies: without ManageMsels and not the owner the teams are read-only, even with EditMsels as an MSEL Editor.
   * Interacts with: real PermissionDataService (stubbed grants), MselTeamsComponent.canEditMsel.
   * Data: every permission but ManageMsels (near miss); MSEL roles Editor and Approver.
   */
  it('hides team actions without ManageMsels or ownership', async () => {
    await renderMselTeams({ permissions: ALL_BUT_MANAGE_MSELS, roles: [MselRole.Editor, MselRole.Approver] });

    expect(within(table()).getByText('Blue Team')).toBeInTheDocument();
    for (const name of ACTIONS) {
      expect(within(table()).queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  /**
   * Verifies: expanding a team shows its users.
   * Interacts with: row click, TeamUsersStub input.
   * Data: ManageMsels; BLUE.
   */
  it('expands a team to its users', async () => {
    const { fixture } = await renderMselTeams({ permissions: [SystemPermission.ManageMsels] });
    const user = userEvent.setup();

    await user.click(within(table()).getByText('Blue Team'));

    const users = fixture.debugElement.query(By.directive(TeamUsersStub)).componentInstance as TeamUsersStub;
    expect(users.team).toEqual(BLUE);
  });

  /**
   * Verifies: confirming Delete removes the team through the API and from the list.
   * Interacts with: CrucibleDialogService.confirm (stub, confirms), TeamService.deleteTeam (stub), real TeamStore.
   * Data: ManageMsels; BLUE.
   */
  it('deletes a team after confirmation', async () => {
    const { teamApi, confirm } = await renderMselTeams({ permissions: [SystemPermission.ManageMsels] });
    const user = userEvent.setup();

    await user.click(within(table()).getByRole('button', { name: 'Delete team' }));

    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delete Team' }));
    expect(teamApi.deleteTeam).toHaveBeenCalledWith('team-1');
    expect(within(table()).queryByText('Blue Team')).not.toBeInTheDocument();
  });
});
