// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, input } from '@angular/core';
import { By } from '@angular/platform-browser';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { Group, GroupService, SystemPermission, User, UserService } from 'src/app/generated/blueprint.api';
import { AdminGroupsComponent } from './admin-groups.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { permissionDataProviders } from 'src/app/test-utils/mock-permission-data.service';
import { unstubbed } from 'src/app/test-utils/unstubbed';
import { AdminGroupsDetailComponent } from './admin-groups-detail/admin-groups-detail.component';

@Component({ selector: 'app-admin-groups-detail', template: '' })
class GroupsDetailStub {
  readonly groupId = input<string>(undefined);
  readonly canEdit = input<boolean>(undefined);
}

const GROUP: Group = { id: 'group-1', name: 'Analysts' };
// Every system permission except ManageGroups: the near miss for the denied cases.
const ALL_BUT_MANAGE_GROUPS = Object.values(SystemPermission).filter((p) => p !== SystemPermission.ManageGroups);

async function renderGroups(permissions: SystemPermission[]) {
  const groupApi = {
    getGroups: vi.fn(() => of([structuredClone(GROUP)])),
    deleteGroup: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<GroupService>;
  const userApi = {
    getUsers: vi.fn(() => of<User[]>([])),
  } satisfies ApiStub<UserService>;
  // The user confirms every dialog.
  const confirm = vi.fn(() => dialogRefStub<unknown, boolean>(true).dialogRef);
  const dialog = { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>;
  const rendered = await renderComponent(AdminGroupsComponent, {
    imports: [
      MatButtonModule,
      MatFormFieldModule,
      MatIconModule,
      MatInputModule,
      MatSortModule,
      MatTableModule,
      MatTooltipModule,
    ],
    childStubs: [
      { replace: AdminGroupsDetailComponent, with: GroupsDetailStub },
    ],
    providers: [
      ...permissionDataProviders({ system: permissions }),
      { provide: GroupService, useValue: groupApi },
      { provide: UserService, useValue: userApi },
      { provide: CrucibleDialogService, useValue: dialog },
      unstubbed(MatDialog),
    ],
  });
  return { ...rendered, groupApi, userApi, confirm };
}

const table = () => screen.getByRole('table');
// The buttons carry only a tooltip, which Material exposes as the accessible description.
const buttonDescribed = (description: string) => within(table()).getByRole('button', { description });
const renameButton = () => within(within(table()).getByText('Analysts').closest('tr') as HTMLElement).getByRole('button', { description: 'Rename' });

describe('AdminGroupsComponent', () => {
  /**
   * Verifies: with ManageGroups the Add, Delete and Rename buttons are enabled, and the groups and users are loaded.
   * Interacts with: real PermissionDataService (grants: ManageGroups), GroupService.getGroups and UserService.getUsers (stubs).
   * Data: one group, Analysts.
   */
  it('enables group actions with ManageGroups', async () => {
    const { groupApi, userApi } = await renderGroups([SystemPermission.ManageGroups]);

    expect(groupApi.getGroups).toHaveBeenCalledTimes(1);
    expect(userApi.getUsers).toHaveBeenCalledTimes(1);
    expect(buttonDescribed('Add New Group')).toBeEnabled();
    expect(buttonDescribed('Delete Analysts')).toBeEnabled();
    expect(renameButton()).toBeEnabled();
  });

  /**
   * Verifies: without ManageGroups the Add, Delete and Rename buttons are disabled.
   * Interacts with: real PermissionDataService (grants: every permission but ManageGroups).
   * Data: near miss: ViewGroups and every other Manage permission.
   */
  it('disables group actions without ManageGroups', async () => {
    await renderGroups(ALL_BUT_MANAGE_GROUPS);

    expect(within(table()).getByText('Analysts')).toBeInTheDocument();
    expect(buttonDescribed('Add New Group')).toBeDisabled();
    expect(buttonDescribed('Delete Analysts')).toBeDisabled();
    expect(renameButton()).toBeDisabled();
  });

  /**
   * Verifies: expanding a group shows its detail with canEdit from ManageGroups, true when granted and false for the near miss.
   * Interacts with: row click, GroupsDetailStub inputs, real PermissionDataService.
   * Data: ManageGroups granted, or every other permission.
   */
  it.each([
    { granted: true, permissions: [SystemPermission.ManageGroups] },
    { granted: false, permissions: ALL_BUT_MANAGE_GROUPS },
  ])('passes canEdit $granted to the expanded group', async ({ granted, permissions }) => {
    const { fixture } = await renderGroups(permissions);
    const user = userEvent.setup();

    await user.click(within(table()).getByText('Analysts'));

    const detail = fixture.debugElement.query(By.directive(GroupsDetailStub)).componentInstance as GroupsDetailStub;
    expect(detail.groupId()).toBe('group-1');
    expect(detail.canEdit()).toBe(granted);
  });

  /**
   * Verifies: confirming Delete deletes the group through the API and removes it from the table.
   * Interacts with: CrucibleDialogService.confirm (stub, confirms), GroupService.deleteGroup (stub), real GroupDataService.
   * Data: ManageGroups granted.
   */
  it('deletes a group after confirmation', async () => {
    const { groupApi, confirm } = await renderGroups([SystemPermission.ManageGroups]);
    const user = userEvent.setup();

    await user.click(buttonDescribed('Delete Analysts'));

    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delete Group?' }));
    expect(groupApi.deleteGroup).toHaveBeenCalledWith('group-1');
    expect(within(table()).queryByText('Analysts')).not.toBeInTheDocument();
  });
});
