// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Theme } from '@cmusei/crucible-common';
import { User } from 'src/app/generated/blueprint.api';
import { CurrentUserQuery, UserQuery } from './user.query';
import { CurrentUserStore, initialUserUiState, UserStore } from './user.store';
import { recordEmissions } from 'src/app/test-utils/record-emissions';

function user(overrides: Partial<User> = {}): User {
  return { id: 'user-1', name: 'Alice Analyst', ...overrides };
}

describe('UserQuery', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: selectAll and getAll list users by name, whatever order the store was given them in.
   * Interacts with: real UserStore and UserQuery (sortBy name, ascending).
   * Data: Zed, Alice Analyst and Bob, set in that order.
   */
  it('lists users sorted by name', () => {
    const store = TestBed.inject(UserStore);
    const query = TestBed.inject(UserQuery);
    const emitted = recordEmissions(query.selectAll());

    store.set([
      user({ id: 'user-3', name: 'Zed' }),
      user(),
      user({ id: 'user-2', name: 'Bob' }),
    ]);

    expect(emitted.at(-1).map((u) => u.name)).toEqual(['Alice Analyst', 'Bob', 'Zed']);
    expect(query.getAll().map((u) => u.id)).toEqual(['user-1', 'user-2', 'user-3']);
  });

  /**
   * Verifies: isLoading$ follows the store's loading flag, starting from Akita's initial true.
   * Interacts with: real UserStore.setLoading and UserQuery.isLoading$.
   * Data: loading cleared, then set again.
   */
  it('isLoading$ follows the store loading flag', () => {
    const store = TestBed.inject(UserStore);
    const query = TestBed.inject(UserQuery);
    const loading = recordEmissions(query.isLoading$);

    store.setLoading(false);
    store.setLoading(true);

    expect(loading).toEqual([true, false, true]);
  });

  /**
   * Verifies: selectByUserId emits the stored user, then its updates, and undefined once it is removed.
   * Interacts with: real UserStore and UserQuery.selectByUserId.
   * Data: user-1 stored, renamed, then removed; user-2 stored beside it.
   */
  it('selectByUserId follows one user', () => {
    const store = TestBed.inject(UserStore);
    const query = TestBed.inject(UserQuery);
    store.set([user(), user({ id: 'user-2', name: 'Bob' })]);
    const emitted = recordEmissions(query.selectByUserId('user-1'));

    store.update('user-1', { name: 'Alice Admin' });
    store.update('user-2', { name: 'Robert' });
    store.remove('user-1');

    expect(emitted.map((u) => u?.name)).toEqual(['Alice Analyst', 'Alice Admin', undefined]);
  });

  /**
   * Verifies: the UI query gives every user the store sets the initial UI state, and follows its updates.
   * Interacts with: real UserStore UI store (setInitialEntityState) through UserQuery.ui.
   * Data: user-1 and user-2 set; user-2 then marked selected.
   */
  it('gives every stored user the initial UI state', () => {
    const store = TestBed.inject(UserStore);
    const query = TestBed.inject(UserQuery);

    store.set([user(), user({ id: 'user-2', name: 'Bob' })]);
    store.ui.update('user-2', { isSelected: true });

    expect(query.ui.getAll()).toEqual([
      { id: 'user-1', ...initialUserUiState },
      { id: 'user-2', ...initialUserUiState, isSelected: true },
    ]);
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

  /**
   * Verifies: userTheme$ starts at the light theme and emits each theme the store records.
   * Interacts with: real CurrentUserStore and CurrentUserQuery.userTheme$.
   * Data: the initial state, then dark, then light again.
   */
  it('userTheme$ emits the stored theme', () => {
    const store = TestBed.inject(CurrentUserStore);
    const query = TestBed.inject(CurrentUserQuery);
    const themes = recordEmissions(query.userTheme$);

    store.update({ theme: Theme.DARK });
    store.update({ name: 'Alice Analyst' });
    store.update({ theme: Theme.LIGHT });

    expect(themes).toEqual([Theme.LIGHT, Theme.DARK, Theme.LIGHT]);
  });
});
