// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import {
  Msel,
  MselRole,
  PlayerApplicationTeam,
  PlayerApplicationTeamService,
  SystemPermission,
  SystemPermissionsService,
  Team,
} from 'src/app/generated/blueprint.api';
import { MselStore } from 'src/app/data/msel/msel.store';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { PlayerApplicationTeamDataService } from 'src/app/data/team/player-application-team-data.service';
import { PlayerApplicationTeamsComponent } from './player-application-teams.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { permissionApiStubs } from 'src/app/test-utils/mock-permission-data.service';

const ME = 'user-me';
const BLUE: Team = { id: 'team-1', mselId: 'msel-1', name: 'Blue Team', shortName: 'BLUE' };
const RED: Team = { id: 'team-2', mselId: 'msel-1', name: 'Red Team', shortName: 'RED' };
const BLUE_ON_APP: PlayerApplicationTeam = { id: 'pat-1', playerApplicationId: 'app-1', teamId: 'team-1', displayOrder: 1 };
const ALL_BUT_EDIT_MSELS = Object.values(SystemPermission).filter((p) => p !== SystemPermission.EditMsels);

function msel(roles: MselRole[] = []): Msel {
  return {
    id: 'msel-1',
    name: 'Exercise Alpha',
    createdBy: 'someone-else',
    userMselRoles: roles.map((role, i) => ({ id: `umr-${i}`, userId: ME, mselId: 'msel-1', role })),
  };
}

async function renderAppTeams(overrides: { permissions?: SystemPermission[]; roles?: MselRole[] } = {}) {
  const { permissions = [], roles = [] } = overrides;
  const appTeamApi = {
    getMselPlayerApplicationTeams: vi.fn(() => of(structuredClone([BLUE_ON_APP]))),
    createPlayerApplicationTeam: vi.fn((pat: PlayerApplicationTeam) => of<PlayerApplicationTeam>({ ...pat, id: 'pat-2' })),
    deletePlayerApplicationTeam: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<PlayerApplicationTeamService>;
  // PlayerApplicationTeamsComponent loads the permissions itself in ngOnInit,
  // so the real service is provided over the stubbed endpoint, without priming it.
  const permissionApis = permissionApiStubs({ system: permissions });
  const rendered = await renderComponent(PlayerApplicationTeamsComponent, {
    imports: [
      MatButtonModule,
      MatCardModule,
      MatFormFieldModule,
      MatIconModule,
      MatInputModule,
      MatProgressSpinnerModule,
      MatSortModule,
      MatTableModule,
    ],
    declarations: [PlayerApplicationTeamsComponent],
    providers: [
      { provide: SystemPermissionsService, useValue: permissionApis.systemPermissions },
      PermissionDataService,
      { provide: PlayerApplicationTeamService, useValue: appTeamApi },
      {
        provide: MselStore,
        useFactory: () => {
          const store = new MselStore();
          store.set([msel(roles)]);
          store.setActive('msel-1');
          return store;
        },
      },
    ],
    inputs: { loggedInUserId: ME, playerApplicationId: 'app-1', mselTeamList: [BLUE, RED] },
  });
  // The player application list loads the MSEL's application teams.
  TestBed.inject(PlayerApplicationTeamDataService).getPlayerApplicationTeamsFromApi('msel-1');
  rendered.fixture.detectChanges();
  return { ...rendered, appTeamApi };
}

// One table lists the MSEL teams to add (rendered only while there are any),
// the other the application's teams.
const region = (selector: string) => document.querySelector(selector) as HTMLElement;
const mselTeams = () => region('.team-list-container');
const appTeams = () => region('.mat-table-player-application-teams');

describe('PlayerApplicationTeamsComponent', () => {
  /**
   * Verifies: with EditMsels, or as an MSEL Editor, teams can be added to and removed from the application.
   * Interacts with: real PermissionDataService over SystemPermissionsService (stub), MselPlus.hasRole, real PlayerApplicationTeamDataService.
   * Data: EditMsels with no role; or the Editor role. BLUE is on the application, RED is not.
   */
  it.each([
    { label: 'with EditMsels', permissions: [SystemPermission.EditMsels], roles: [] },
    { label: 'as an MSEL Editor', permissions: [], roles: [MselRole.Editor] },
  ])('adds and removes application teams $label', async ({ permissions, roles }) => {
    const { appTeamApi } = await renderAppTeams({ permissions, roles });
    const user = userEvent.setup();

    expect(within(appTeams()).getByText('BLUE')).toBeInTheDocument();
    await user.click(within(mselTeams()).getByRole('button', { name: 'Add Red Team' }));
    expect(appTeamApi.createPlayerApplicationTeam).toHaveBeenCalledWith({ playerApplicationId: 'app-1', teamId: 'team-2', displayOrder: 2 });

    // Same case as 'labels the Remove button without the team name'.
    const blueRow = within(appTeams()).getByText('BLUE').closest('mat-row') as HTMLElement;
    await user.click(within(blueRow).getByRole('button', { name: 'Remove' }));
    expect(appTeamApi.deletePlayerApplicationTeam).toHaveBeenCalledWith('pat-1');
  });

  /**
   * Verifies: without EditMsels and the Editor role the teams are listed with no Add or Remove.
   * Interacts with: real PermissionDataService (stubbed grants), PlayerApplicationTeamsComponent.canEditMsel.
   * Data: every permission but EditMsels (near miss: ManageMsels); MSEL roles Viewer, Evaluator and MoveEditor.
   */
  it('lists application teams read-only without EditMsels or the Editor role', async () => {
    await renderAppTeams({ permissions: ALL_BUT_EDIT_MSELS, roles: [MselRole.Viewer, MselRole.Evaluator, MselRole.MoveEditor] });

    expect(within(mselTeams()).getByText('RED')).toBeInTheDocument();
    expect(within(appTeams()).getByText('BLUE')).toBeInTheDocument();
    expect(within(mselTeams()).queryByRole('button', { name: 'Add Red Team' })).not.toBeInTheDocument();
    expect(within(appTeams()).queryByRole('button', { name: /^Remove/ })).not.toBeInTheDocument();
  });

  /**
   * Verifies: the Remove button's accessible name is "Remove", without the team (current behavior).
   * Interacts with: PlayerApplicationTeamsComponent template.
   * Data: EditMsels; BLUE on the application.
   */
  it('labels the Remove button without the team name', async () => {
    await renderAppTeams({ permissions: [SystemPermission.EditMsels] });

    // Current behavior; see agent-docs/ui-test-bugs/blueprint.ui.md.
    expect(within(appTeams()).getByRole('button', { name: /^Remove/ })).toHaveAccessibleName('Remove');
  });

  /**
   * Verifies: a team added to the MSEL while the application is open (a new mselTeamList from the parent) is offered for adding.
   * Interacts with: ngOnChanges, setDataSources, real PlayerApplicationTeamDataService.
   * Data: EditMsels; BLUE on the application, RED not; then the list gains Green Team (GREEN).
   */
  it('offers a team added to the MSEL while the application is open', async () => {
    const { fixture } = await renderAppTeams({ permissions: [SystemPermission.EditMsels] });
    const green: Team = { id: 'team-3', mselId: 'msel-1', name: 'Green Team', shortName: 'GREEN' };
    expect(within(mselTeams()).queryByRole('button', { name: 'Add Green Team' })).not.toBeInTheDocument();

    fixture.componentRef.setInput('mselTeamList', [BLUE, RED, green]);
    fixture.detectChanges();

    expect(within(mselTeams()).getByRole('button', { name: 'Add Red Team' })).toBeInTheDocument();
    expect(within(mselTeams()).getByRole('button', { name: 'Add Green Team' })).toBeInTheDocument();
    expect(within(mselTeams()).queryByRole('button', { name: 'Add Blue Team' })).not.toBeInTheDocument();
  });
});
