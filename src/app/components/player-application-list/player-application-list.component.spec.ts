// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, EventEmitter, input } from '@angular/core';
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
import { PlayerApplicationEditDialogComponent } from '../player-application-edit-dialog/player-application-edit-dialog.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { permissionApiStubs } from 'src/app/test-utils/mock-permission-data.service';
import { PlayerApplicationTeamsComponent } from '../player-application-teams/player-application-teams.component';
import { PlayerTeamAppOrderComponent } from '../player-team-app-order/player-team-app-order.component';

@Component({ selector: 'app-player-application-teams', template: '' })
class AppTeamsStub {
  readonly loggedInUserId = input<string>(undefined);
  readonly playerApplicationId = input<string>(undefined);
  readonly mselTeamList = input<Team[]>(undefined);
}
@Component({ selector: 'app-player-team-app-order', template: '' })
class AppOrderStub {
  readonly loggedInUserId = input<string>(undefined);
  readonly canEdit = input<boolean>(undefined);
  readonly mselTeamList = input<Team[]>(undefined);
}

const ME = 'user-me';
const BLUE: Team = { id: 'team-1', mselId: 'msel-1', name: 'Blue Team', shortName: 'BLUE' };
const MAIL: PlayerApplication = { id: 'app-1', mselId: 'msel-1', name: 'Mail', url: 'https://mail.example.com' };
// Blueprint's own templates: no MSEL, the template flag set.
const VMS: PlayerApplication = {
  id: 'tpl-vms', mselId: null, isTemplate: true, name: 'Virtual Machines', url: 'http://vm.example/views/{playerViewId}?{theme}',
  icon: 'mdi-monitor', embeddable: true, loadInBackground: true,
};
const MAP: PlayerApplication = { id: 'tpl-map', mselId: null, isTemplate: true, name: 'Map', url: 'http://vm.example/views/{playerViewId}/map' };
// Player's templates, offered as the second source.
const WIKI: ApplicationTemplate = { id: 't-1', name: 'Wiki', url: 'https://wiki.example.com', icon: 'assets/wiki.png', embeddable: false, loadInBackground: false };
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
  overrides: {
    permissions?: SystemPermission[];
    roles?: MselRole[];
    apps?: PlayerApplication[];
    templates?: PlayerApplication[];
    playerTemplates?: ApplicationTemplate[];
    mselExtra?: Partial<Msel>;
    showTemplates?: boolean;
    canEdit?: boolean;
  } = {},
) {
  const {
    permissions = [], roles = [], apps = [MAIL], templates = [], playerTemplates = [WIKI], mselExtra = {},
    showTemplates = false, canEdit = false,
  } = overrides;
  const appApi = {
    getApplicationsByMsel: vi.fn(() => of(structuredClone(apps))),
    getPlayerApplicationTemplates: vi.fn(() => of(structuredClone(templates))),
    createPlayerApplication: vi.fn((pa: PlayerApplication) => of(structuredClone(pa))),
    deletePlayerApplication: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<PlayerApplicationService>;
  const appTeamApi = {
    getMselPlayerApplicationTeams: vi.fn(() => of<PlayerApplicationTeam[]>([])),
  } satisfies ApiStub<PlayerApplicationTeamService>;
  const playerApi = {
    getApplicationTemplates: vi.fn(() => of<ApplicationTemplate[]>(structuredClone(playerTemplates))),
  } satisfies ApiStub<PlayerService>;
  // The user confirms every dialog.
  const confirm = vi.fn(() => dialogRefStub<unknown, boolean>(true).dialogRef);
  const dialog = { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>;
  // PlayerApplicationListComponent loads the permissions itself in ngOnInit,
  // so the real service is provided over the stubbed endpoint, without priming it.
  const permissionApis = permissionApiStubs({ system: permissions });
  // Add and edit open PlayerApplicationEditDialogComponent and subscribe to its editComplete;
  // a test emits on it to save.
  const editComplete = new EventEmitter<unknown>();
  const editRef = Object.assign(dialogRefStub<PlayerApplicationEditDialogComponent>().dialogRef, {
    componentInstance: { editComplete },
  });
  const open = vi.fn().mockReturnValue(editRef);
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
      { provide: MatDialog, useValue: { open } satisfies Pick<MatDialog, 'open'> },
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
    inputs: showTemplates ? { loggedInUserId: ME, showTemplates, canEdit } : { loggedInUserId: ME },
  });
  const user = userEvent.setup();
  // The MSEL tab folds the table into an expansion panel; the admin page shows it directly.
  if (!showTemplates) {
    await user.click(screen.getByRole('heading', { name: 'Player Applications' }));
  }
  return { ...rendered, appApi, appTeamApi, playerApi, confirm, open, editComplete, user };
}

// The values a dialog opened to add from a template is handed, and the create carries.
const copyOf = (t: PlayerApplication | ApplicationTemplate, mselId: string | null, isTemplate: boolean): PlayerApplication => ({
  mselId, isTemplate, name: t.name, url: t.url, icon: t.icon, embeddable: t.embeddable, loadInBackground: t.loadInBackground,
});
const menuItems = () => screen.getAllByRole('menuitem').map((item) => item.textContent.trim());

const table = () => screen.getByRole('table');
const ACTIONS = ['Add Player Application', 'Edit Mail', 'Delete Mail'];
const orderStub = (fixture: ComponentFixture<unknown>): AppOrderStub =>
  fixture.debugElement.query(By.directive(AppOrderStub)).componentInstance;

describe('PlayerApplicationListComponent', () => {
  /**
   * Verifies: the active MSEL's applications, application teams, Blueprint's templates and the Player templates are loaded.
   * Interacts with: PlayerApplicationService, PlayerApplicationTeamService and PlayerService (stubs), real data services.
   * Data: MSEL msel-1 with application Mail.
   */
  it('loads the MSEL applications', async () => {
    const { appApi, appTeamApi, playerApi } = await renderAppList({ permissions: [SystemPermission.EditMsels] });

    expect(appApi.getApplicationsByMsel).toHaveBeenCalledWith('msel-1');
    expect(appApi.getPlayerApplicationTemplates).toHaveBeenCalledTimes(1);
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
    expect(orderStub(fixture).canEdit()).toBe(true);
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
    expect(orderStub(fixture).canEdit()).toBe(false);
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
    expect(teams.playerApplicationId()).toBe('app-1');
    expect(teams.mselTeamList()).toEqual([BLUE]);
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
    expect(teams.mselTeamList()).toEqual([BLUE, green]);
  });
  describe('templates in the Add menu', () => {
    /**
     * Verifies: the Add menu offers New Player Application, then Blueprint's templates by name, then Player's templates in a From Player group.
     * Interacts with: PlayerApplicationService.getPlayerApplicationTemplates and PlayerService.getApplicationTemplates (stubs), the Add menu.
     * Data: EditMsels; Blueprint templates Virtual Machines and Map; Player template Wiki.
     */
    it("lists Blueprint's templates first, then Player's under From Player", async () => {
      const { user } = await renderAppList({ permissions: [SystemPermission.EditMsels], templates: [VMS, MAP] });

      await user.click(within(table()).getByRole('button', { name: 'Add Player Application' }));

      expect(menuItems()).toEqual(['New Player Application', 'Map', 'Virtual Machines', 'Wiki']);
      const fromPlayer = screen.getByRole('group', { name: 'From Player' });
      expect(within(fromPlayer).getAllByRole('menuitem').map((item) => item.textContent.trim())).toEqual(['Wiki']);
    });

    /**
     * Verifies: without Player templates there is no From Player group, and Blueprint's templates are still offered.
     * Interacts with: PlayerService.getApplicationTemplates (stub, empty), the Add menu.
     * Data: EditMsels; Blueprint template Map; no Player templates.
     */
    it('leaves out the From Player group when Player has no templates', async () => {
      const { user } = await renderAppList({ permissions: [SystemPermission.EditMsels], templates: [MAP], playerTemplates: [] });

      await user.click(within(table()).getByRole('button', { name: 'Add Player Application' }));

      expect(menuItems()).toEqual(['New Player Application', 'Map']);
      expect(screen.queryByText('From Player')).not.toBeInTheDocument();
    });

    /**
     * Verifies: the menu tracks each template by its own id, so templates that share a name raise no duplicate-key (NG0955) warning.
     * Interacts with: the @for track expressions of the Add menu, console.warn and console.error (spies).
     * Data: EditMsels; two Blueprint templates named Map; two Player templates named Wiki.
     */
    it('tracks the templates by their ids without an NG0955 warning', async () => {
      const warn = vi.spyOn(console, 'warn');
      const error = vi.spyOn(console, 'error');
      const { user } = await renderAppList({
        permissions: [SystemPermission.EditMsels],
        templates: [MAP, { ...MAP, id: 'tpl-map-2' }],
        playerTemplates: [WIKI, { ...WIKI, id: 't-2' }],
      });

      await user.click(within(table()).getByRole('button', { name: 'Add Player Application' }));

      expect(menuItems()).toEqual(['New Player Application', 'Map', 'Map', 'Wiki', 'Wiki']);
      const logged = [...warn.mock.calls, ...error.mock.calls].map((call) => String(call[0]));
      expect(logged.filter((message) => message.includes('NG0955'))).toEqual([]);
    });

    /**
     * Verifies: the MSEL's table lists its own applications, never the templates held in the same store.
     * Interacts with: real PlayerApplicationStore (templates upserted beside the MSEL's applications).
     * Data: EditMsels; application Mail; Blueprint templates Virtual Machines and Map.
     */
    it("keeps the templates out of the MSEL's table", async () => {
      await renderAppList({ permissions: [SystemPermission.EditMsels], templates: [VMS, MAP] });

      expect(within(table()).getByText('Mail')).toBeInTheDocument();
      expect(within(table()).queryByText('Virtual Machines')).not.toBeInTheDocument();
      expect(within(table()).queryByText('Map')).not.toBeInTheDocument();
    });

    /**
     * Verifies: choosing a Blueprint template opens the add dialog with a copy of its values for this MSEL, and saving creates a new application with its own id, leaving the template alone.
     * Interacts with: the Add menu, MatDialog.open (stub), editComplete, PlayerApplicationService.createPlayerApplication (stub).
     * Data: EditMsels; Blueprint template Virtual Machines (icon, embeddable, loads in background).
     */
    it('adds a copy of a Blueprint template to the MSEL', async () => {
      const { fixture, user, open, editComplete, appApi } = await renderAppList({ permissions: [SystemPermission.EditMsels], templates: [VMS] });

      await user.click(within(table()).getByRole('button', { name: 'Add Player Application' }));
      await user.click(screen.getByRole('menuitem', { name: 'Virtual Machines' }));

      expect(open).toHaveBeenCalledTimes(1);
      expect(open.mock.calls[0][1].data).toEqual(expect.objectContaining({
        title: 'Add a Player Application',
        playerApplication: copyOf(VMS, 'msel-1', false),
      }));
      editComplete.emit({ saveChanges: true, playerApplication: open.mock.calls[0][1].data.playerApplication });
      fixture.detectChanges();

      expect(appApi.createPlayerApplication).toHaveBeenCalledTimes(1);
      const created = appApi.createPlayerApplication.mock.calls[0][0];
      expect(created).toEqual(expect.objectContaining(copyOf(VMS, 'msel-1', false)));
      expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(created.id).not.toBe(VMS.id);
      expect(within(table()).getByText('Virtual Machines')).toBeInTheDocument();
    });

    /**
     * Verifies: choosing a Player template opens the add dialog with a copy of its values for this MSEL, without Player's id.
     * Interacts with: the From Player group of the Add menu, MatDialog.open (stub).
     * Data: EditMsels; Player template Wiki (id t-1).
     */
    it("adds a copy of one of Player's templates to the MSEL", async () => {
      const { user, open } = await renderAppList({ permissions: [SystemPermission.EditMsels] });

      await user.click(within(table()).getByRole('button', { name: 'Add Player Application' }));
      await user.click(screen.getByRole('menuitem', { name: 'Wiki' }));

      expect(open.mock.calls[0][1].data.playerApplication).toEqual(copyOf(WIKI, 'msel-1', false));
    });

    /**
     * Verifies: with ManagePlayerApplications a MSEL's application can be made a template: the dialog gets a copy with no MSEL, and saving creates the template.
     * Interacts with: real PermissionDataService (stubbed grants), MatDialog.open (stub), editComplete, PlayerApplicationService.createPlayerApplication (stub).
     * Data: EditMsels and ManagePlayerApplications; application Mail.
     */
    it("makes a template of a MSEL's application with ManagePlayerApplications", async () => {
      const { fixture, user, open, editComplete, appApi } = await renderAppList({
        permissions: [SystemPermission.EditMsels, SystemPermission.ManagePlayerApplications],
      });

      await user.click(within(table()).getByRole('button', { name: 'Make Mail a template' }));

      expect(open.mock.calls[0][1].data).toEqual(expect.objectContaining({
        title: 'Add a Player Application Template',
        playerApplication: copyOf(MAIL, null, true),
      }));
      editComplete.emit({ saveChanges: true, playerApplication: open.mock.calls[0][1].data.playerApplication });
      fixture.detectChanges();
      expect(appApi.createPlayerApplication).toHaveBeenCalledWith(expect.objectContaining({ mselId: null, isTemplate: true, name: 'Mail' }));
      // the new template joins the Add menu, not the MSEL's table
      expect(within(table()).getAllByText('Mail')).toHaveLength(1);
    });

    /**
     * Verifies: without ManagePlayerApplications there is no Make template button.
     * Interacts with: real PermissionDataService (stubbed grants).
     * Data: every permission but ManagePlayerApplications (near miss: ManageCiteActions).
     */
    it('offers no Make template without ManagePlayerApplications', async () => {
      await renderAppList({ permissions: Object.values(SystemPermission).filter((p) => p !== SystemPermission.ManagePlayerApplications) });

      expect(within(table()).getByRole('button', { name: 'Edit Mail' })).toBeInTheDocument();
      expect(within(table()).queryByRole('button', { name: 'Make Mail a template' })).not.toBeInTheDocument();
    });
  });

  describe('templates (admin)', () => {
    const TEMPLATE_HEADER = [
      'Add a template Player Application',
      'Upload Player Application templates from JSON',
      'Download Player Application templates as JSON',
    ];

    /**
     * Verifies: on the admin page the list shows Blueprint's templates alone, with add, upload, download, edit and delete for canEdit, and loads neither a MSEL nor Player's templates.
     * Interacts with: PlayerApplicationService.getPlayerApplicationTemplates (stub), real PlayerApplicationDataService and Query.
     * Data: showTemplates true; canEdit true; templates Virtual Machines and Map.
     */
    it('lists the templates with their actions for canEdit', async () => {
      const { appApi, appTeamApi, playerApi } = await renderAppList({ showTemplates: true, canEdit: true, templates: [VMS, MAP] });

      expect(appApi.getPlayerApplicationTemplates).toHaveBeenCalledTimes(1);
      expect(appApi.getApplicationsByMsel).not.toHaveBeenCalled();
      expect(appTeamApi.getMselPlayerApplicationTeams).not.toHaveBeenCalled();
      expect(playerApi.getApplicationTemplates).not.toHaveBeenCalled();
      expect(screen.queryByRole('heading', { name: 'Team Application Order' })).not.toBeInTheDocument();
      for (const title of TEMPLATE_HEADER) {
        expect(within(table()).getByTitle(title)).toBeInTheDocument();
      }
      for (const name of ['Edit Virtual Machines', 'Delete Virtual Machines', 'Edit Map', 'Delete Map']) {
        expect(within(table()).getByRole('button', { name })).toBeInTheDocument();
      }
      expect(within(table()).queryByRole('button', { name: 'Add Player Application' })).not.toBeInTheDocument();
      expect(within(table()).queryByRole('button', { name: /^Make / })).not.toBeInTheDocument();
    });

    /**
     * Verifies: without canEdit the template list is read-only, even with EditMsels.
     * Interacts with: the canEdit input, real PermissionDataService (stubbed grants).
     * Data: showTemplates true; canEdit false; EditMsels; template Map.
     */
    it('lists the templates read-only without canEdit', async () => {
      await renderAppList({ showTemplates: true, canEdit: false, templates: [MAP], permissions: [SystemPermission.EditMsels] });

      expect(within(table()).getByText('Map')).toBeInTheDocument();
      for (const title of TEMPLATE_HEADER) {
        expect(within(table()).queryByTitle(title)).not.toBeInTheDocument();
      }
      expect(within(table()).queryByRole('button', { name: 'Edit Map' })).not.toBeInTheDocument();
      expect(within(table()).queryByRole('button', { name: 'Delete Map' })).not.toBeInTheDocument();
    });

    /**
     * Verifies: adding a template opens the dialog for an application with no MSEL and the template flag, and saving creates it.
     * Interacts with: MatDialog.open (stub), editComplete, PlayerApplicationService.createPlayerApplication (stub).
     * Data: showTemplates true; canEdit true; no templates; the user names it Gallery.
     */
    it('adds a template', async () => {
      const { fixture, user, open, editComplete, appApi } = await renderAppList({ showTemplates: true, canEdit: true });

      await user.click(within(table()).getByTitle('Add a template Player Application'));

      const data = open.mock.calls[0][1].data;
      expect(data.title).toBe('Add a Player Application Template');
      expect(data.playerApplication).toEqual(expect.objectContaining({ mselId: null, isTemplate: true }));
      editComplete.emit({ saveChanges: true, playerApplication: { ...data.playerApplication, name: 'Gallery', url: 'http://gallery.example' } });
      fixture.detectChanges();

      expect(appApi.createPlayerApplication).toHaveBeenCalledWith(expect.objectContaining({ mselId: null, isTemplate: true, name: 'Gallery' }));
      expect(within(table()).getByText('Gallery')).toBeInTheDocument();
    });

    /**
     * Verifies: a template row does not expand into a team selection, since a template is on no team.
     * Interacts with: row click, AppTeamsStub.
     * Data: showTemplates true; canEdit true; template Map.
     */
    it('does not expand a template into a team selection', async () => {
      const { fixture, user } = await renderAppList({ showTemplates: true, canEdit: true, templates: [MAP] });

      await user.click(within(table()).getByText('Map'));

      expect(fixture.debugElement.query(By.directive(AppTeamsStub))).toBeNull();
    });

    /**
     * Verifies: confirming Delete removes the template through the API and from the list, under a template title.
     * Interacts with: CrucibleDialogService.confirm (stub, confirms), PlayerApplicationService.deletePlayerApplication (stub).
     * Data: showTemplates true; canEdit true; template Map.
     */
    it('deletes a template after confirmation', async () => {
      const { appApi, confirm, user } = await renderAppList({ showTemplates: true, canEdit: true, templates: [MAP] });

      await user.click(within(table()).getByRole('button', { name: 'Delete Map' }));

      expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delete Player Application Template' }));
      expect(appApi.deletePlayerApplication).toHaveBeenCalledWith('tpl-map');
      expect(within(table()).queryByText('Map')).not.toBeInTheDocument();
    });
  });
});
