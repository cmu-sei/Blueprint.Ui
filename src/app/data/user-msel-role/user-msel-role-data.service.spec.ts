// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, firstValueFrom, of, throwError } from 'rxjs';
import { MselRole, UserMselRole, UserMselRoleService } from 'src/app/generated/blueprint.api';
import { UserMselRoleStore } from './user-msel-role.store';
import { UserMselRoleDataService } from './user-msel-role-data.service';
import { UserMselRoleQuery } from './user-msel-role.query';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { activatedRouteStub } from 'src/app/test-utils/activated-route';
import { recordEmissions } from 'src/app/test-utils/record-emissions';
import { captureUnhandledRxErrors, flush } from 'src/app/test-utils/unhandled-rx-errors';

function umr(overrides: Partial<UserMselRole> = {}): UserMselRole {
  return {
    id: 'umr-1',
    mselId: 'msel-1',
    userId: 'user-1',
    role: MselRole.Editor,
    dateCreated: '2026-01-01T00:00:00Z' as unknown as Date,
    dateModified: '2026-01-02T00:00:00Z' as unknown as Date,
    ...overrides,
  };
}

function setup() {
  const umrApi = {
    getUserMselRolesByMsel: vi.fn(() => of<UserMselRole[]>([])),
    getUserMselRole: vi.fn(() => of<UserMselRole>({})),
    createUserMselRole: vi.fn(() => of<UserMselRole>({})),
    deleteUserMselRole: vi.fn(() => of<unknown>(null)),
    setUserMselIntegrationRoles: vi.fn(() => of<UserMselRole[]>([])),
  } satisfies ApiStub<UserMselRoleService>;
  TestBed.configureTestingModule({
    providers: [
      { provide: UserMselRoleService, useValue: umrApi },
      { provide: Router, useValue: { navigate: vi.fn() } satisfies Pick<Router, 'navigate'> },
      { provide: ActivatedRoute, useValue: activatedRouteStub().route },
    ],
  });
  return {
    service: TestBed.inject(UserMselRoleDataService),
    query: TestBed.inject(UserMselRoleQuery),
    umrApi,
  };
}

const roles = (list: UserMselRole[]) => list.map((r) => `${r.userId}:${r.role}`);

describe('UserMselRoleDataService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: loadByMsel replaces the store with the MSEL's role assignments (dates parsed), and empties it on failure.
   * Interacts with: UserMselRoleService.getUserMselRolesByMsel (stub), real UserMselRoleStore and UserMselRoleQuery.
   * Data: an Editor and a Viewer assignment, then a failure.
   */
  it('loadByMsel replaces the roles, or empties them on failure', () => {
    const { service, query, umrApi } = setup();
    umrApi.getUserMselRolesByMsel.mockReturnValueOnce(
      of([umr(), umr({ id: 'umr-2', userId: 'user-2', role: MselRole.Viewer })]),
    );
    umrApi.getUserMselRolesByMsel.mockReturnValueOnce(throwError(() => new Error('boom')));

    service.loadByMsel('msel-1');
    expect(roles(query.getAll())).toEqual(['user-1:Editor', 'user-2:Viewer']);
    expect(query.getEntity('umr-1').dateCreated).toEqual(new Date('2026-01-01T00:00:00Z'));

    service.loadByMsel('msel-1');
    expect(query.getAll()).toEqual([]);
    expect(query.getValue().loading).toBe(false);
  });

  /**
   * Verifies: loadById and add store the assignment with parsed dates; delete removes it after confirmation; unload clears.
   * Interacts with: UserMselRoleService get / create / delete (stubs), real UserMselRoleQuery.
   * Data: umr-2 fetched, umr-3 created, umr-2 deleted.
   */
  it('single-role calls keep the store in step with the API', () => {
    const { service, query, umrApi } = setup();
    umrApi.getUserMselRole.mockReturnValue(of(umr({ id: 'umr-2', role: MselRole.Approver })));
    umrApi.createUserMselRole.mockReturnValue(of(umr({ id: 'umr-3', role: MselRole.Evaluator })));
    umrApi.deleteUserMselRole.mockReturnValue(of(null));

    service.loadById('umr-2');
    service.add(umr({ id: undefined, role: MselRole.Evaluator }));
    expect(roles(query.getAll())).toEqual(['user-1:Approver', 'user-1:Evaluator']);
    expect(query.getEntity('umr-3').dateModified).toBeInstanceOf(Date);

    service.delete('umr-2');
    expect(roles(query.getAll())).toEqual(['user-1:Evaluator']);

    service.unload();
    expect(query.getAll()).toEqual([]);
  });

  /**
   * Verifies: setIntegrationRoles sends the three integration roles and upserts every assignment the API returns.
   * Interacts with: UserMselRoleService.setUserMselIntegrationRoles (stub), real UserMselRoleQuery.
   * Data: user-1 given CITE "Observer", Gallery "Viewer" and no Steamfitter role; the API returns two updated rows.
   */
  it('setIntegrationRoles stores the updated assignments', () => {
    const { service, query, umrApi } = setup();
    service.updateStore(umr());
    umrApi.setUserMselIntegrationRoles.mockReturnValue(
      of([
        umr({ citeEvaluationRole: 'Observer', galleryExhibitRole: 'Viewer' }),
        umr({ id: 'umr-2', role: MselRole.Viewer, citeEvaluationRole: 'Observer' }),
      ]),
    );

    service.setIntegrationRoles('msel-1', 'user-1', 'Observer', 'Viewer', null);

    expect(umrApi.setUserMselIntegrationRoles).toHaveBeenCalledWith('msel-1', 'user-1', {
      citeEvaluationRole: 'Observer',
      galleryExhibitRole: 'Viewer',
      steamfitterScenarioRole: null,
    });
    expect(query.getEntity('umr-1').galleryExhibitRole).toBe('Viewer');
    expect(query.getEntity('umr-2').dateCreated).toBeInstanceOf(Date);
  });

  /**
   * Verifies: updateStore/deleteFromStore (the UserMselRole SignalR targets) and setActive drive the queries.
   * Interacts with: real UserMselRoleStore through the service, UserMselRoleQuery.selectAll / selectActive.
   * Data: add two assignments, activate one, change its role, delete the other.
   */
  it('updateStore, deleteFromStore and setActive drive the queries', async () => {
    const { service, query } = setup();
    const emissions = recordEmissions(query.selectAll());

    service.updateStore(umr());
    service.updateStore(umr({ id: 'umr-2', userId: 'user-2', role: MselRole.Viewer }));
    service.setActive('umr-2');
    service.updateStore({ id: 'umr-2', role: MselRole.Editor });
    service.deleteFromStore('umr-1');

    expect(emissions.at(-1).map((r) => `${r.userId}:${r.role}`)).toEqual(['user-2:Editor']);
    const active$ = query.selectActive() as Observable<UserMselRole>;
    expect((await firstValueFrom(active$)).id).toBe('umr-2');
  });

  /**
   * Verifies: a failed request leaves loading set for every method that sets it first (current behavior), and the ones with no error callback let the error escape.
   * Interacts with: UserMselRoleService endpoints (stubs failing), real UserMselRoleStore and UserMselRoleQuery, captureUnhandledRxErrors.
   * Data: loading cleared first; each endpoint fails with "request failed".
   */
  it.each([
    { method: 'loadById', endpoint: 'getUserMselRole', escapes: true, call: (s: UserMselRoleDataService) => s.loadById('x-1') },
    { method: 'add', endpoint: 'createUserMselRole', escapes: true, call: (s: UserMselRoleDataService) => s.add({ id: 'x-1' }) },
  ] as const)('$method leaves loading stuck when its request fails', async ({ endpoint, escapes, call }) => {
    const { service, umrApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    TestBed.inject(UserMselRoleStore).setLoading(false);
    umrApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    expect(TestBed.inject(UserMselRoleQuery).getValue().loading).toBe(true);
    // With no error callback the error escapes to ErrorService, the ErrorHandler
    // app.module.ts provides, which shows it.
    expect(errors).toEqual(escapes ? [failure] : []);
  });

  /**
   * Verifies: a failed request from delete, setIntegrationRoles escapes to the app's global ErrorHandler.
   * Interacts with: UserMselRoleService endpoints (stubs failing), captureUnhandledRxErrors.
   * Data: each endpoint fails with "request failed".
   */
  it.each([
    { method: 'delete', endpoint: 'deleteUserMselRole', call: (s: UserMselRoleDataService) => s.delete('x-1') },
    { method: 'setIntegrationRoles', endpoint: 'setUserMselIntegrationRoles', call: (s: UserMselRoleDataService) => s.setIntegrationRoles('msel-1', 'user-1', null, null, null) },
  ] as const)('$method lets a failed request reach the global ErrorHandler', async ({ endpoint, call }) => {
    const { service, umrApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    umrApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    // These methods subscribe with no error callback and set no loading flag,
    // so the error escapes to ErrorService, the ErrorHandler app.module.ts
    // provides, which shows it to the user. Not a defect on its own.
    expect(errors).toEqual([failure]);
  });
});
