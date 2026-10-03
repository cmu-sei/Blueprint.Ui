// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, firstValueFrom, of, throwError } from 'rxjs';
import { UserTeamRole, UserTeamRoleService } from 'src/app/generated/blueprint.api';
import { UserTeamRoleStore } from './user-team-role.store';
import { UserTeamRoleDataService } from './user-team-role-data.service';
import { UserTeamRoleQuery } from './user-team-role.query';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { activatedRouteStub } from 'src/app/test-utils/activated-route';
import { recordEmissions } from 'src/app/test-utils/record-emissions';
import { captureUnhandledRxErrors, flush } from 'src/app/test-utils/unhandled-rx-errors';

function utr(overrides: Partial<UserTeamRole> = {}): UserTeamRole {
  return {
    id: 'utr-1',
    teamId: 'team-red',
    userId: 'user-1',
    role: 'Inviter',
    dateCreated: '2026-01-01T00:00:00Z' as unknown as Date,
    dateModified: '2026-01-02T00:00:00Z' as unknown as Date,
    ...overrides,
  };
}

function setup() {
  const utrApi = {
    getUserTeamRolesByMsel: vi.fn(() => of<UserTeamRole[]>([])),
    getUserTeamRole: vi.fn(() => of<UserTeamRole>({})),
    createUserTeamRole: vi.fn(() => of<UserTeamRole>({})),
    deleteUserTeamRole: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<UserTeamRoleService>;
  TestBed.configureTestingModule({
    providers: [
      { provide: UserTeamRoleService, useValue: utrApi },
      { provide: Router, useValue: { navigate: vi.fn() } satisfies Pick<Router, 'navigate'> },
      { provide: ActivatedRoute, useValue: activatedRouteStub().route },
    ],
  });
  return {
    service: TestBed.inject(UserTeamRoleDataService),
    query: TestBed.inject(UserTeamRoleQuery),
    utrApi,
  };
}

const roles = (list: UserTeamRole[]) => list.map((r) => `${r.userId}:${r.role}`);

describe('UserTeamRoleDataService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: loadByMsel replaces the store with the MSEL's team-role assignments (dates parsed), and empties it on failure.
   * Interacts with: UserTeamRoleService.getUserTeamRolesByMsel (stub), real UserTeamRoleStore and UserTeamRoleQuery.
   * Data: an Inviter and a Submitter assignment, then a failure.
   */
  it('loadByMsel replaces the roles, or empties them on failure', () => {
    const { service, query, utrApi } = setup();
    utrApi.getUserTeamRolesByMsel.mockReturnValueOnce(
      of([utr(), utr({ id: 'utr-2', userId: 'user-2', role: 'Submitter' })]),
    );
    utrApi.getUserTeamRolesByMsel.mockReturnValueOnce(throwError(() => new Error('boom')));

    service.loadByMsel('msel-1');
    expect(utrApi.getUserTeamRolesByMsel).toHaveBeenCalledWith('msel-1');
    expect(roles(query.getAll())).toEqual(['user-1:Inviter', 'user-2:Submitter']);
    expect(query.getEntity('utr-1').dateModified).toEqual(new Date('2026-01-02T00:00:00Z'));

    service.loadByMsel('msel-1');
    expect(query.getAll()).toEqual([]);
    expect(query.getValue().loading).toBe(false);
  });

  /**
   * Verifies: loadById and add store the assignment with parsed dates; delete removes after confirmation; unload clears.
   * Interacts with: UserTeamRoleService get / create / delete (stubs), real UserTeamRoleQuery.
   * Data: utr-2 fetched, utr-3 created, utr-2 deleted.
   */
  it('single-role calls keep the store in step with the API', () => {
    const { service, query, utrApi } = setup();
    utrApi.getUserTeamRole.mockReturnValue(of(utr({ id: 'utr-2', role: 'Modifier' })));
    utrApi.createUserTeamRole.mockReturnValue(of(utr({ id: 'utr-3', role: 'Observer' })));
    utrApi.deleteUserTeamRole.mockReturnValue(of(null));

    service.loadById('utr-2');
    service.add(utr({ id: undefined, role: 'Observer' }));
    expect(roles(query.getAll())).toEqual(['user-1:Modifier', 'user-1:Observer']);
    expect(query.getEntity('utr-3').dateCreated).toBeInstanceOf(Date);

    service.delete('utr-2');
    expect(roles(query.getAll())).toEqual(['user-1:Observer']);

    service.unload();
    expect(query.getAll()).toEqual([]);
  });

  /**
   * Verifies: updateStore/deleteFromStore and setActive drive the queries.
   * Interacts with: real UserTeamRoleStore through the service, UserTeamRoleQuery.selectAll / selectActive.
   * Data: add two assignments, activate one, change its role, delete the other.
   */
  it('updateStore, deleteFromStore and setActive drive the queries', async () => {
    const { service, query } = setup();
    const emissions = recordEmissions(query.selectAll());

    service.updateStore(utr());
    service.updateStore(utr({ id: 'utr-2', userId: 'user-2', role: 'Observer' }));
    service.setActive('utr-2');
    service.updateStore({ id: 'utr-2', role: 'Incrementer' });
    service.deleteFromStore('utr-1');

    expect(emissions.at(-1).map((r) => `${r.userId}:${r.role}`)).toEqual(['user-2:Incrementer']);
    const active$ = query.selectActive() as Observable<UserTeamRole>;
    expect((await firstValueFrom(active$)).id).toBe('utr-2');
  });

  /**
   * Verifies: a failed request leaves loading set for every method that sets it first (current behavior), and the ones with no error callback let the error escape.
   * Interacts with: UserTeamRoleService endpoints (stubs failing), real UserTeamRoleStore and UserTeamRoleQuery, captureUnhandledRxErrors.
   * Data: loading cleared first; each endpoint fails with "request failed".
   */
  it.each([
    { method: 'loadById', endpoint: 'getUserTeamRole', escapes: true, call: (s: UserTeamRoleDataService) => s.loadById('x-1') },
    { method: 'add', endpoint: 'createUserTeamRole', escapes: true, call: (s: UserTeamRoleDataService) => s.add({ id: 'x-1' }) },
  ] as const)('$method leaves loading stuck when its request fails', async ({ endpoint, escapes, call }) => {
    const { service, utrApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    TestBed.inject(UserTeamRoleStore).setLoading(false);
    utrApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    expect(TestBed.inject(UserTeamRoleQuery).getValue().loading).toBe(true);
    // With no error callback the error escapes to ErrorService, the ErrorHandler
    // app.module.ts provides, which shows it.
    expect(errors).toEqual(escapes ? [failure] : []);
  });

  /**
   * Verifies: a failed request from delete escapes to the app's global ErrorHandler.
   * Interacts with: UserTeamRoleService endpoints (stubs failing), captureUnhandledRxErrors.
   * Data: each endpoint fails with "request failed".
   */
  it.each([
    { method: 'delete', endpoint: 'deleteUserTeamRole', call: (s: UserTeamRoleDataService) => s.delete('x-1') },
  ] as const)('$method lets a failed request reach the global ErrorHandler', async ({ endpoint, call }) => {
    const { service, utrApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    utrApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    // These methods subscribe with no error callback and set no loading flag,
    // so the error escapes to ErrorService, the ErrorHandler app.module.ts
    // provides, which shows it to the user. Not a defect on its own.
    expect(errors).toEqual([failure]);
  });
});
