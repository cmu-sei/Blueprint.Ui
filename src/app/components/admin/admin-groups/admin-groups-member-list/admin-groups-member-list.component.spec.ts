// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatToolbarModule } from '@angular/material/toolbar';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { GroupMembership, User } from 'src/app/generated/blueprint.api';
import { AdminGroupsMemberListComponent } from './admin-groups-member-list.component';
import { renderComponent } from 'src/app/test-utils/render-component';

const USERS: User[] = [{ id: 'user-a', name: 'Alice' }];
const MEMBERSHIPS: GroupMembership[] = [{ id: 'gm-1', groupId: 'group-1', userId: 'user-a' }];

async function renderMemberList(overrides: { canEdit?: boolean } = {}) {
  const { canEdit = true } = overrides;
  const rendered = await renderComponent(AdminGroupsMemberListComponent, {
    imports: [
      MatButtonModule,
      MatFormFieldModule,
      MatIconModule,
      MatInputModule,
      MatPaginatorModule,
      MatSortModule,
      MatTableModule,
      MatToolbarModule,
    ],
    declarations: [AdminGroupsMemberListComponent],
    inputs: { canEdit, users: USERS, memberships: MEMBERSHIPS },
  });
  const deleted: string[] = [];
  rendered.fixture.componentInstance.deleteMembership.subscribe((id) => deleted.push(id));
  return { ...rendered, deleted };
}

const table = () => screen.getByRole('table');

describe('AdminGroupsMemberListComponent', () => {
  /**
   * Verifies: with canEdit each member has a Remove button that emits the membership id.
   * Interacts with: deleteMembership output, AdminGroupsMemberListComponent template.
   * Data: canEdit true; Alice is a member.
   */
  it('removes a member with canEdit', async () => {
    const { deleted } = await renderMemberList({ canEdit: true });
    const user = userEvent.setup();

    expect(within(table()).getByText('Alice')).toBeInTheDocument();
    await user.click(within(table()).getByRole('button', { name: 'Remove Alice' }));

    expect(deleted).toEqual(['gm-1']);
  });

  /**
   * Verifies: without canEdit the members are listed but the Remove column is not rendered.
   * Interacts with: AdminGroupsMemberListComponent.displayedColumns.
   * Data: canEdit false; Alice is a member.
   */
  it('hides Remove without canEdit', async () => {
    await renderMemberList({ canEdit: false });

    expect(within(table()).getByText('Alice')).toBeInTheDocument();
    expect(within(table()).queryByRole('button', { name: 'Remove Alice' })).not.toBeInTheDocument();
  });
});
