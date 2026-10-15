// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { Group, GroupMembership, GroupService } from 'src/app/generated/blueprint.api';
import { GroupDataService } from './group-data.service';
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
    groupApi,
  };
}

const names = (list: Group[]) => list.map((g) => g.name);

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
