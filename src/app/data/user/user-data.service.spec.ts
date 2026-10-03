// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, Observable, firstValueFrom, of, throwError } from 'rxjs';
import { ComnAuthService, Theme } from '@cmusei/crucible-common';
import { User, UserService } from 'src/app/generated/blueprint.api';
import { UserDataService } from './user-data.service';
import { CurrentUserQuery, UserQuery } from './user.query';
import { CurrentUserStore, initialUserUiState, UserStore } from './user.store';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { recordEmissions } from 'src/app/test-utils/record-emissions';
import {
  captureUnhandledRxErrors,
  flush,
} from 'src/app/test-utils/unhandled-rx-errors';

// The slice of an oidc-client-ts User that setCurrentUser reads.
type AuthUser = { profile: { sub: string; name: string } } | null;

function user(overrides: Partial<User> = {}): User {
  return { id: 'user-1', name: 'Alice Analyst', ...overrides };
}

function setup() {
  const userApi = {
    getUsers: vi.fn(() => of<User[]>([])),
    getUser: vi.fn(() => of(user())),
    getMselUsers: vi.fn(() => of<User[]>([])),
    createUser: vi.fn(() => of(user())),
    updateUser: vi.fn(() => of(user())),
    deleteUser: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<UserService>;
  const authUser$ = new BehaviorSubject<AuthUser>(null);
  const auth: Pick<ComnAuthService, 'user$'> = {
    user$: authUser$ as unknown as ComnAuthService['user$'],
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: UserService, useValue: userApi },
      { provide: ComnAuthService, useValue: auth },
    ],
  });
  return {
    service: TestBed.inject(UserDataService),
    query: TestBed.inject(UserQuery),
    store: TestBed.inject(UserStore),
    currentUserQuery: TestBed.inject(CurrentUserQuery),
    userApi,
    authUser$,
  };
}

const names = (users: User[]) => users.map((u) => u.name);

describe('UserDataService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: load and loadByMsel are cold, and replace the store with their endpoint's users (sorted by name) once subscribed.
   * Interacts with: UserService.getUsers / getMselUsers (stubs), real UserStore and UserQuery.
   * Data: two users from getUsers, one from getMselUsers.
   */
  it('load and loadByMsel replace the users when subscribed', async () => {
    const { service, query, userApi } = setup();
    userApi.getUsers.mockReturnValue(
      of([user({ id: 'user-2', name: 'Zed' }), user()]),
    );
    userApi.getMselUsers.mockReturnValue(of([user({ id: 'user-3', name: 'Bob' })]));

    const load$ = service.load();
    expect(query.getAll()).toEqual([]);
    await firstValueFrom(load$);
    expect(names(query.getAll())).toEqual(['Alice Analyst', 'Zed']);
    expect(query.getValue().loading).toBe(false);

    await firstValueFrom(service.loadByMsel('msel-1'));
    expect(userApi.getMselUsers).toHaveBeenCalledWith('msel-1');
    expect(names(query.getAll())).toEqual(['Bob']);
  });

  /**
   * Verifies: isLoading$ reports the loading flag across a load.
   * Interacts with: UserQuery.isLoading$, UserService.getUsers (stub).
   * Data: one load of a single user.
   */
  it('isLoading$ tracks a load', async () => {
    const { service, query, userApi } = setup();
    userApi.getUsers.mockReturnValue(of([user()]));
    const loading = recordEmissions(query.isLoading$);

    await firstValueFrom(service.load());

    // Akita entity stores start out loading until their first set().
    expect(loading).toEqual([true, false]);
  });

  /**
   * Verifies: loadById upserts the fetched user next to the others.
   * Interacts with: UserService.getUser (stub), real UserQuery.
   * Data: user-1 stored; user-2 fetched.
   */
  it('loadById upserts the user', async () => {
    const { service, query, userApi } = setup();
    service.updateStore(user());
    userApi.getUser.mockReturnValue(of(user({ id: 'user-2', name: 'Bob' })));

    await firstValueFrom(service.loadById('user-2'));

    expect(names(query.getAll())).toEqual(['Alice Analyst', 'Bob']);
    expect((await firstValueFrom(query.selectByUserId('user-2'))).name).toBe('Bob');
  });

  /**
   * Verifies: create stores the new user, and new users get the initial UI state.
   * Interacts with: UserService.createUser (stub), real UserStore UI store via UserQuery.ui.
   * Data: a new user returned as user-1.
   */
  it('create stores the user with the initial UI state', async () => {
    const { service, query, userApi } = setup();
    userApi.createUser.mockReturnValue(of(user()));

    await firstValueFrom(service.create(user({ id: undefined })));

    expect(names(query.getAll())).toEqual(['Alice Analyst']);
    expect(query.ui.getEntity('user-1')).toEqual({
      id: 'user-1',
      ...initialUserUiState,
    });
  });

  /**
   * Verifies: update sends the edit, but the store keeps the old user because updateStore uses add().
   * Interacts with: UserService.updateUser (stub), real UserQuery.
   * Data: user-1 "Alice Analyst" stored; the API returns "Alice Admin".
   */
  it('update does not replace a user that is already stored', () => {
    const { service, query, userApi } = setup();
    service.updateStore(user());
    userApi.updateUser.mockReturnValue(of(user({ name: 'Alice Admin' })));

    service.update(user({ name: 'Alice Admin' }));

    expect(userApi.updateUser).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ name: 'Alice Admin' }),
    );
    expect(query.getEntity('user-1').name).toBe('Alice Analyst');
  });

  /**
   * Verifies: a failed update leaves the store unchanged and its error escapes to the app's global ErrorHandler.
   * Interacts with: UserService.updateUser (stub failing), real UserQuery, rxjs config.onUnhandledError.
   * Data: user-1 stored; updateUser errors with "forbidden".
   */
  it('update lets a failed request reach the global ErrorHandler', async () => {
    const { service, query, userApi } = setup();
    service.updateStore(user());
    const unhandled = captureUnhandledRxErrors();
    userApi.updateUser.mockReturnValue(throwError(() => new Error('forbidden')));

    service.update(user({ name: 'Alice Admin' }));
    await flush();

    // update() subscribes with no error callback and sets no loading flag, so
    // the error escapes to ErrorService, the ErrorHandler app.module.ts
    // provides, which shows it. Not a defect on its own.
    expect(unhandled).toEqual([new Error('forbidden')]);
    expect(query.getEntity('user-1').name).toBe('Alice Analyst');
  });

  /**
   * Verifies: when load, loadById or loadByMsel fails, the error reaches the caller but the store stays loading.
   * Interacts with: UserService.getUsers / getUser / getMselUsers (stubs failing), real UserQuery.
   * Data: loading cleared first; each endpoint errors with "unavailable".
   */
  it.each([
    { method: 'load', endpoint: 'getUsers', call: (s: UserDataService): Observable<unknown> => s.load() },
    { method: 'loadById', endpoint: 'getUser', call: (s: UserDataService): Observable<unknown> => s.loadById('user-1') },
    { method: 'loadByMsel', endpoint: 'getMselUsers', call: (s: UserDataService): Observable<unknown> => s.loadByMsel('msel-1') },
  ] as const)('$method leaves loading on after a failed request', async ({ endpoint, call }) => {
    const { service, query, userApi } = setup();
    TestBed.inject(UserStore).setLoading(false);
    userApi[endpoint].mockReturnValue(throwError(() => new Error('unavailable')));

    await expect(firstValueFrom(call(service))).rejects.toThrow('unavailable');

    expect(query.getValue().loading).toBe(true);
  });

  /**
   * Verifies: delete removes the user and its UI state once subscribed; deleteFromStore does the same for SignalR.
   * Interacts with: UserService.deleteUser (stub), real UserQuery and UserQuery.ui.
   * Data: user-1 and user-2 stored; user-1 deleted through the API, user-2 through deleteFromStore.
   */
  it('delete and deleteFromStore remove the user and its UI state', async () => {
    const { service, query, userApi } = setup();
    service.updateStore(user());
    service.updateStore(user({ id: 'user-2', name: 'Bob' }));
    userApi.deleteUser.mockReturnValue(of(null));

    await firstValueFrom(service.delete('user-1'));
    expect(names(query.getAll())).toEqual(['Bob']);
    expect(query.ui.getEntity('user-1')).toBeUndefined();

    service.deleteFromStore('user-2');
    expect(query.getAll()).toEqual([]);
    expect(query.ui.getAll()).toEqual([]);
  });

  /**
   * Verifies: setActive activates the user in both the entity store and the UI store.
   * Interacts with: real UserStore / UserQuery and UserQuery.ui.
   * Data: two users; user-2 activated.
   */
  it('setActive activates the user and its UI state', () => {
    const { service, query } = setup();
    service.updateStore(user());
    service.updateStore(user({ id: 'user-2', name: 'Bob' }));

    service.setActive('user-2');

    expect(query.getActiveId()).toBe('user-2');
    expect(query.ui.getActiveId()).toBe('user-2');
  });

  /**
   * Verifies: reloading the users replaces their UI state with the initial state.
   * Interacts with: UserService.getUsers (stub), real UserStore UI store.
   * Data: user-1 marked selected in the UI store, then the users reloaded.
   */
  it('reloading resets per-user UI state', async () => {
    const { service, query, store, userApi } = setup();
    userApi.getUsers.mockReturnValue(of([user()]));
    await firstValueFrom(service.load());
    store.ui.update('user-1', { isSelected: true });
    expect(query.ui.getEntity('user-1').isSelected).toBe(true);

    await firstValueFrom(service.load());

    expect(query.ui.getEntity('user-1').isSelected).toBe(false);
  });

  /**
   * Verifies: setCurrentUser clears the current user, then fills it from the signed-in profile and ignores a signed-out (null) emission.
   * Interacts with: ComnAuthService.user$ (stub subject), real CurrentUserStore / CurrentUserQuery.
   * Data: no user, then profile { sub: 'user-1', name: 'Alice Analyst' }, then null.
   */
  it('setCurrentUser follows the signed-in profile', () => {
    const { service, currentUserQuery, authUser$ } = setup();

    service.setCurrentUser();
    expect(currentUserQuery.getValue()).toMatchObject({ name: '', id: '' });

    authUser$.next({ profile: { sub: 'user-1', name: 'Alice Analyst' } });
    expect(currentUserQuery.getValue()).toMatchObject({
      name: 'Alice Analyst',
      id: 'user-1',
    });

    authUser$.next(null);
    expect(currentUserQuery.getValue().id).toBe('user-1');
  });

  /**
   * Verifies: setUserTheme updates the theme that CurrentUserQuery.userTheme$ emits.
   * Interacts with: real CurrentUserStore and CurrentUserQuery.userTheme$.
   * Data: the default light theme, then dark.
   */
  it('setUserTheme drives userTheme$', () => {
    const { service, currentUserQuery } = setup();
    const themes = recordEmissions(currentUserQuery.userTheme$);

    service.setUserTheme(Theme.DARK);

    expect(themes).toEqual([Theme.LIGHT, Theme.DARK]);
  });
});

describe('CurrentUserQuery', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: getLastRoute falls back to "/" until a route is recorded.
   * Interacts with: real CurrentUserStore and CurrentUserQuery.
   * Data: the initial state, then lastRoute "/build?msel=msel-1".
   */
  it('getLastRoute defaults to the root route', () => {
    const store = TestBed.inject(CurrentUserStore);
    const query = TestBed.inject(CurrentUserQuery);

    expect(query.getLastRoute()).toBe('/');

    store.update({ lastRoute: '/build?msel=msel-1' });
    expect(query.getLastRoute()).toBe('/build?msel=msel-1');
  });
});
