// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, Input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { fireEvent, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { ComnSettingsService, CrucibleDialogService } from '@cmusei/crucible-common';
import {
  ApplicationTemplate,
  Msel,
  MselItemStatus,
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
import { TeamStore } from 'src/app/data/team/team.store';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { PlayerApplicationListComponent } from './player-application-list.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { permissionApiStubs } from 'src/app/test-utils/mock-permission-data.service';
import { unstubbed } from 'src/app/test-utils/unstubbed';
import { PlayerApplicationTeamsComponent } from '../player-application-teams/player-application-teams.component';
import { PlayerTeamAppOrderComponent } from '../player-team-app-order/player-team-app-order.component';

@Component({ selector: 'app-player-application-teams', template: '' })
class AppTeamsStub {
  @Input() loggedInUserId: string;
  @Input() playerApplicationId: string;
  @Input() mselTeamList: Team[];
}
@Component({ selector: 'app-player-team-app-order', template: '' })
class AppOrderStub {
  @Input() loggedInUserId: string;
  @Input() canEdit: boolean;
  @Input() mselTeamList: Team[];
}

const ME = 'user-me';
const BLUE: Team = { id: 'team-1', mselId: 'msel-1', name: 'Blue Team', shortName: 'BLUE' };
const MAIL: PlayerApplication = { id: 'app-1', mselId: 'msel-1', name: 'Mail', url: 'https://mail.example.com' };
const ALL_BUT_EDIT_MSELS = Object.values(SystemPermission).filter((p) => p !== SystemPermission.EditMsels);

// A MSEL that deploys its topology through Caster: Player in use and a directory chosen.
const CASTER_READY: Partial<Msel> = { useCaster: true, usePlayer: true, casterDirectoryId: 'dir-1' };
const SETTINGS = { PlayerUrl: 'http://player.example/', VmUrl: 'http://vm.example' };

function msel(roles: MselRole[] = [], extra: Partial<Msel> = {}): Msel {
  return {
    id: 'msel-1',
    name: 'Exercise Alpha',
    createdBy: 'someone-else',
    teams: [BLUE],
    userMselRoles: roles.map((role, i) => ({ id: `umr-${i}`, userId: ME, mselId: 'msel-1', role })),
    ...extra,
  };
}

async function renderAppList(
  overrides: { permissions?: SystemPermission[]; roles?: MselRole[]; apps?: PlayerApplication[]; mselExtra?: Partial<Msel> } = {},
) {
  const { permissions = [], roles = [], apps = [MAIL], mselExtra = {} } = overrides;
  const appApi = {
    getApplicationsByMsel: vi.fn(() => of(structuredClone(apps))),
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
    imports: [MatButtonModule, MatCheckboxModule, MatExpansionModule, MatIconModule, MatMenuModule, MatSortModule, MatTableModule, MatTooltipModule],
    childStubs: [
      { replace: PlayerApplicationTeamsComponent, with: AppTeamsStub },
      { replace: PlayerTeamAppOrderComponent, with: AppOrderStub },
    ],
    providers: [
      { provide: SystemPermissionsService, useValue: permissionApis.systemPermissions },
      PermissionDataService,
      { provide: PlayerApplicationService, useValue: appApi },
      { provide: PlayerApplicationTeamService, useValue: appTeamApi },
      { provide: PlayerService, useValue: playerApi },
      { provide: CrucibleDialogService, useValue: dialog },
      { provide: ComnSettingsService, useValue: { settings: SETTINGS } satisfies Pick<ComnSettingsService, 'settings'> },
      unstubbed(MatDialog),
      {
        provide: MselStore,
        useFactory: () => {
          const store = new MselStore();
          store.set([msel(roles, mselExtra)]);
          store.setActive('msel-1');
          return store;
        },
      },
      // The MSEL page loads the MSEL's teams; the store is seeded instead.
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
   * Verifies: expanding an application shows its team selection with the MSEL's teams from the team store.
   * Interacts with: row click, AppTeamsStub inputs, real TeamQuery (seeded).
   * Data: EditMsels; application Mail; MSEL team BLUE in the team store.
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

  /**
   * Verifies: each application shows its icon (a font icon for an mdi- name, an image resolved under the Player UI otherwise, nothing without one), with the icon as the cell's title, and its Embeddable and Load in Background flags as read-only checkboxes.
   * Interacts with: playerAppIconUrl, real PlayerApplicationQuery, ComnSettingsService (stub, PlayerUrl).
   * Data: EditMsels; Mail (mdi-email, embeddable), Wiki (assets/wiki.png, loads in background), Notes (no icon).
   */
  it('shows the icon and the Player flags of each application', async () => {
    await renderAppList({
      permissions: [SystemPermission.EditMsels],
      apps: [
        { ...MAIL, icon: 'mdi-email', embeddable: true, loadInBackground: false },
        { id: 'app-2', mselId: 'msel-1', name: 'Wiki', url: 'https://wiki.example.com', icon: 'assets/wiki.png', embeddable: false, loadInBackground: true },
        { id: 'app-3', mselId: 'msel-1', name: 'Notes', url: 'https://notes.example.com', icon: '', embeddable: false, loadInBackground: false },
      ],
    });

    const rowOf = (name: string) => within(within(table()).getByText(name).closest('tr') as HTMLElement);
    expect(within(table()).getByTitle('mdi-email').querySelector('mat-icon')).toHaveClass('mdi-email');
    expect(within(table()).getByTitle('mdi-email').querySelector('img')).toBeNull();
    expect(rowOf('Wiki').getByRole('img', { name: 'Wiki' })).toHaveAttribute('src', 'http://player.example/assets/wiki.png');
    expect(rowOf('Notes').queryByRole('img')).not.toBeInTheDocument();
    expect(rowOf('Notes').getAllByRole('cell')[3].querySelector('mat-icon')).toBeNull();
    const flags = (name: string) => rowOf(name).getAllByRole('checkbox');
    expect(flags('Mail').map((box) => (box as HTMLInputElement).checked)).toEqual([true, false]);
    expect(flags('Wiki').map((box) => (box as HTMLInputElement).checked)).toEqual([false, true]);
    for (const box of [...flags('Mail'), ...flags('Wiki'), ...flags('Notes')]) {
      expect(box).toBeDisabled();
    }
  });

  /**
   * Verifies: an icon image that fails to load is removed, so no broken image shows.
   * Interacts with: the img error handler (brokenIcons).
   * Data: EditMsels; Wiki with icon https://cdn.example/missing.png, whose load fails.
   */
  it('hides an icon image that fails to load', async () => {
    await renderAppList({
      permissions: [SystemPermission.EditMsels],
      apps: [{ id: 'app-2', mselId: 'msel-1', name: 'Wiki', url: 'https://wiki.example.com', icon: 'https://cdn.example/missing.png' }],
    });

    fireEvent.error(within(table()).getByRole('img', { name: 'Wiki' }));

    expect(within(table()).queryByRole('img', { name: 'Wiki' })).not.toBeInTheDocument();
    expect(within(table()).getByTitle('https://cdn.example/missing.png')).toBeInTheDocument();
  });

  /**
   * Verifies: a MSEL set up to deploy through Caster that is not yet deployed warns when none of its applications opens the VM UI.
   * Interacts with: casterVmAppWarning, ComnSettingsService (stub, VmUrl), real PlayerApplicationQuery.
   * Data: EditMsels; Caster and Player in use with directory dir-1, status Pending; only the Mail application.
   */
  it('warns that no application opens the VM UI', async () => {
    await renderAppList({ permissions: [SystemPermission.EditMsels], mselExtra: { ...CASTER_READY, status: MselItemStatus.Pending } });

    expect(
      screen.getByText(
        'No Player application opens the VM UI, so participants will not be able to reach the Caster VMs. Add one using {vmUrl}, for example {vmUrl}/views/{playerViewId}.',
      ),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: there is no VM UI warning once an application opens the VM UI, once the MSEL is deployed, or when Caster is not used.
   * Interacts with: casterVmAppWarning, the template's Deployed check.
   * Data: EditMsels; a Caster-ready MSEL with a {vmUrl} application; the same MSEL Deployed with only Mail; a MSEL without Caster.
   */
  it.each([
    { label: 'an application opens the VM UI', mselExtra: { ...CASTER_READY, status: MselItemStatus.Pending }, apps: [MAIL, { ...MAIL, id: 'app-2', name: 'VMs', url: '{vmUrl}/views/{playerViewId}' }] },
    { label: 'the MSEL is deployed', mselExtra: { ...CASTER_READY, status: MselItemStatus.Deployed }, apps: [MAIL] },
    { label: 'Caster is not used', mselExtra: { usePlayer: true, status: MselItemStatus.Pending }, apps: [MAIL] },
  ])('gives no VM UI warning when $label', async ({ mselExtra, apps }) => {
    await renderAppList({ permissions: [SystemPermission.EditMsels], mselExtra, apps });

    expect(screen.getByText('Mail')).toBeInTheDocument();
    expect(screen.queryByText(/No Player application opens the VM UI/)).not.toBeInTheDocument();
  });

  /**
   * Verifies: the table has Icon, Embeddable and Load in Background columns after the URL, and the two flag headers explain themselves in their tooltips.
   * Interacts with: displayedColumns, matTooltip (accessible description, set in a microtask).
   * Data: EditMsels; application Mail.
   */
  it('describes the Icon, Embeddable and Load in Background columns', async () => {
    const { fixture } = await renderAppList({ permissions: [SystemPermission.EditMsels] });
    await fixture.whenStable();
    fixture.detectChanges();

    const headers = within(table()).getAllByRole('columnheader');
    expect(headers.map((th) => th.textContent.trim())).toEqual(['', 'Name', 'URL', 'Icon', 'Embeddable', 'Load in Background']);
    expect(headers[4]).toHaveAccessibleDescription('Player shows the application inside the view instead of opening it in a new tab');
    expect(headers[5]).toHaveAccessibleDescription('Player loads the application when the view opens, before a participant selects it');
  });

  /**
   * Verifies: a team added to the team store (on the Teams tab) reaches the open application's team selection.
   * Interacts with: real TeamStore and TeamQuery, AppTeamsStub mselTeamList input.
   * Data: EditMsels; application Mail expanded; Green Team added to the store after BLUE; the MSEL's own teams list holds only BLUE.
   */
  it('passes a newly added team to the application team selection', async () => {
    const { fixture, user } = await renderAppList({ permissions: [SystemPermission.EditMsels] });
    await user.click(within(table()).getByText('Mail'));
    const green: Team = { id: 'team-3', mselId: 'msel-1', name: 'Green Team', shortName: 'GREEN' };

    TestBed.inject(TeamStore).add(green);
    fixture.detectChanges();

    const teams = fixture.debugElement.query(By.directive(AppTeamsStub)).componentInstance as AppTeamsStub;
    expect(teams.mselTeamList).toEqual([BLUE, green]);
  });
});
