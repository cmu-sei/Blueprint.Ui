// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { TeamUser, TeamUserService } from 'src/app/generated/blueprint.api';
import { TeamUserDataService } from './team-user-data.service';
import { TeamUserQuery } from './team-user.query';
import { TeamUserStore } from './team-user.store';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { recordEmissions } from 'src/app/test-utils/record-emissions';
import { captureUnhandledRxErrors, flush } from 'src/app/test-utils/unhandled-rx-errors';

function teamUser(overrides: Partial<TeamUser> = {}): TeamUser {
  return {
    id: 'tu-1',
    teamId: 'team-red',
    userId: 'user-1',
    dateCreated: '2026-01-01T00:00:00Z' as unknown as Date,
    dateModified: '2026-01-02T00:00:00Z' as unknown as Date,
    ...overrides,
  };
}

function setup() {
  const teamUserApi = {
    getMselTeamUsers: vi.fn(() => of<TeamUser[]>([])),
    getTeamTeamUsers: vi.fn(() => of<TeamUser[]>([])),
    getTeamUser: vi.fn(() => of(teamUser())),
    createTeamUser: vi.fn(() => of(teamUser())),
    deleteTeamUser: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<TeamUserService>;
  TestBed.configureTestingModule({
    providers: [{ provide: TeamUserService, useValue: teamUserApi }],
  });
  return {
    service: TestBed.inject(TeamUserDataService),
    query: TestBed.inject(TeamUserQuery),
    store: TestBed.inject(TeamUserStore),
    teamUserApi,
  };
}

const userIds = (list: TeamUser[]) => list.map((tu) => tu.userId);

describe('TeamUserDataService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: loadByMsel and loadByTeam replace the store with parsed-date team users, and empty it on failure.
   * Interacts with: TeamUserService.getMselTeamUsers / getTeamTeamUsers (stubs), real TeamUserStore and TeamUserQuery.
   * Data: MSEL team users, team team users, then a failure from each.
   */
  it('loaders replace the team users, or empty them on failure', () => {
    const { service, query, teamUserApi } = setup();
    teamUserApi.getMselTeamUsers.mockReturnValueOnce(
      of([teamUser(), teamUser({ id: 'tu-2', userId: 'user-2' })]),
    );
    teamUserApi.getTeamTeamUsers.mockReturnValueOnce(of([teamUser({ id: 'tu-3', userId: 'user-3' })]));
    teamUserApi.getMselTeamUsers.mockReturnValueOnce(throwError(() => new Error('boom')));
    teamUserApi.getTeamTeamUsers.mockReturnValueOnce(throwError(() => new Error('boom')));

    service.loadByMsel('msel-1');
    expect(teamUserApi.getMselTeamUsers).toHaveBeenCalledWith('msel-1');
    expect(userIds(query.getAll())).toEqual(['user-1', 'user-2']);
    expect(query.getEntity('tu-1').dateCreated).toEqual(new Date('2026-01-01T00:00:00Z'));

    service.loadByTeam('team-red');
    expect(teamUserApi.getTeamTeamUsers).toHaveBeenCalledWith('team-red');
    expect(userIds(query.getAll())).toEqual(['user-3']);

    service.loadByMsel('msel-1');
    expect(query.getAll()).toEqual([]);
    service.updateStore(teamUser());
    service.loadByTeam('team-red');
    expect(query.getAll()).toEqual([]);
    expect(query.getValue().loading).toBe(false);
  });

  /**
   * Verifies: loadById upserts and add stores the created team user with parsed dates.
   * Interacts with: TeamUserService.getTeamUser / createTeamUser (stubs), real TeamUserQuery.
   * Data: tu-2 fetched, tu-3 created.
   */
  it('loadById and add store the team user', () => {
    const { service, query, teamUserApi } = setup();
    teamUserApi.getTeamUser.mockReturnValue(of(teamUser({ id: 'tu-2', userId: 'user-2' })));
    teamUserApi.createTeamUser.mockReturnValue(of(teamUser({ id: 'tu-3', userId: 'user-3' })));

    service.loadById('tu-2');
    service.add(teamUser({ id: undefined, userId: 'user-3' }));

    expect(userIds(query.getAll())).toEqual(['user-2', 'user-3']);
    expect(query.getEntity('tu-3').dateModified).toBeInstanceOf(Date);
    expect(query.getValue().loading).toBe(false);
  });

  /**
   * Verifies: delete removes the team user, and Akita clears the active id when the active team user is the one removed.
   * Interacts with: TeamUserService.deleteTeamUser (stub), real TeamUserStore and TeamUserQuery.
   * Data: tu-1 (active) and tu-2; tu-1 deleted.
   */
  it('delete removes the team user and clears it as active', () => {
    const { service, query, store, teamUserApi } = setup();
    service.updateStore(teamUser());
    service.updateStore(teamUser({ id: 'tu-2', userId: 'user-2' }));
    store.setActive('tu-1');
    teamUserApi.deleteTeamUser.mockReturnValue(of(null));

    service.delete('tu-1');

    expect(userIds(query.getAll())).toEqual(['user-2']);
    expect(query.getActiveId()).toBeNull();
  });

  /**
   * Verifies: updateStore (the TeamUser SignalR target) parses dates and upserts; deleteFromStore removes; unload clears active and entities.
   * Interacts with: real TeamUserStore through the service, TeamUserQuery.selectAll.
   * Data: tu-1 arrives with string dates, then is removed; tu-2 added then unloaded.
   */
  it('updateStore, deleteFromStore and unload drive the query output', () => {
    const { service, query, store } = setup();
    const emissions = recordEmissions(query.selectAll());

    service.updateStore(teamUser());
    expect(query.getEntity('tu-1').dateCreated).toBeInstanceOf(Date);
    service.deleteFromStore('tu-1');
    service.updateStore(teamUser({ id: 'tu-2', userId: 'user-2' }));
    store.setActive('tu-2');
    service.unload();

    expect(emissions.map(userIds)).toEqual([[], ['user-1'], [], ['user-2'], []]);
    expect(query.getActiveId()).toBeNull();
  });

  /**
   * Verifies: a failed request leaves loading set for every method that sets it first (current behavior), and the ones with no error callback let the error escape.
   * Interacts with: TeamUserService endpoints (stubs failing), real TeamUserStore and TeamUserQuery, captureUnhandledRxErrors.
   * Data: loading cleared first; each endpoint fails with "request failed".
   */
  it.each([
    { method: 'loadById', endpoint: 'getTeamUser', escapes: true, call: (s: TeamUserDataService) => s.loadById('x-1') },
    { method: 'add', endpoint: 'createTeamUser', escapes: true, call: (s: TeamUserDataService) => s.add({ id: 'x-1' }) },
  ] as const)('$method leaves loading stuck when its request fails', async ({ endpoint, escapes, call }) => {
    const { service, teamUserApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    TestBed.inject(TeamUserStore).setLoading(false);
    teamUserApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    expect(TestBed.inject(TeamUserQuery).getValue().loading).toBe(true);
    // With no error callback the error escapes to ErrorService, the ErrorHandler
    // app.module.ts provides, which shows it.
    expect(errors).toEqual(escapes ? [failure] : []);
  });

  /**
   * Verifies: a failed request from delete escapes to the app's global ErrorHandler.
   * Interacts with: TeamUserService endpoints (stubs failing), captureUnhandledRxErrors.
   * Data: each endpoint fails with "request failed".
   */
  it.each([
    { method: 'delete', endpoint: 'deleteTeamUser', call: (s: TeamUserDataService) => s.delete('x-1') },
  ] as const)('$method lets a failed request reach the global ErrorHandler', async ({ endpoint, call }) => {
    const { service, teamUserApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    teamUserApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    // These methods subscribe with no error callback and set no loading flag,
    // so the error escapes to ErrorService, the ErrorHandler app.module.ts
    // provides, which shows it to the user. Not a defect on its own.
    expect(errors).toEqual([failure]);
  });
});
