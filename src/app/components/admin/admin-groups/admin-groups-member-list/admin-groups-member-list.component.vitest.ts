// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { AdminGroupsMemberListComponent } from './admin-groups-member-list.component';
import { renderComponent } from 'src/app/test-utils/render-component';

async function renderMemberList(
  overrides: {
    canEdit?: boolean;
    memberships?: any[];
    users?: any[];
  } = {},
) {
  const { canEdit = false, memberships = [], users = [] } = overrides;

  return renderComponent(AdminGroupsMemberListComponent, {
    declarations: [AdminGroupsMemberListComponent],
    imports: [MatTableModule, MatSortModule, MatPaginatorModule],
    componentProperties: {
      canEdit,
      memberships,
      users,
    },
  });
}

describe('AdminGroupsMemberListComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderMemberList();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display Group Members header', async () => {
    await renderMemberList();
    expect(screen.getByText('Group Members')).toBeInTheDocument();
  });

  it('should show empty message when no members exist', async () => {
    await renderMemberList({ memberships: [], users: [] });
    expect(
      screen.getByText('This Group currently has no members'),
    ).toBeInTheDocument();
  });

  it('should show actions column when canEdit is true', async () => {
    const memberships = [
      { id: 'mem-1', groupId: 'g1', userId: 'u1' },
    ];
    const users = [{ id: 'u1', name: 'Alice' }];
    const { fixture } = await renderMemberList({
      canEdit: true,
      memberships,
      users,
    });
    fixture.detectChanges();
    expect(fixture.componentInstance.displayedColumns).toContain('actions');
  });

  it('should hide actions column when canEdit is false', async () => {
    const { fixture } = await renderMemberList({ canEdit: false });
    fixture.detectChanges();
    expect(fixture.componentInstance.displayedColumns).not.toContain('actions');
  });
});
