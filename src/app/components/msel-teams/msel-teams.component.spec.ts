// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, EventEmitter, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
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
import { Observable, of, Subject, throwError } from 'rxjs';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import {
  CasterService,
  CasterTeamVariable,
  CiteService,
  Msel,
  MselRole,
  SystemPermission,
  SystemPermissionsService,
  Team,
  TeamService,
  TeamType,
  Unit,
  UnitService,
} from 'src/app/generated/blueprint.api';
import { MselStore } from 'src/app/data/msel/msel.store';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { TeamQuery } from 'src/app/data/team/team.query';
import { TeamStore } from 'src/app/data/team/team.store';
import { TeamEditDialogComponent } from '../team-edit-dialog/team-edit-dialog.component';
import { MselTeamsComponent } from './msel-teams.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { permissionApiStubs } from 'src/app/test-utils/mock-permission-data.service';
import { unstubbed } from 'src/app/test-utils/unstubbed';
import { TeamUsersComponent } from '../team-users/team-users.component';

@Component({ selector: 'app-team-users', template: '' })
class TeamUsersStub {
  readonly team = input<Team>(undefined);
}

const ME = 'user-me';
const BLUE: Team = { id: 'team-1', mselId: 'msel-1', name: 'Blue Team', shortName: 'BLUE', email: 'blue@example.com', citeTeamTypeId: 'tt-1', canTeamMemberInvite: true };
const ALL_BUT_MANAGE_MSELS = Object.values(SystemPermission).filter((p) => p !== SystemPermission.ManageMsels);

// A MSEL that deploys its topology from Caster directory dir-1.
const CASTER: Partial<Msel> = { usePlayer: true, useCaster: true, casterDirectoryId: 'dir-1' };
const team = (name: string, casterTeamVariable?: string, id = `team-${name}`): Team => ({
  id,
  mselId: 'msel-1',
  name,
  shortName: `S-${name}`,
  ...(casterTeamVariable ? { casterTeamVariable } : {}),
});

function msel(roles: MselRole[] = [], extra: Partial<Msel> = {}): Msel {
  return {
    id: 'msel-1',
    name: 'Exercise Alpha',
    createdBy: 'someone-else',
    userMselRoles: roles.map((role, i) => ({ id: `umr-${i}`, userId: ME, mselId: 'msel-1', role })),
    ...extra,
  };
}

async function renderMselTeams(
  overrides: {
    permissions?: SystemPermission[];
    roles?: MselRole[];
    mselExtra?: Partial<Msel>;
    teams?: Team[];
    teamVariables?: (id: string) => Observable<CasterTeamVariable[]>;
    dialogOpen?: Pick<MatDialog, 'open'>['open'];
  } = {},
) {
  const {
    permissions = [],
    roles = [],
    mselExtra = {},
    teams = [BLUE],
    teamVariables = () => of<CasterTeamVariable[]>([]),
    dialogOpen,
  } = overrides;
  const citeApi = {
    getTeamTypes: vi.fn(() => of<TeamType[]>([{ id: 'tt-1', name: 'Agency' }])),
  } satisfies ApiStub<CiteService>;
  const casterApi = {
    getCasterTeamVariables: vi.fn((id: string) => teamVariables(id)),
  } satisfies ApiStub<CasterService>;
  const teamApi = {
    deleteTeam: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<TeamService>;
  // Opening the Add menu reloads the units for "Add team from unit".
  const unitApi = {
    getUnits: vi.fn(() => of<Unit[]>([])),
  } satisfies ApiStub<UnitService>;
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
    childStubs: [
      { replace: TeamUsersComponent, with: TeamUsersStub },
    ],
    providers: [
      { provide: SystemPermissionsService, useValue: permissionApis.systemPermissions },
      PermissionDataService,
      { provide: CiteService, useValue: citeApi },
      { provide: CasterService, useValue: casterApi },
      { provide: TeamService, useValue: teamApi },
      { provide: UnitService, useValue: unitApi },
      { provide: CrucibleDialogService, useValue: dialog },
      dialogOpen ? { provide: MatDialog, useValue: { open: dialogOpen } satisfies Pick<MatDialog, 'open'> } : unstubbed(MatDialog),
      // The MSEL page loads the MSEL and its teams; the stores are seeded instead.
      {
        provide: MselStore,
        useFactory: () => {
          const store = new MselStore();
          store.set([msel(roles, mselExtra)]);
          store.setActive('msel-1');
          return store;
        },
      },
      {
        provide: TeamStore,
        useFactory: () => {
          const store = new TeamStore();
          store.set(structuredClone(teams));
          return store;
        },
      },
    ],
    inputs: { loggedInUserId: ME },
  });
  return { ...rendered, teamApi, casterApi, confirm };
}

const table = () => screen.getByRole('table');
const headers = () => within(table()).getAllByRole('columnheader').map((th) => th.textContent.trim());
const rowOf = (name: string) => within(within(table()).getByText(name, { selector: 'td' }).closest('tr') as HTMLElement);
const cellOf = (name: string, header: string) => rowOf(name).getAllByRole('cell')[headers().indexOf(header)].textContent.replace(/\s+/g, ' ').trim();
const warnings = () => screen.queryAllByText(/Topology team|topology team|Push will be refused|Topology teams:/).map((el) => el.textContent.replace(/\s+/g, ' ').trim());
const ACTIONS = ['Add a team', 'Edit Blue Team', 'Delete team'];

describe('MselTeamsComponent', () => {
  /**
   * Verifies: the MSEL's teams are listed with email, CITE team type and the open-invite flag (read-only).
   * Interacts with: real TeamQuery and MselQuery (seeded), CiteService.getTeamTypes (stub).
   * Data: a MSEL using CITE; BLUE, an Agency team whose members can invite.
   */
  it('lists the MSEL teams', async () => {
    await renderMselTeams({ permissions: [SystemPermission.ManageMsels], mselExtra: { useCite: true } });

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
    expect(users.team()).toEqual(BLUE);
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

  /**
   * Verifies: the Team Type column (the CITE team type) is shown only for a MSEL that uses CITE.
   * Interacts with: setDisplayedColumns, real MselQuery (seeded).
   * Data: ManageMsels; BLUE, an Agency team; a MSEL using CITE, and one that does not.
   */
  it.each([
    { label: 'shows', useCite: true },
    { label: 'hides', useCite: false },
  ])('$label the Team Type column by CITE use', async ({ useCite }) => {
    await renderMselTeams({ permissions: [SystemPermission.ManageMsels], mselExtra: { useCite } });

    expect(headers()).toEqual(
      useCite
        ? ['', 'Short Name', 'Name', 'Email', 'Team Type', 'Open Invite']
        : ['', 'Short Name', 'Name', 'Email', 'Open Invite'],
    );
    expect(within(table()).queryByText('Agency') !== null).toBe(useCite);
  });

  describe('topology teams', () => {
    /**
     * Verifies: for a MSEL deploying from a Caster directory, the directory's team variables are loaded and a Topology Team column before Open Invite shows the variable each team writes: its mapping, or its name turned into a variable.
     * Interacts with: CasterService.getCasterTeamVariables (stub), getTeamVariable, setDisplayedColumns.
     * Data: Caster directory dir-1 declaring blue_team, red_cell, _1st_cell, équipe_été and red__blue_hq; teams Blue Team, Gold Team mapped to red_cell, 1st Cell, "Équipe Été", "Red & Blue (HQ)" and "???".
     */
    it('shows the variable each team writes', async () => {
      const variables = ['blue_team', 'red_cell', '_1st_cell', 'équipe_été', 'red__blue_hq'].map((name) => ({ name }));
      const { casterApi } = await renderMselTeams({
        permissions: [SystemPermission.ManageMsels],
        mselExtra: CASTER,
        teams: [team('Blue Team'), team('Gold Team', 'red_cell'), team('1st Cell'), team('Équipe Été'), team('Red & Blue (HQ)'), team('???')],
        teamVariables: () => of(variables),
      });

      expect(casterApi.getCasterTeamVariables).toHaveBeenCalledWith('dir-1');
      expect(headers()).toEqual(['', 'Short Name', 'Name', 'Email', 'Topology Team', 'Open Invite']);
      expect(cellOf('Blue Team', 'Topology Team')).toBe('blue_team');
      expect(cellOf('Gold Team', 'Topology Team')).toBe('red_cell');
      expect(cellOf('1st Cell', 'Topology Team')).toBe('_1st_cell');
      expect(cellOf('Équipe Été', 'Topology Team')).toBe('équipe_été');
      expect(cellOf('Red & Blue (HQ)', 'Topology Team')).toBe('red__blue_hq');
      expect(cellOf('???', 'Topology Team')).toBe('(not in template)');
    });

    /**
     * Verifies: without Caster, or without a Caster directory, no team variables are requested and there is no Topology Team column or topology warning.
     * Interacts with: loadCasterTeamVariables, setDisplayedColumns.
     * Data: ManageMsels; Caster off with directory dir-1; Caster on with no directory; two teams mapped to the same variable.
     */
    it.each([
      { label: 'without Caster', mselExtra: { ...CASTER, useCaster: false } },
      { label: 'without a Caster directory', mselExtra: { ...CASTER, casterDirectoryId: null } },
    ])('has no topology teams $label', async ({ mselExtra }) => {
      const { casterApi } = await renderMselTeams({
        permissions: [SystemPermission.ManageMsels],
        mselExtra,
        teams: [team('Blue Team', 'blue_cell'), team('Cyan Team', 'blue_cell')],
      });

      expect(casterApi.getCasterTeamVariables).not.toHaveBeenCalled();
      expect(headers()).not.toContain('Topology Team');
      expect(warnings()).toEqual([]);
    });

    /**
     * Verifies: a team whose name-derived variable is not in the template is marked "(not in template)", and an unmapped team whose variable another team is mapped to is marked as replaced by that team.
     * Interacts with: getMappedOverTeam, the topologyTeam cell template.
     * Data: template declares red_team only; teams Blue Team (unmapped, not in the template), Red Team (unmapped) and Crimson (mapped to red_team).
     */
    it('marks teams outside the template and teams replaced by a mapping', async () => {
      await renderMselTeams({
        permissions: [SystemPermission.ManageMsels],
        mselExtra: CASTER,
        teams: [team('Blue Team'), team('Red Team'), team('Crimson', 'red_team')],
        teamVariables: () => of([{ name: 'red_team' }]),
      });

      expect(cellOf('Blue Team', 'Topology Team')).toBe('blue_team (not in template)');
      expect(cellOf('Red Team', 'Topology Team')).toBe('red_team (replaced by Crimson)');
      expect(cellOf('Crimson', 'Topology Team')).toBe('red_team');
      expect(warnings()).toEqual([]);
    });

    /**
     * Verifies: template variables no MSEL team writes are warned about when they are "admin" (Player's own Admin team gets the VMs) or required (the plan fails), but not when optional; a mapping the template no longer declares is warned about.
     * Interacts with: getUnmappedTopologyTeams, getUnmappedTopologyTeamDestination, getStaleMappings.
     * Data: template declares admin, red_cell (required), green_cell (optional) and blue_team; teams Blue Team (unmapped) and Gold Team mapped to old_cell.
     */
    it('warns about unmapped required topology teams and stale mappings', async () => {
      await renderMselTeams({
        permissions: [SystemPermission.ManageMsels],
        mselExtra: CASTER,
        teams: [team('Blue Team'), team('Gold Team', 'old_cell')],
        teamVariables: () => of([{ name: 'admin' }, { name: 'red_cell', required: true }, { name: 'green_cell', required: false }, { name: 'blue_team' }]),
      });

      expect(warnings()).toEqual([
        "Topology team \"admin\" has no MSEL team. Its VMs will go to the Player view's own Admin team.",
        'Topology team "red_cell" has no MSEL team. The Caster template gives it no default, so the plan will fail unless Caster supplies it.',
        'Gold Team is mapped to topology team "old_cell", which the Caster template no longer declares.',
      ]);
    });

    /**
     * Verifies: variables more than one team would write are warned about, counting Player's own Admin team for "admin", while a mapped team replacing an unmapped one is not a conflict.
     * Interacts with: getDuplicateTeamVariableWarnings, resolveTeamVariables.
     * Data: template declares blue_cell, admin and red_team; Blue Team, Cyan Team and Teal Team mapped to blue_cell; "Admin!" unmapped (its name gives admin, but it is not named Admin); Red Team unmapped and Crimson mapped to red_team.
     */
    it('warns about variables several teams would write', async () => {
      await renderMselTeams({
        permissions: [SystemPermission.ManageMsels],
        mselExtra: CASTER,
        teams: [
          team('Blue Team', 'blue_cell'),
          team('Cyan Team', 'blue_cell'),
          team('Teal Team', 'blue_cell'),
          team('Admin!'),
          team('Red Team'),
          team('Crimson', 'red_team'),
        ],
        teamVariables: () => of([{ name: 'blue_cell' }, { name: 'admin' }, { name: 'red_team' }]),
      });

      expect(warnings()).toEqual([
        "\"Admin!\" and Player's Admin team all become \"admin\", so Push will be refused. Rename one or map it to a different topology team.",
        '"Blue Team", "Cyan Team" and "Teal Team" all become "blue_cell", so Push will be refused. Rename one or map it to a different topology team.',
      ]);
      expect(cellOf('Admin!', 'Topology Team')).toBe('admin');
    });

    /**
     * Verifies: a MSEL team named Admin, or a team mapped to "admin", takes the place of Player's own Admin team, so "admin" is neither a conflict nor unmapped.
     * Interacts with: getDuplicateTeamVariableWarnings, getUnmappedTopologyTeams, resolveTeamVariables.
     * Data: template declares admin; a team named Admin (unmapped), or Gold Team mapped to admin.
     */
    it.each([
      { label: 'a MSEL team named Admin', teams: [team('Admin')], name: 'Admin' },
      { label: 'a team mapped to admin', teams: [team('Gold Team', 'admin')], name: 'Gold Team' },
    ])("lets $label take the place of Player's Admin team", async ({ teams, name }) => {
      await renderMselTeams({
        permissions: [SystemPermission.ManageMsels],
        mselExtra: CASTER,
        teams,
        teamVariables: () => of([{ name: 'admin' }]),
      });

      expect(cellOf(name, 'Topology Team')).toBe('admin');
      expect(warnings()).toEqual([]);
    });

    /**
     * Verifies: when the team variables cannot be read, the API's problem title (or a fallback) is shown and logged, the Topology Team column still shows, and duplicate mappings are still warned about.
     * Interacts with: CasterService.getCasterTeamVariables (fails), console.error (spied).
     * Data: a 403 whose problem title is "Caster scope missing", and an error without a title; Blue Team and Cyan Team both mapped to blue_cell.
     */
    it.each([
      { label: 'the problem title', error: { status: 403, error: { title: 'Caster scope missing' } }, message: 'Caster scope missing' },
      { label: 'a fallback', error: new Error('network down'), message: 'The Caster template could not be read.' },
    ])('reports a failed team variable load with $label', async ({ error, message }) => {
      const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
      await renderMselTeams({
        permissions: [SystemPermission.ManageMsels],
        mselExtra: CASTER,
        teams: [team('Blue Team', 'blue_cell'), team('Cyan Team', 'blue_cell')],
        teamVariables: () => throwError(() => error),
      });

      expect(logged.mock.calls).toEqual([['Failed to load the Caster team variables:', error]]);
      expect(warnings()).toEqual([
        `Topology teams: ${message}`,
        '"Blue Team" and "Cyan Team" all become "blue_cell", so Push will be refused. Rename one or map it to a different topology team.',
      ]);
      expect(headers()).toContain('Topology Team');
      expect(cellOf('Blue Team', 'Topology Team')).toBe('blue_cell');
    });

    /**
     * Verifies: choosing another directory on the Info tab reloads the variables for it and ignores a late answer for the old one; turning Caster off drops the column and the warnings.
     * Interacts with: the active-MSEL subscription, loadCasterTeamVariables, real MselStore (updated by the test).
     * Data: dir-1 answers late with required stale_req; dir-2 declares required fresh_req; Blue Team unmapped.
     */
    it('follows the Caster directory chosen on the Info tab', async () => {
      const answers: Record<string, Subject<CasterTeamVariable[]>> = { 'dir-1': new Subject(), 'dir-2': new Subject() };
      const { fixture, casterApi } = await renderMselTeams({
        permissions: [SystemPermission.ManageMsels],
        mselExtra: CASTER,
        teams: [team('Blue Team')],
        teamVariables: (id) => answers[id],
      });
      const store = TestBed.inject(MselStore);

      store.update('msel-1', { casterDirectoryId: 'dir-2' });
      answers['dir-2'].next([{ name: 'fresh_req', required: true }]);
      answers['dir-1'].next([{ name: 'stale_req', required: true }]);
      fixture.detectChanges();

      expect(casterApi.getCasterTeamVariables.mock.calls).toEqual([['dir-1'], ['dir-2']]);
      expect(warnings()).toEqual([
        'Topology team "fresh_req" has no MSEL team. The Caster template gives it no default, so the plan will fail unless Caster supplies it.',
      ]);
      expect(cellOf('Blue Team', 'Topology Team')).toBe('blue_team (not in template)');

      store.update('msel-1', { useCaster: false });
      fixture.detectChanges();

      expect(headers()).not.toContain('Topology Team');
      expect(warnings()).toEqual([]);
      expect(casterApi.getCasterTeamVariables).toHaveBeenCalledTimes(2);
    });

    /**
     * Verifies: editing a team opens the team dialog with a copy of the team (not the store's entity), the template's variables, and the variables the other teams write (mapped teams replacing unmapped ones).
     * Interacts with: MatDialog.open (stub), the Edit button, getTeamVariableUsers.
     * Data: ManageMsels; template declares blue_cell and red_team; Blue Team and Cyan Team mapped to blue_cell, Red Team unmapped, Crimson mapped to red_team.
     */
    it('passes the topology teams to the team dialog', async () => {
      const editComplete = new EventEmitter<unknown>();
      const { dialogRef } = dialogRefStub<TeamEditDialogComponent>();
      dialogRef.componentInstance = { editComplete } as Pick<TeamEditDialogComponent, 'editComplete'> as TeamEditDialogComponent;
      const open = vi.fn(() => dialogRef);
      const teams = [team('Blue Team', 'blue_cell'), team('Cyan Team', 'blue_cell'), team('Red Team'), team('Crimson', 'red_team')];
      await renderMselTeams({
        permissions: [SystemPermission.ManageMsels],
        mselExtra: CASTER,
        teams,
        teamVariables: () => of([{ name: 'blue_cell' }, { name: 'red_team' }]),
        dialogOpen: open,
      });
      const user = userEvent.setup();

      await user.click(within(table()).getByRole('button', { name: 'Edit Blue Team' }));

      expect(open).toHaveBeenCalledTimes(1);
      const [component, config] = open.mock.calls[0] as unknown as [unknown, { data: Record<string, unknown> }];
      expect(component).toBe(TeamEditDialogComponent);
      expect(config.data).toEqual({
        team: teams[0],
        useCite: undefined,
        teamTypeList: [{ id: 'tt-1', name: 'Agency' }],
        casterTeamVariables: ['blue_cell', 'red_team'],
        casterTeamVariableUsers: { blue_cell: ['Cyan Team'], red_team: ['Crimson'] },
      });
      const stored = TestBed.inject(TeamQuery).getEntity(teams[0].id);
      expect(stored).toEqual(teams[0]);
      expect(config.data['team']).not.toBe(stored);
    });

    /**
     * Verifies: adding a team opens the team dialog with a new team of this MSEL, the template's variables, and the variables every MSEL team writes (mapped teams replacing unmapped ones).
     * Interacts with: the Add a team menu (New Team), MatDialog.open (stub), getTeamVariableUsers (a team with no id), UnitService.getUnits (stub, menu opened).
     * Data: ManageMsels; template declares blue_cell and red_team; Blue Team and Cyan Team mapped to blue_cell, Red Team unmapped, Crimson mapped to red_team.
     */
    it('passes the topology teams to the dialog for a new team', async () => {
      const editComplete = new EventEmitter<unknown>();
      const { dialogRef } = dialogRefStub<TeamEditDialogComponent>();
      dialogRef.componentInstance = { editComplete } as Pick<TeamEditDialogComponent, 'editComplete'> as TeamEditDialogComponent;
      const open = vi.fn(() => dialogRef);
      await renderMselTeams({
        permissions: [SystemPermission.ManageMsels],
        mselExtra: CASTER,
        teams: [team('Blue Team', 'blue_cell'), team('Cyan Team', 'blue_cell'), team('Red Team'), team('Crimson', 'red_team')],
        teamVariables: () => of([{ name: 'blue_cell' }, { name: 'red_team' }]),
        dialogOpen: open,
      });
      const user = userEvent.setup();

      await user.click(within(table()).getByRole('button', { name: 'Add a team' }));
      await user.click(await screen.findByRole('menuitem', { name: 'New Team' }));

      expect(open).toHaveBeenCalledTimes(1);
      const [component, config] = open.mock.calls[0] as unknown as [unknown, { data: Record<string, unknown> }];
      expect(component).toBe(TeamEditDialogComponent);
      expect(config.data).toEqual({
        team: { name: '', shortName: '', description: '', mselId: 'msel-1' },
        useCite: undefined,
        teamTypeList: [{ id: 'tt-1', name: 'Agency' }],
        casterTeamVariables: ['blue_cell', 'red_team'],
        casterTeamVariableUsers: { blue_cell: ['Blue Team', 'Cyan Team'], red_team: ['Crimson'] },
      });
    });

    /**
     * Verifies: the Team Type, Topology Team and Open Invite headers explain themselves in their tooltips.
     * Interacts with: matTooltip (accessible description, set in a microtask).
     * Data: ManageMsels; a MSEL using CITE and Caster with directory dir-1.
     */
    it('describes the Team Type, Topology Team and Open Invite columns', async () => {
      const { fixture } = await renderMselTeams({ permissions: [SystemPermission.ManageMsels], mselExtra: { ...CASTER, useCite: true } });
      await fixture.whenStable();
      fixture.detectChanges();

      const header = (name: string) => within(table()).getAllByRole('columnheader').find((th) => th.textContent.trim() === name);
      expect(header('Team Type')).toHaveAccessibleDescription('The CITE team type this team is created with when the MSEL is pushed to CITE');
      expect(header('Topology Team')).toHaveAccessibleDescription("The Caster template variable this team's Player team ID is written to");
      expect(header('Open Invite')).toHaveAccessibleDescription('Any member of this team can invite others to it');
    });
  });
});
