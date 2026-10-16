// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import {
  UnitUser,
  UnitUserService,
  User,
  UserService,
} from 'src/app/generated/blueprint.api';
import { UnitUserDataService } from './unit-user-data.service';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { getDefaultProviders } from 'src/app/test-utils/default-test-providers';
import { recordEmissions } from 'src/app/test-utils/record-emissions';
import { captureUnhandledRxErrors, flush } from 'src/app/test-utils/unhandled-rx-errors';

const alice: User = { id: 'user-1', name: 'Alice' };
const bob: User = { id: 'user-2', name: 'Bob' };

function setup() {
  const userApi = {
    getUnitUsers: vi.fn(() => of<User[]>([])),
  } satisfies ApiStub<UserService>;
  const unitUserApi = {
    createUnitUser: vi.fn(() => of<UnitUser>({})),
    deleteUnitUserByIds: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<UnitUserService>;
  TestBed.configureTestingModule({
    // The service injects auth, router and route but never uses them; the
    // default placeholders satisfy DI.
    providers: getDefaultProviders([
      { provide: UserService, useValue: userApi },
      { provide: UnitUserService, useValue: unitUserApi },
    ]),
  });
  const service = TestBed.inject(UnitUserDataService);
  return {
    service,
    userApi,
    unitUserApi,
    emissions: recordEmissions(service.unitUsers),
  };
}

const ids = (users: User[]) => users.map((u) => u.id);

describe('UnitUserDataService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: getUnitUsersFromApi publishes the unit's users, or an empty list on failure.
   * Interacts with: UserService.getUnitUsers (stub), unitUsers subject.
   * Data: Alice and Bob in unit-1, then an API error.
   */
  it('publishes the unit users', () => {
    const { service, userApi, emissions } = setup();
    userApi.getUnitUsers.mockReturnValueOnce(of([alice, bob]));
    userApi.getUnitUsers.mockReturnValueOnce(throwError(() => new Error('boom')));

    service.getUnitUsersFromApi('unit-1');
    expect(userApi.getUnitUsers).toHaveBeenCalledWith('unit-1');
    expect(ids(emissions.at(-1))).toEqual(['user-1', 'user-2']);

    service.getUnitUsersFromApi('unit-1');
    expect(emissions.at(-1)).toEqual([]);
  });

  /**
   * Verifies: addUserToUnit prepends the user once the API confirms, but not if SignalR already added them.
   * Interacts with: UnitUserService.createUnitUser (stub), unitUsers subject.
   * Data: unit-1 with Alice; Bob added twice.
   */
  it('addUserToUnit prepends the user once', () => {
    const { service, userApi, unitUserApi, emissions } = setup();
    userApi.getUnitUsers.mockReturnValue(of([alice]));
    unitUserApi.createUnitUser.mockReturnValue(of({ id: 'uu-2' }));
    service.getUnitUsersFromApi('unit-1');

    service.addUserToUnit('unit-1', bob);
    service.addUserToUnit('unit-1', bob);

    expect(unitUserApi.createUnitUser).toHaveBeenCalledWith({
      unitId: 'unit-1',
      userId: 'user-2',
    });
    expect(ids(emissions.at(-1))).toEqual(['user-2', 'user-1']);
  });

  /**
   * Verifies: removeUnitUser drops the user after the API confirms.
   * Interacts with: UnitUserService.deleteUnitUserByIds (stub), unitUsers subject.
   * Data: unit-1 with Alice and Bob; Alice removed.
   */
  it('removeUnitUser drops the user', () => {
    const { service, userApi, unitUserApi, emissions } = setup();
    userApi.getUnitUsers.mockReturnValue(of([alice, bob]));
    unitUserApi.deleteUnitUserByIds.mockReturnValue(of(null));
    service.getUnitUsersFromApi('unit-1');

    service.removeUnitUser('unit-1', 'user-1');

    expect(unitUserApi.deleteUnitUserByIds).toHaveBeenCalledWith('unit-1', 'user-1');
    expect(ids(emissions.at(-1))).toEqual(['user-2']);
  });

  /**
   * Verifies: updateStore and deleteFromStore only apply unit-user events for the unit currently loaded.
   * Interacts with: unitUsers subject.
   * Data: unit-1 loaded with Alice; events for unit-1 (add Bob, remove Alice) and unit-2 (ignored).
   */
  it('applies unit-user events only for the loaded unit', () => {
    const { service, userApi, emissions } = setup();
    userApi.getUnitUsers.mockReturnValue(of([alice]));
    service.getUnitUsersFromApi('unit-1');

    service.updateStore({ unitId: 'unit-2', userId: 'user-9', user: { id: 'user-9' } });
    expect(ids(emissions.at(-1))).toEqual(['user-1']);

    service.updateStore({ unitId: 'unit-1', userId: 'user-2', user: bob });
    expect(ids(emissions.at(-1))).toEqual(['user-2', 'user-1']);

    service.deleteFromStore({ unitId: 'unit-2', userId: 'user-2' });
    expect(ids(emissions.at(-1))).toEqual(['user-2', 'user-1']);

    service.deleteFromStore({ unitId: 'unit-1', userId: 'user-1' });
    expect(ids(emissions.at(-1))).toEqual(['user-2']);
  });

  /**
   * Verifies: a failed request from addUserToUnit, removeUnitUser escapes to the app's global ErrorHandler.
   * Interacts with: UnitUserService endpoints (stubs failing), captureUnhandledRxErrors.
   * Data: each endpoint fails with "request failed".
   */
  it.each([
    { method: 'addUserToUnit', endpoint: 'createUnitUser', call: (s: UnitUserDataService) => s.addUserToUnit('unit-1', { id: 'user-1' }) },
    { method: 'removeUnitUser', endpoint: 'deleteUnitUserByIds', call: (s: UnitUserDataService) => s.removeUnitUser('unit-1', 'user-1') },
  ] as const)('$method lets a failed request reach the global ErrorHandler', async ({ endpoint, call }) => {
    const { service, unitUserApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    unitUserApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    // These methods subscribe with no error callback and set no loading flag,
    // so the error escapes to ErrorService, the ErrorHandler app.module.ts
    // provides, which shows it to the user. Not a defect on its own.
    expect(errors).toEqual([failure]);
  });
});
