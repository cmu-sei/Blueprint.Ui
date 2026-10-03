// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { Group, GroupMembership, GroupService } from 'src/app/generated/blueprint.api';
import { GroupDataService } from './group-data.service';
import { GroupMembershipDataService } from './group-membership-data.service';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { recordEmissions } from 'src/app/test-utils/record-emissions';

function setup() {
  const groupApi = {
    getGroups: vi.fn(() => of<Group[]>([])),
    createGroup: vi.fn(() => of<Group>({})),
    updateGroup: vi.fn(() => of<Group>({})),
    deleteGroup: vi.fn(() => of<unknown>(null)),
    getGroupMemberships: vi.fn((_groupId: string) => of<GroupMembership[]>([])),
    createGroupMembership: vi.fn(() => of<GroupMembership>({})),
    deleteGroupMembership: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<GroupService>;
  TestBed.configureTestingModule({
    providers: [{ provide: GroupService, useValue: groupApi }],
  });
  return {
    groups: TestBed.inject(GroupDataService),
    memberships: TestBed.inject(GroupMembershipDataService),
    groupApi,
  };
}

const names = (list: Group[]) => list.map((g) => g.name);
const memberIds = (list: GroupMembership[]) => list.map((m) => m.userId);

describe('GroupDataService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: load publishes the groups; create appends; edit replaces a known group; delete removes it.
   * Interacts with: GroupService getGroups / createGroup / updateGroup / deleteGroup (stubs), groups$.
   * Data: Analysts loaded, Planners created and renamed, Analysts deleted.
   */
  it('load, create, edit and delete keep groups$ current', async () => {
    const { groups, groupApi } = setup();
    const emitted = recordEmissions(groups.groups$);
    groupApi.getGroups.mockReturnValue(of([{ id: 'g-1', name: 'Analysts' }]));
    groupApi.createGroup.mockReturnValue(of({ id: 'g-2', name: 'Planners' }));
    groupApi.updateGroup.mockReturnValue(of({ id: 'g-2', name: 'Exercise Planners' }));
    groupApi.deleteGroup.mockReturnValue(of(null));

    await firstValueFrom(groups.load());
    expect(names(emitted.at(-1))).toEqual(['Analysts']);

    await firstValueFrom(groups.create({ name: 'Planners' }));
    expect(names(emitted.at(-1))).toEqual(['Analysts', 'Planners']);

    await firstValueFrom(groups.edit({ id: 'g-2', name: 'Exercise Planners' }));
    expect(groupApi.updateGroup).toHaveBeenCalledWith('g-2', { id: 'g-2', name: 'Exercise Planners' });
    expect(names(emitted.at(-1))).toEqual(['Analysts', 'Exercise Planners']);

    await firstValueFrom(groups.delete('g-1'));
    expect(names(emitted.at(-1))).toEqual(['Exercise Planners']);
  });

  /**
   * Verifies: editing a group the list does not hold publishes nothing.
   * Interacts with: GroupService.updateGroup (stub), groups$.
   * Data: an empty list; g-9 edited.
   */
  it('edit of an unknown group publishes nothing', async () => {
    const { groups, groupApi } = setup();
    const emitted = recordEmissions(groups.groups$);
    groupApi.updateGroup.mockReturnValue(of({ id: 'g-9', name: 'Ghost' }));

    await firstValueFrom(groups.edit({ id: 'g-9', name: 'Ghost' }));

    expect(emitted).toEqual([[]]);
  });
});

describe('GroupMembershipDataService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: loadMemberships merges a group's memberships into the shared list, and selectMemberships filters it per group.
   * Interacts with: GroupService.getGroupMemberships (stub), groupMemberships$ / selectMemberships.
   * Data: g-1 with user-1 and user-2, g-2 with user-3, then g-1 reloaded with user-1 only.
   */
  it('loadMemberships merges per group', async () => {
    const { memberships, groupApi } = setup();
    groupApi.getGroupMemberships.mockImplementation((groupId: string) =>
      of(
        groupId === 'g-1'
          ? [
              { id: 'm-1', groupId: 'g-1', userId: 'user-1' },
              { id: 'm-2', groupId: 'g-1', userId: 'user-2' },
            ]
          : [{ id: 'm-3', groupId: 'g-2', userId: 'user-3' }],
      ),
    );
    const g1 = recordEmissions(memberships.selectMemberships('g-1'));

    await firstValueFrom(memberships.loadMemberships('g-1'));
    await firstValueFrom(memberships.loadMemberships('g-2'));

    expect(memberIds(g1.at(-1))).toEqual(['user-1', 'user-2']);
    expect(memberIds(recordEmissions(memberships.groupMemberships$).at(-1))).toEqual([
      'user-1',
      'user-2',
      'user-3',
    ]);
  });

  /**
   * Verifies: createMembership and updateStore upsert memberships; deleteMembership and deleteFromStore remove them.
   * Interacts with: GroupService.createGroupMembership / deleteGroupMembership (stubs), groupMemberships$.
   * Data: m-1 created, m-2 arriving by event, m-1 deleted, m-2 removed by event.
   */
  it('create, delete and events keep the memberships current', async () => {
    const { memberships, groupApi } = setup();
    const emitted = recordEmissions(memberships.groupMemberships$);
    groupApi.createGroupMembership.mockReturnValue(of({ id: 'm-1', groupId: 'g-1', userId: 'user-1' }));
    groupApi.deleteGroupMembership.mockReturnValue(of(null));

    await firstValueFrom(memberships.createMembership('g-1', { groupId: 'g-1', userId: 'user-1' }));
    expect(groupApi.createGroupMembership).toHaveBeenCalledWith('g-1', { groupId: 'g-1', userId: 'user-1' });
    memberships.updateStore({ id: 'm-2', groupId: 'g-1', userId: 'user-2' });
    memberships.updateStore({ id: 'm-2', groupId: 'g-1', userId: 'user-9' });
    expect(memberIds(emitted.at(-1))).toEqual(['user-1', 'user-9']);

    await firstValueFrom(memberships.deleteMembership('m-1'));
    memberships.deleteFromStore('m-2');
    expect(emitted.at(-1)).toEqual([]);
  });
});
