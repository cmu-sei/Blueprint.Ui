// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { ClipboardModule } from 'ngx-clipboard';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { SystemRole, SystemRolesService, User } from 'src/app/generated/blueprint.api';
import { AdminUserListComponent } from './admin-user-list.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';

const ALICE: User = { id: 'user-a', name: 'Alice' };
const ROLES: SystemRole[] = [{ id: 'role-1', name: 'Content Developer' }];

async function renderUserList(overrides: { canEdit?: boolean } = {}) {
  const { canEdit = true } = overrides;
  const rolesApi = {
    getSystemRoles: vi.fn(() => of(structuredClone(ROLES))),
  } satisfies ApiStub<SystemRolesService>;
  // The user confirms every dialog.
  const confirm = vi.fn(() => dialogRefStub<unknown, boolean>(true).dialogRef);
  const dialog = { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>;
  const rendered = await renderComponent(AdminUserListComponent, {
    imports: [
      ClipboardModule,
      MatButtonModule,
      MatCardModule,
      MatFormFieldModule,
      MatIconModule,
      MatInputModule,
      MatPaginatorModule,
      MatProgressSpinnerModule,
      MatSelectModule,
      MatSortModule,
      MatTableModule,
      MatTooltipModule,
    ],
    declarations: [AdminUserListComponent],
    providers: [
      { provide: SystemRolesService, useValue: rolesApi },
      { provide: CrucibleDialogService, useValue: dialog },
    ],
    inputs: { canEdit, users: [ALICE], isLoading: false },
  });
  const events = { created: [] as User[], deleted: [] as string[], updated: [] as User[] };
  rendered.fixture.componentInstance.create.subscribe((u) => events.created.push(u));
  rendered.fixture.componentInstance.delete.subscribe((id) => events.deleted.push(id));
  rendered.fixture.componentInstance.updateUser.subscribe((u) => events.updated.push(u));
  return { ...rendered, rolesApi, confirm, events };
}

const table = () => screen.getByRole('table');

describe('AdminUserListComponent', () => {
  /**
   * Verifies: with canEdit the Add User button and the role select are enabled and each user has a Delete button.
   * Interacts with: AdminUserListComponent template, SystemRolesService.getSystemRoles (stub).
   * Data: canEdit true; Alice.
   */
  it('enables user management with canEdit', async () => {
    const { rolesApi } = await renderUserList({ canEdit: true });

    expect(rolesApi.getSystemRoles).toHaveBeenCalledTimes(1);
    expect(within(table()).getByTitle('Add User')).toBeEnabled();
    expect(within(table()).getByRole('combobox')).toHaveAttribute('aria-disabled', 'false');
    expect(within(table()).getByTitle('Delete User')).toBeInTheDocument();
  });

  /**
   * Verifies: without canEdit Add User and the role select are disabled and no Delete button is rendered.
   * Interacts with: AdminUserListComponent template.
   * Data: canEdit false; Alice.
   */
  it('disables user management without canEdit', async () => {
    await renderUserList({ canEdit: false });

    expect(within(table()).getByText('Alice')).toBeInTheDocument();
    expect(within(table()).getByTitle('Add User')).toBeDisabled();
    expect(within(table()).getByRole('combobox')).toHaveAttribute('aria-disabled', 'true');
    expect(within(table()).queryByTitle('Delete User')).not.toBeInTheDocument();
  });

  /**
   * Verifies: choosing a role emits the user with that role id.
   * Interacts with: mat-select selectionChange, updateUser output.
   * Data: canEdit true; Alice gets Content Developer.
   */
  it('emits the user with the chosen role', async () => {
    const { events } = await renderUserList({ canEdit: true });
    const user = userEvent.setup();

    await user.click(within(table()).getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'Content Developer' }));

    expect(events.updated).toEqual([{ ...ALICE, roleId: 'role-1' }]);
  });

  /**
   * Verifies: confirming Delete emits the user id.
   * Interacts with: CrucibleDialogService.confirm (stub, confirms), delete output.
   * Data: canEdit true; Alice.
   */
  it('emits delete after confirmation', async () => {
    const { confirm, events } = await renderUserList({ canEdit: true });
    const user = userEvent.setup();

    await user.click(within(table()).getByTitle('Delete User'));

    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delete Alice?' }));
    expect(events.deleted).toEqual(['user-a']);
  });

  /**
   * Verifies: Add User opens a row for the new user, and adding emits its id and name.
   * Interacts with: Add User button, new-user inputs, create output.
   * Data: canEdit true; new user u-9 / Chaz.
   */
  it('emits a new user from the add row', async () => {
    const { events } = await renderUserList({ canEdit: true });
    const user = userEvent.setup();

    await user.click(within(table()).getByTitle('Add User'));
    await user.type(screen.getByPlaceholderText('User ID'), 'u-9');
    await user.type(screen.getByPlaceholderText('User Name'), 'Chaz');
    // The add button has an icon and no accessible name; it is the first button of the add row.
    const addRow = document.querySelector('.new-user-row') as HTMLElement;
    await user.click(within(addRow).getAllByRole('button')[0]);

    expect(events.created).toEqual([{ id: 'u-9', name: 'Chaz' }]);
  });
});
