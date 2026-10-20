// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { SystemPermission, User, UserService } from 'src/app/generated/blueprint.api';
import { UserStore } from 'src/app/data/user/user.store';
import { UserQuery } from 'src/app/data/user/user.query';
import { AdminUsersComponent } from './admin-users.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { permissionDataProviders } from 'src/app/test-utils/mock-permission-data.service';
import { AdminUserListComponent } from './admin-user-list/admin-user-list.component';

@Component({ selector: 'app-admin-user-list', template: '' })
class UserListStub {
  @Input() users: User[];
  @Input() isLoading: boolean;
  @Input() canEdit: boolean;
  @Output() create = new EventEmitter<User>();
  @Output() delete = new EventEmitter<string>();
  @Output() updateUser = new EventEmitter<User>();
}

const ALICE: User = { id: 'user-a', name: 'Alice' };
// Every system permission except ManageUsers: the near miss for the denied case.
const ALL_BUT_MANAGE_USERS = Object.values(SystemPermission).filter((p) => p !== SystemPermission.ManageUsers);

async function renderUsers(permissions: SystemPermission[]) {
  const userApi = {
    createUser: vi.fn((user: User) => of(structuredClone(user))),
    deleteUser: vi.fn(() => of<unknown>(null)),
    updateUser: vi.fn((id: string, user: User) => of(structuredClone(user))),
  } satisfies ApiStub<UserService>;
  const rendered = await renderComponent(AdminUsersComponent, {
    childStubs: [
      { replace: AdminUserListComponent, with: UserListStub },
    ],
    providers: [
      ...permissionDataProviders({ system: permissions }),
      { provide: UserService, useValue: userApi },
      // The admin container loads the users; the store is seeded instead.
      {
        provide: UserStore,
        useFactory: () => {
          const store = new UserStore();
          store.set([structuredClone(ALICE)]);
          return store;
        },
      },
    ],
  });
  return { ...rendered, userApi };
}

function list(fixture: ComponentFixture<unknown>): UserListStub {
  return fixture.debugElement.query(By.directive(UserListStub)).componentInstance;
}

describe('AdminUsersComponent', () => {
  /**
   * Verifies: the user list gets the stored users and canEdit from ManageUsers, true when granted and false for the near miss.
   * Interacts with: real PermissionDataService, real UserQuery, UserListStub inputs.
   * Data: ManageUsers, or every other system permission (near miss); Alice in the store.
   */
  it.each([
    { granted: true, permissions: [SystemPermission.ManageUsers] },
    { granted: false, permissions: ALL_BUT_MANAGE_USERS },
  ])('passes canEdit $granted to the user list', async ({ granted, permissions }) => {
    const { fixture } = await renderUsers(permissions);

    expect(list(fixture).canEdit).toBe(granted);
    expect(list(fixture).users).toEqual([ALICE]);
    expect(list(fixture).isLoading).toBe(false);
  });

  /**
   * Verifies: the list's create, delete and update events call the user API and update the store.
   * Interacts with: UserListStub outputs, UserService (stub), real UserDataService and UserQuery.
   * Data: ManageUsers; Bob created, Alice renamed, then deleted.
   */
  it('creates, updates and deletes users from the list events', async () => {
    const { fixture, userApi } = await renderUsers([SystemPermission.ManageUsers]);
    const query = TestBed.inject(UserQuery);

    list(fixture).create.emit({ id: 'user-b', name: 'Bob' });
    list(fixture).updateUser.emit({ ...ALICE, roleId: 'role-1' });
    list(fixture).delete.emit('user-a');

    expect(userApi.createUser).toHaveBeenCalledWith({ id: 'user-b', name: 'Bob' });
    expect(userApi.updateUser).toHaveBeenCalledWith('user-a', { ...ALICE, roleId: 'role-1' });
    expect(userApi.deleteUser).toHaveBeenCalledWith('user-a');
    expect(query.getAll().map((u) => u.name)).toEqual(['Bob']);
  });
});
