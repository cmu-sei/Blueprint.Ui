// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, Input } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import {
  ApplicationTemplate,
  Msel,
  MselRole,
  PlayerApplication,
  PlayerApplicationService,
  PlayerApplicationTeam,
  PlayerApplicationTeamService,
  PlayerService,
  SystemPermission,
  SystemPermissionsService,
  Team,
} from 'src/app/generated/blueprint.api';
import { MselStore } from 'src/app/data/msel/msel.store';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { PlayerApplicationListComponent } from './player-application-list.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { permissionApiStubs } from 'src/app/test-utils/mock-permission-data.service';
import { unstubbed } from 'src/app/test-utils/unstubbed';

@Component({ selector: 'app-player-application-teams', template: '', standalone: false })
class AppTeamsStub {
  @Input() loggedInUserId: string;
  @Input() playerApplicationId: string;
  @Input() mselTeamList: Team[];
}
@Component({ selector: 'app-player-team-app-order', template: '', standalone: false })
class AppOrderStub {
  @Input() loggedInUserId: string;
  @Input() canEdit: boolean;
  @Input() mselTeamList: Team[];
}

const ME = 'user-me';
const BLUE: Team = { id: 'team-1', mselId: 'msel-1', name: 'Blue Team', shortName: 'BLUE' };
const MAIL: PlayerApplication = { id: 'app-1', mselId: 'msel-1', name: 'Mail', url: 'https://mail.example.com' };
const ALL_BUT_EDIT_MSELS = Object.values(SystemPermission).filter((p) => p !== SystemPermission.EditMsels);

function msel(roles: MselRole[] = []): Msel {
  return {
    id: 'msel-1',
    name: 'Exercise Alpha',
    createdBy: 'someone-else',
    teams: [BLUE],
    userMselRoles: roles.map((role, i) => ({ id: `umr-${i}`, userId: ME, mselId: 'msel-1', role })),
  };
}

async function renderAppList(overrides: { permissions?: SystemPermission[]; roles?: MselRole[] } = {}) {
  const { permissions = [], roles = [] } = overrides;
  const appApi = {
    getApplicationsByMsel: vi.fn(() => of(structuredClone([MAIL]))),
    deletePlayerApplication: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<PlayerApplicationService>;
  const appTeamApi = {
    getMselPlayerApplicationTeams: vi.fn(() => of<PlayerApplicationTeam[]>([])),
  } satisfies ApiStub<PlayerApplicationTeamService>;
  const playerApi = {
    getApplicationTemplates: vi.fn(() => of<ApplicationTemplate[]>([{ id: 't-1', name: 'Wiki', url: 'https://wiki.example.com' }])),
  } satisfies ApiStub<PlayerService>;
  // The user confirms every dialog.
  const confirm = vi.fn(() => dialogRefStub<unknown, boolean>(true).dialogRef);
  const dialog = { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>;
  // PlayerApplicationListComponent loads the permissions itself in ngOnInit,
  // so the real service is provided over the stubbed endpoint, without priming it.
  const permissionApis = permissionApiStubs({ system: permissions });
  const rendered = await renderComponent(PlayerApplicationListComponent, {
    imports: [MatButtonModule, MatExpansionModule, MatIconModule, MatMenuModule, MatSortModule, MatTableModule],
    declarations: [PlayerApplicationListComponent, AppTeamsStub, AppOrderStub],
    providers: [
      { provide: SystemPermissionsService, useValue: permissionApis.systemPermissions },
      PermissionDataService,
      { provide: PlayerApplicationService, useValue: appApi },
      { provide: PlayerApplicationTeamService, useValue: appTeamApi },
      { provide: PlayerService, useValue: playerApi },
      { provide: CrucibleDialogService, useValue: dialog },
      unstubbed(MatDialog),
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
    inputs: { loggedInUserId: ME },
  });
  const user = userEvent.setup();
  await user.click(screen.getByRole('heading', { name: 'Player Applications' }));
  return { ...rendered, appApi, appTeamApi, playerApi, confirm, user };
}

const table = () => screen.getByRole('table');
const ACTIONS = ['Add Player Application', 'Edit Mail', 'Delete Mail'];
const orderStub = (fixture: ComponentFixture<unknown>): AppOrderStub =>
  fixture.debugElement.query(By.directive(AppOrderStub)).componentInstance;

describe('PlayerApplicationListComponent', () => {
  /**
   * Verifies: the active MSEL's applications, application teams and the Player templates are loaded.
   * Interacts with: PlayerApplicationService, PlayerApplicationTeamService and PlayerService (stubs), real data services.
   * Data: MSEL msel-1 with application Mail.
   */
  it('loads the MSEL applications', async () => {
    const { appApi, appTeamApi, playerApi } = await renderAppList({ permissions: [SystemPermission.EditMsels] });

    expect(appApi.getApplicationsByMsel).toHaveBeenCalledWith('msel-1');
    expect(appTeamApi.getMselPlayerApplicationTeams).toHaveBeenCalledWith('msel-1');
    expect(playerApi.getApplicationTemplates).toHaveBeenCalledTimes(1);
    expect(within(table()).getByText('https://mail.example.com')).toBeInTheDocument();
  });

  /**
   * Verifies: with EditMsels, as an MSEL Editor, or as the owner, applications can be added, edited and deleted and the team order is editable.
   * Interacts with: real PermissionDataService (stubbed grants), MselPlus.hasRole, AppOrderStub canEdit input.
   * Data: EditMsels; or the Editor role; or the Owner role.
   */
  it.each([
    { label: 'with EditMsels', permissions: [SystemPermission.EditMsels], roles: [] },
    { label: 'as an MSEL Editor', permissions: [], roles: [MselRole.Editor] },
    { label: 'as the MSEL owner', permissions: [], roles: [MselRole.Owner] },
  ])('offers application actions $label', async ({ permissions, roles }) => {
    const { fixture } = await renderAppList({ permissions, roles });

    for (const name of ACTIONS) {
      expect(within(table()).getByRole('button', { name })).toBeInTheDocument();
    }
    expect(orderStub(fixture).canEdit).toBe(true);
  });

  /**
   * Verifies: without EditMsels, Editor or Owner the applications are read-only and the team order is not editable.
   * Interacts with: real PermissionDataService (stubbed grants), AppOrderStub canEdit input.
   * Data: every permission but EditMsels (near miss); MSEL roles Viewer, Evaluator and MoveEditor.
   */
  it('lists applications read-only without EditMsels or an editing role', async () => {
    const { fixture } = await renderAppList({ permissions: ALL_BUT_EDIT_MSELS, roles: [MselRole.Viewer, MselRole.Evaluator, MselRole.MoveEditor] });

    expect(within(table()).getByText('Mail')).toBeInTheDocument();
    for (const name of ACTIONS) {
      expect(within(table()).queryByRole('button', { name })).not.toBeInTheDocument();
    }
    expect(orderStub(fixture).canEdit).toBe(false);
  });

  /**
   * Verifies: expanding an application shows its team selection with the MSEL's teams.
   * Interacts with: row click, AppTeamsStub inputs.
   * Data: EditMsels; application Mail; MSEL team BLUE.
   */
  it('expands an application to choose its teams', async () => {
    const { fixture, user } = await renderAppList({ permissions: [SystemPermission.EditMsels] });

    await user.click(within(table()).getByText('Mail'));

    const teams = fixture.debugElement.query(By.directive(AppTeamsStub)).componentInstance as AppTeamsStub;
    expect(teams.playerApplicationId).toBe('app-1');
    expect(teams.mselTeamList).toEqual([BLUE]);
  });

  /**
   * Verifies: confirming Delete removes the application through the API and from the list.
   * Interacts with: CrucibleDialogService.confirm (stub, confirms), PlayerApplicationService.deletePlayerApplication (stub).
   * Data: EditMsels; application Mail.
   */
  it('deletes an application after confirmation', async () => {
    const { appApi, confirm, user } = await renderAppList({ permissions: [SystemPermission.EditMsels] });

    await user.click(within(table()).getByRole('button', { name: 'Delete Mail' }));

    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delete PlayerApplication' }));
    expect(appApi.deletePlayerApplication).toHaveBeenCalledWith('app-1');
    expect(within(table()).queryByText('Mail')).not.toBeInTheDocument();
  });
});
