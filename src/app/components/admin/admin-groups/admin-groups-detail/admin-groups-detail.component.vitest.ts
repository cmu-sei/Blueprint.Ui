// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { of } from 'rxjs';
import { AdminGroupsDetailComponent } from './admin-groups-detail.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { GroupMembershipDataService } from 'src/app/data/group/group-membership-data.service';
import { UserQuery } from 'src/app/data/user/user.query';
import { SignalRService } from 'src/app/services/signalr.service';

async function renderGroupsDetail(
  overrides: {
    groupId?: string;
    canEdit?: boolean;
    users?: any[];
    memberships?: any[];
  } = {},
) {
  const {
    groupId = 'group-1',
    canEdit = false,
    users = [],
    memberships = [],
  } = overrides;

  return renderComponent(AdminGroupsDetailComponent, {
    declarations: [AdminGroupsDetailComponent],
    providers: [
      {
        provide: GroupMembershipDataService,
        useValue: {
          loadMemberships: () => of(memberships),
          selectMemberships: () => of(memberships),
          createMembership: () => of({}),
          deleteMembership: () => of({}),
        },
      },
      {
        provide: UserQuery,
        useValue: {
          selectAll: () => of(users),
          select: () => of(null),
          selectEntity: () => of(null),
          selectLoading: () => of(false),
        },
      },
      {
        provide: SignalRService,
        useValue: {
          startConnection: () => Promise.resolve(),
          join: () => {},
          leave: () => {},
          selectMsel: () => {},
        },
      },
    ],
    componentProperties: {
      groupId,
      canEdit,
    },
  });
}

describe('AdminGroupsDetailComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderGroupsDetail();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should set groupId from input', async () => {
    const { fixture } = await renderGroupsDetail({ groupId: 'my-group' });
    expect(fixture.componentInstance.groupId).toBe('my-group');
  });

  it('should set canEdit from input', async () => {
    const { fixture } = await renderGroupsDetail({ canEdit: true });
    expect(fixture.componentInstance.canEdit).toBe(true);
  });

  it('should render child components for members and non-members', async () => {
    const { fixture } = await renderGroupsDetail();
    fixture.detectChanges();
    const el = fixture.nativeElement;
    expect(
      el.querySelector('app-admin-groups-membership-list'),
    ).toBeTruthy();
    expect(el.querySelector('app-admin-groups-member-list')).toBeTruthy();
  });
});
