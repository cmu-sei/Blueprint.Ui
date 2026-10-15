// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatToolbarModule } from '@angular/material/toolbar';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ClipboardModule } from 'ngx-clipboard';
import { User } from 'src/app/generated/blueprint.api';
import { AdminGroupsMembershipListComponent } from './admin-groups-membership-list.component';
import { renderComponent } from 'src/app/test-utils/render-component';

const USERS: User[] = [{ id: 'user-b', name: 'Bob' }];

async function renderMembershipList(overrides: { canEdit?: boolean } = {}) {
  const { canEdit = true } = overrides;
  const rendered = await renderComponent(AdminGroupsMembershipListComponent, {
    imports: [
      ClipboardModule,
      MatButtonModule,
      MatFormFieldModule,
      MatIconModule,
      MatInputModule,
      MatPaginatorModule,
      MatSnackBarModule,
      MatSortModule,
      MatTableModule,
      MatToolbarModule,
    ],
    declarations: [AdminGroupsMembershipListComponent],
    inputs: { canEdit, users: USERS },
  });
  const added: string[] = [];
  rendered.fixture.componentInstance.createMembership.subscribe((id) => added.push(id));
  return { ...rendered, added };
}

const table = () => screen.getByRole('table');

describe('AdminGroupsMembershipListComponent', () => {
  /**
   * Verifies: with canEdit each non-member has an Add button that emits the user id.
   * Interacts with: createMembership output, AdminGroupsMembershipListComponent template.
   * Data: canEdit true; Bob is not a member.
   */
  it('adds a user with canEdit', async () => {
    const { added } = await renderMembershipList({ canEdit: true });
    const user = userEvent.setup();

    await user.click(within(table()).getByRole('button', { name: 'Add Bob' }));

    expect(added).toEqual(['user-b']);
  });

  /**
   * Verifies: without canEdit the users are listed (with their copy-id button) but the Add column is not rendered.
   * Interacts with: AdminGroupsMembershipListComponent.displayedColumns.
   * Data: canEdit false; Bob is not a member.
   */
  it('hides Add without canEdit', async () => {
    await renderMembershipList({ canEdit: false });

    expect(within(table()).getByText('Bob')).toBeInTheDocument();
    expect(within(table()).getByRole('button', { name: 'Copy: user-b' })).toBeInTheDocument();
    expect(within(table()).queryByRole('button', { name: 'Add Bob' })).not.toBeInTheDocument();
  });
});
