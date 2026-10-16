// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Team, TeamService } from 'src/app/generated/blueprint.api';
import { TeamStore } from './team.store';
import { TeamDataService } from './team-data.service';
import { TeamQuery } from './team.query';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { activatedRouteStub } from 'src/app/test-utils/activated-route';
import { recordEmissions } from 'src/app/test-utils/record-emissions';
import { captureUnhandledRxErrors, flush } from 'src/app/test-utils/unhandled-rx-errors';

function team(overrides: Partial<Team> = {}): Team {
  return {
    id: 'team-red',
    name: 'Red Cell',
    shortName: 'RED',
    mselId: 'msel-1',
    ...overrides,
  };
}

function setup(queryParams: Record<string, string> = {}) {
  const teamApi = {
    getMyTeams: vi.fn(() => of<Team[]>([])),
    getTeam: vi.fn(() => of(team())),
    getTeamsByUser: vi.fn(() => of<Team[]>([])),
    getTeamsByMsel: vi.fn(() => of<Team[]>([])),
    createTeam: vi.fn(() => of(team())),
    createTeamFromUnit: vi.fn(() => of(team())),
    updateTeam: vi.fn(() => of(team())),
    deleteTeam: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<TeamService>;
  const navigate = vi.fn();
  const route = activatedRouteStub(queryParams);
  TestBed.configureTestingModule({
    providers: [
      { provide: TeamService, useValue: teamApi },
      { provide: Router, useValue: { navigate } satisfies Pick<Router, 'navigate'> },
      { provide: ActivatedRoute, useValue: route.route },
    ],
  });
  return {
    service: TestBed.inject(TeamDataService),
    query: TestBed.inject(TeamQuery),
    teamApi,
    navigate,
    route,
  };
}

const names = (teams: Team[]) => teams.map((t) => t.name);

describe('TeamDataService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: load, loadMine, loadByUserId and loadByMsel each replace the store with their endpoint's teams.
   * Interacts with: TeamService getMyTeams / getTeamsByUser / getTeamsByMsel (stubs), real TeamStore and TeamQuery.
   * Data: a different team from each endpoint.
   */
  it('each loader replaces the store with its endpoint\'s teams', () => {
    const { service, query, teamApi } = setup();
    teamApi.getMyTeams.mockReturnValueOnce(of([team({ name: 'Mine A' })]));
    teamApi.getMyTeams.mockReturnValueOnce(of([team({ name: 'Mine B' })]));
    teamApi.getTeamsByUser.mockReturnValue(of([team({ name: 'User team' })]));
    teamApi.getTeamsByMsel.mockReturnValue(of([team({ name: 'MSEL team' })]));

    service.load();
    expect(names(query.getAll())).toEqual(['Mine A']);
    service.loadMine();
    expect(names(query.getAll())).toEqual(['Mine B']);
    service.loadByUserId('user-1');
    expect(teamApi.getTeamsByUser).toHaveBeenCalledWith('user-1');
    expect(names(query.getAll())).toEqual(['User team']);
    service.loadByMsel('msel-1');
    expect(teamApi.getTeamsByMsel).toHaveBeenCalledWith('msel-1');
    expect(names(query.getAll())).toEqual(['MSEL team']);
    expect(query.getValue().loading).toBe(false);
  });

  /**
   * Verifies: every loader empties the store when its endpoint fails.
   * Interacts with: the four TeamService list endpoints (stubs erroring), real TeamQuery.
   * Data: a stored team before each failing call.
   */
  it('each loader empties the store on failure', () => {
    const { service, query, teamApi } = setup();
    const fail = () => throwError(() => new Error('boom'));
    teamApi.getMyTeams.mockImplementation(fail);
    teamApi.getTeamsByUser.mockImplementation(fail);
    teamApi.getTeamsByMsel.mockImplementation(fail);

    for (const loader of [
      () => service.load(),
      () => service.loadMine(),
      () => service.loadByUserId('user-1'),
      () => service.loadByMsel('msel-1'),
    ]) {
      service.updateStore(team());
      loader();
      expect(query.getAll()).toEqual([]);
    }
    expect(query.getValue().loading).toBe(false);
  });

  /**
   * Verifies: loadById upserts the team and makes it the active team.
   * Interacts with: TeamService.getTeam (stub), real TeamQuery (getActiveId).
   * Data: team-red stored; team-blue fetched.
   */
  it('loadById upserts the team and activates it', () => {
    const { service, query, teamApi } = setup();
    service.updateStore(team());
    teamApi.getTeam.mockReturnValue(
      of(team({ id: 'team-blue', name: 'Blue Team', shortName: 'BLUE' })),
    );

    service.loadById('team-blue');

    expect(names(query.getAll())).toEqual(['Blue Team', 'Red Cell']);
    expect(query.getActiveId()).toBe('team-blue');
  });

  /**
   * Verifies: add and addFromUnit store the created team and make it active.
   * Interacts with: TeamService.createTeam / createTeamFromUnit (stubs), real TeamQuery.
   * Data: a hand-made team, then one created from unit-1 for msel-1.
   */
  it('add and addFromUnit store and activate the new team', () => {
    const { service, query, teamApi } = setup();
    teamApi.createTeam.mockReturnValue(of(team()));
    teamApi.createTeamFromUnit.mockReturnValue(
      of(team({ id: 'team-unit', name: 'From Unit' })),
    );

    service.add(team({ id: undefined }));
    expect(query.getActiveId()).toBe('team-red');

    service.addFromUnit('msel-1', 'unit-1');
    expect(teamApi.createTeamFromUnit).toHaveBeenCalledWith('msel-1', 'unit-1');
    expect(names(query.getAll())).toEqual(['From Unit', 'Red Cell']);
    expect(query.getActiveId()).toBe('team-unit');
    expect(query.getValue().loading).toBe(false);
  });

  /**
   * Verifies: updateTeam stores the API's version of the team.
   * Interacts with: TeamService.updateTeam (stub), real TeamQuery.
   * Data: team-red renamed; the API returns "Red Cell (renamed)".
   */
  it('updateTeam stores the saved team', () => {
    const { service, query, teamApi } = setup();
    service.updateStore(team());
    teamApi.updateTeam.mockReturnValue(of(team({ name: 'Red Cell (renamed)' })));

    service.updateTeam(team({ name: 'client edit' }));

    expect(teamApi.updateTeam).toHaveBeenCalledWith(
      'team-red',
      expect.objectContaining({ name: 'client edit' }),
    );
    expect(query.getEntity('team-red').name).toBe('Red Cell (renamed)');
  });

  /**
   * Verifies: delete removes the team and clears the active team; unload empties the store and clears the active team.
   * Interacts with: TeamService.deleteTeam (stub), real TeamQuery.
   * Data: team-red active and deleted; team-blue unloaded.
   */
  it('delete and unload clear the active team', () => {
    const { service, query, teamApi } = setup();
    service.updateStore(team());
    service.updateStore(team({ id: 'team-blue', name: 'Blue Team' }));
    service.setActive('team-red');
    teamApi.deleteTeam.mockReturnValue(of(null));

    service.delete('team-red');
    expect(names(query.getAll())).toEqual(['Blue Team']);
    expect(query.getActiveId()).toBe('');

    service.setActive('team-blue');
    service.unload();
    expect(query.getAll()).toEqual([]);
    expect(query.getActiveId()).toBe('');
  });

  /**
   * Verifies: updateStore and deleteFromStore (the TeamCreated/Updated/Deleted SignalR targets) drive selectAll, sorted by name.
   * Interacts with: real TeamStore through the service, TeamQuery.selectAll.
   * Data: add Red Cell and Blue Team, rename Blue Team to Zulu, delete Red Cell.
   */
  it('updateStore and deleteFromStore drive the sorted query output', () => {
    const { service, query } = setup();
    const emissions = recordEmissions(query.selectAll());

    service.updateStore(team());
    service.updateStore(team({ id: 'team-blue', name: 'Blue Team' }));
    service.updateStore({ id: 'team-blue', name: 'Zulu' });
    service.deleteFromStore('team-red');

    expect(emissions.map(names)).toEqual([
      [],
      ['Red Cell'],
      ['Blue Team', 'Red Cell'],
      ['Red Cell', 'Zulu'],
      ['Zulu'],
    ]);
  });

  /**
   * Verifies: teamList filters on the filter query param across name, short name and id, and honours sorton/sortdir.
   * Interacts with: ActivatedRoute.queryParamMap (stub), real TeamQuery.
   * Data: teams Red Cell/RED, Blue Team/BLUE, Green Team/GRN; filters and sorts changed through the route.
   */
  it('teamList filters and sorts from the query params', () => {
    const { service, route } = setup();
    service.updateStore(team({ id: 'id-red' }));
    service.updateStore(team({ id: 'id-blue', name: 'Blue Team', shortName: 'BLUE' }));
    service.updateStore(team({ id: 'id-grn', name: 'Green Team', shortName: 'GRN' }));
    const emissions = recordEmissions(service.teamList);

    expect(names(emissions.at(-1))).toEqual(['Blue Team', 'Green Team', 'Red Cell']);

    route.setQueryParams({ filter: 'team' });
    expect(names(emissions.at(-1))).toEqual(['Blue Team', 'Green Team']);

    route.setQueryParams({ filter: 'grn' });
    expect(names(emissions.at(-1))).toEqual(['Green Team']);

    route.setQueryParams({ filter: 'id-r' });
    expect(names(emissions.at(-1))).toEqual(['Red Cell']);

    route.setQueryParams({ sortdir: 'desc' });
    expect(names(emissions.at(-1))).toEqual(['Red Cell', 'Green Team', 'Blue Team']);

    route.setQueryParams({ sorton: 'shortName', sortdir: 'asc' });
    expect(names(emissions.at(-1))).toEqual(['Blue Team', 'Green Team', 'Red Cell']);
  });

  /**
   * Verifies: filterControl writes the term to the filter query param.
   * Interacts with: Router.navigate (spy).
   * Data: term "red".
   */
  it('filterControl pushes the term into the filter query param', () => {
    const { service, navigate } = setup();

    service.filterControl.setValue('red');

    expect(navigate).toHaveBeenCalledWith([], {
      queryParams: { filter: 'red' },
      queryParamsHandling: 'merge',
    });
  });

  /**
   * Verifies: a failed request leaves loading set for every method that sets it first (current behavior), and the ones with no error callback let the error escape.
   * Interacts with: TeamService endpoints (stubs failing), real TeamStore and TeamQuery, captureUnhandledRxErrors.
   * Data: loading cleared first; each endpoint fails with "request failed".
   */
  it.each([
    { method: 'loadById', endpoint: 'getTeam', escapes: true, call: (s: TeamDataService) => s.loadById('x-1') },
    { method: 'add', endpoint: 'createTeam', escapes: true, call: (s: TeamDataService) => s.add({ id: 'x-1' }) },
    { method: 'addFromUnit', endpoint: 'createTeamFromUnit', escapes: true, call: (s: TeamDataService) => s.addFromUnit('msel-1', 'unit-1') },
    { method: 'updateTeam', endpoint: 'updateTeam', escapes: true, call: (s: TeamDataService) => s.updateTeam({ id: 'x-1' }) },
  ] as const)('$method leaves loading stuck when its request fails', async ({ endpoint, escapes, call }) => {
    const { service, teamApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    TestBed.inject(TeamStore).setLoading(false);
    teamApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    expect(TestBed.inject(TeamQuery).getValue().loading).toBe(true);
    // With no error callback the error escapes to ErrorService, the ErrorHandler
    // app.module.ts provides, which shows it.
    expect(errors).toEqual(escapes ? [failure] : []);
  });

  /**
   * Verifies: a failed request from delete escapes to the app's global ErrorHandler.
   * Interacts with: TeamService endpoints (stubs failing), captureUnhandledRxErrors.
   * Data: each endpoint fails with "request failed".
   */
  it.each([
    { method: 'delete', endpoint: 'deleteTeam', call: (s: TeamDataService) => s.delete('x-1') },
  ] as const)('$method lets a failed request reach the global ErrorHandler', async ({ endpoint, call }) => {
    const { service, teamApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    teamApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    // These methods subscribe with no error callback and set no loading flag,
    // so the error escapes to ErrorService, the ErrorHandler app.module.ts
    // provides, which shows it to the user. Not a defect on its own.
    expect(errors).toEqual([failure]);
  });
});
