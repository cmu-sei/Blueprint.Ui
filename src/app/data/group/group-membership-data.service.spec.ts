// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Observable, firstValueFrom, of, throwError } from 'rxjs';
import { Group, GroupMembership, GroupService } from 'src/app/generated/blueprint.api';
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
    memberships: TestBed.inject(GroupMembershipDataService),
    groupApi,
  };
}

const memberIds = (list: GroupMembership[]) => list.map((m) => m.userId);

describe('GroupMembershipDataService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: loadMemberships merges a group's memberships into the shared list, and selectMemberships filters it per group.
   * Interacts with: GroupService.getGroupMemberships (stub), groupMemberships$ / selectMemberships.
   * Data: g-1 with user-1 and user-2, g-2 with user-3.
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

  /**
   * Verifies: a reload of a group replaces each membership it returns in place, and loadMemberships stays cold until subscribed.
   * Interacts with: GroupService.getGroupMemberships (stub), groupMemberships$.
   * Data: g-1 loaded with m-1 (user-1) and m-2 (user-2); the reload returns m-1 moved to user-9.
   */
  it('loadMemberships replaces the memberships it returns again', async () => {
    const { memberships, groupApi } = setup();
    groupApi.getGroupMemberships.mockReturnValue(
      of([
        { id: 'm-1', groupId: 'g-1', userId: 'user-1' },
        { id: 'm-2', groupId: 'g-1', userId: 'user-2' },
      ]),
    );
    await firstValueFrom(memberships.loadMemberships('g-1'));
    groupApi.getGroupMemberships.mockReturnValue(of([{ id: 'm-1', groupId: 'g-1', userId: 'user-9' }]));

    const reload$ = memberships.loadMemberships('g-1');
    expect(memberIds(recordEmissions(memberships.groupMemberships$).at(-1))).toEqual(['user-1', 'user-2']);
    await firstValueFrom(reload$);

    expect(groupApi.getGroupMemberships).toHaveBeenLastCalledWith('g-1');
    expect(memberIds(recordEmissions(memberships.selectMemberships('g-1')).at(-1))).toEqual(['user-9', 'user-2']);
  });

  /**
   * Verifies: a reload keeps a membership the API no longer returns for that group (current behavior).
   * Interacts with: GroupService.getGroupMemberships (stub), selectMemberships.
   * Data: g-1 loaded with m-1 (user-1) and m-2 (user-2); the reload returns m-1 only.
   */
  it('loadMemberships keeps a membership the reload no longer returns', async () => {
    const { memberships, groupApi } = setup();
    groupApi.getGroupMemberships.mockReturnValue(
      of([
        { id: 'm-1', groupId: 'g-1', userId: 'user-1' },
        { id: 'm-2', groupId: 'g-1', userId: 'user-2' },
      ]),
    );
    await firstValueFrom(memberships.loadMemberships('g-1'));
    groupApi.getGroupMemberships.mockReturnValue(of([{ id: 'm-1', groupId: 'g-1', userId: 'user-1' }]));

    const reloaded = await firstValueFrom(memberships.loadMemberships('g-1'));

    expect(memberIds(reloaded)).toEqual(['user-1']);
    // Current behavior; see agent-docs/ui-test-bugs/blueprint.ui.md.
    expect(memberIds(recordEmissions(memberships.selectMemberships('g-1')).at(-1))).toEqual(['user-1', 'user-2']);
  });

  /**
   * Verifies: selectMemberships emits only the named group's memberships, an empty list for a group with none, and follows later changes.
   * Interacts with: selectMemberships, updateStore, deleteFromStore.
   * Data: m-1 in g-1, m-2 in g-2, then m-3 added to g-1 and m-1 removed.
   */
  it('selectMemberships filters to one group', () => {
    const { memberships } = setup();
    memberships.updateStore({ id: 'm-1', groupId: 'g-1', userId: 'user-1' });
    memberships.updateStore({ id: 'm-2', groupId: 'g-2', userId: 'user-2' });
    const g1 = recordEmissions(memberships.selectMemberships('g-1'));
    const empty = recordEmissions(memberships.selectMemberships('g-3'));

    memberships.updateStore({ id: 'm-3', groupId: 'g-1', userId: 'user-3' });
    memberships.deleteFromStore('m-1');

    expect(g1.map(memberIds)).toEqual([['user-1'], ['user-1', 'user-3'], ['user-3']]);
    expect(empty.at(-1)).toEqual([]);
  });

  /**
   * Verifies: upsert merges a partial change into the stored membership, and removing an unknown id leaves the list as it was.
   * Interacts with: upsert, remove, groupMemberships$.
   * Data: m-1 (g-1, user-1) stored; userId changed to user-2; m-404 removed.
   */
  it('upsert merges a partial change and remove ignores an unknown id', () => {
    const { memberships } = setup();
    memberships.updateStore({ id: 'm-1', groupId: 'g-1', userId: 'user-1' });

    memberships.upsert('m-1', { userId: 'user-2' });
    memberships.remove('m-404');

    expect(recordEmissions(memberships.groupMemberships$).at(-1)).toEqual([
      { id: 'm-1', groupId: 'g-1', userId: 'user-2' },
    ]);
  });

  /**
   * Verifies: a failed request reaches the caller and leaves the stored memberships as they were.
   * Interacts with: GroupService getGroupMemberships / createGroupMembership / deleteGroupMembership (stubs erroring), groupMemberships$.
   * Data: m-1 (g-1, user-1) stored; each endpoint fails with "request failed".
   */
  it.each([
    {
      method: 'loadMemberships',
      endpoint: 'getGroupMemberships',
      call: (s: GroupMembershipDataService): Observable<unknown> => s.loadMemberships('g-1'),
    },
    {
      method: 'createMembership',
      endpoint: 'createGroupMembership',
      call: (s: GroupMembershipDataService): Observable<unknown> =>
        s.createMembership('g-1', { groupId: 'g-1', userId: 'user-2' }),
    },
    {
      method: 'deleteMembership',
      endpoint: 'deleteGroupMembership',
      call: (s: GroupMembershipDataService): Observable<unknown> => s.deleteMembership('m-1'),
    },
  ] as const)('$method passes a failed request to the caller and keeps the memberships', async ({ endpoint, call }) => {
    const { memberships, groupApi } = setup();
    memberships.updateStore({ id: 'm-1', groupId: 'g-1', userId: 'user-1' });
    const emitted = recordEmissions(memberships.groupMemberships$);
    const failure = new Error('request failed');
    groupApi[endpoint].mockReturnValue(throwError(() => failure));

    await expect(firstValueFrom(call(memberships))).rejects.toBe(failure);

    expect(emitted).toHaveLength(1);
    expect(memberIds(emitted[0])).toEqual(['user-1']);
  });
});
