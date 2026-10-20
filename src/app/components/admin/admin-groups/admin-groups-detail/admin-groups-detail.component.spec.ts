// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, EventEmitter, Input, Output, Type } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { GroupMembership, GroupService, User } from 'src/app/generated/blueprint.api';
import { UserStore } from 'src/app/data/user/user.store';
import { AdminGroupsDetailComponent } from './admin-groups-detail.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { AdminGroupsMembershipListComponent } from '../admin-groups-membership-list/admin-groups-membership-list.component';
import { AdminGroupsMemberListComponent } from '../admin-groups-member-list/admin-groups-member-list.component';

@Component({ selector: 'app-admin-groups-membership-list', template: '' })
class MembershipListStub {
  @Input() users: User[];
  @Input() canEdit: boolean;
  @Output() createMembership = new EventEmitter<string>();
}
@Component({ selector: 'app-admin-groups-member-list', template: '' })
class MemberListStub {
  @Input() memberships: GroupMembership[];
  @Input() users: User[];
  @Input() canEdit: boolean;
  @Output() deleteMembership = new EventEmitter<string>();
}

const USERS: User[] = [
  { id: 'user-a', name: 'Alice' },
  { id: 'user-b', name: 'Bob' },
];
const MEMBERSHIP: GroupMembership = { id: 'gm-1', groupId: 'group-1', userId: 'user-a' };

async function renderDetail(overrides: { canEdit?: boolean } = {}) {
  const { canEdit = true } = overrides;
  const groupApi = {
    getGroupMemberships: vi.fn(() => of([structuredClone(MEMBERSHIP)])),
    createGroupMembership: vi.fn(() => of<GroupMembership>({ id: 'gm-2', groupId: 'group-1', userId: 'user-b' })),
    deleteGroupMembership: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<GroupService>;
  const rendered = await renderComponent(AdminGroupsDetailComponent, {
    childStubs: [
      { replace: AdminGroupsMembershipListComponent, with: MembershipListStub },
      { replace: AdminGroupsMemberListComponent, with: MemberListStub },
    ],
    providers: [
      { provide: GroupService, useValue: groupApi },
      // The groups page loads the users; the store is seeded instead.
      {
        provide: UserStore,
        useFactory: () => {
          const store = new UserStore();
          store.set(structuredClone(USERS));
          return store;
        },
      },
    ],
    inputs: { canEdit, groupId: 'group-1' },
  });
  return { ...rendered, groupApi };
}

function child<T>(fixture: ComponentFixture<unknown>, stub: Type<T>): T {
  return fixture.debugElement.query(By.directive(stub)).componentInstance;
}
const names = (users: User[]) => users.map((u) => u.name);

describe('AdminGroupsDetailComponent', () => {
  /**
   * Verifies: the group's memberships are loaded and split the users into members and non-members.
   * Interacts with: GroupService.getGroupMemberships (stub), real GroupMembershipDataService, real UserQuery.
   * Data: Alice is a member of group-1, Bob is not.
   */
  it('splits users into members and non-members', async () => {
    const { fixture, groupApi } = await renderDetail();

    expect(groupApi.getGroupMemberships).toHaveBeenCalledWith('group-1');
    expect(names(child(fixture, MemberListStub).users)).toEqual(['Alice']);
    expect(child(fixture, MemberListStub).memberships).toEqual([MEMBERSHIP]);
    expect(names(child(fixture, MembershipListStub).users)).toEqual(['Bob']);
  });

  /**
   * Verifies: canEdit is passed to both membership lists, as true and as false.
   * Interacts with: child stubs' canEdit inputs.
   * Data: canEdit true and false.
   */
  it.each([true, false])('passes canEdit %s to both lists', async (canEdit) => {
    const { fixture } = await renderDetail({ canEdit });

    expect(child(fixture, MembershipListStub).canEdit).toBe(canEdit);
    expect(child(fixture, MemberListStub).canEdit).toBe(canEdit);
  });

  /**
   * Verifies: the lists' add and remove events create and delete memberships through the API.
   * Interacts with: child stub outputs, GroupService.createGroupMembership / deleteGroupMembership (stubs).
   * Data: Bob is added, Alice's membership removed.
   */
  it('creates and deletes memberships from the list events', async () => {
    const { fixture, groupApi } = await renderDetail();

    child(fixture, MembershipListStub).createMembership.emit('user-b');
    child(fixture, MemberListStub).deleteMembership.emit('gm-1');

    expect(groupApi.createGroupMembership).toHaveBeenCalledWith('group-1', { groupId: 'group-1', userId: 'user-b' });
    expect(groupApi.deleteGroupMembership).toHaveBeenCalledWith('gm-1');
  });
});
