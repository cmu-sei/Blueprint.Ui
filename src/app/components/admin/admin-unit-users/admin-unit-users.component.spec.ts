// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
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
import { of } from 'rxjs';
import { UnitUser, UnitUserService, User, UserService } from 'src/app/generated/blueprint.api';
import { UserStore } from 'src/app/data/user/user.store';
import { AdminUnitUsersComponent } from './admin-unit-users.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';

const ALICE: User = { id: 'user-a', name: 'Alice' };
const BOB: User = { id: 'user-b', name: 'Bob' };

async function renderUnitUsers(overrides: { canManage?: boolean } = {}) {
  const { canManage = true } = overrides;
  const userApi = {
    getUnitUsers: vi.fn(() => of([structuredClone(ALICE)])),
  } satisfies ApiStub<UserService>;
  const unitUserApi = {
    createUnitUser: vi.fn((unitUser: UnitUser) => of(structuredClone(unitUser))),
    deleteUnitUserByIds: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<UnitUserService>;
  const rendered = await renderComponent(AdminUnitUsersComponent, {
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
    declarations: [AdminUnitUsersComponent],
    providers: [
      { provide: UserService, useValue: userApi },
      { provide: UnitUserService, useValue: unitUserApi },
      // The admin container loads the users; the store is seeded instead.
      {
        provide: UserStore,
        useFactory: () => {
          const store = new UserStore();
          store.set(structuredClone([ALICE, BOB]));
          return store;
        },
      },
    ],
    inputs: { canManage, unitId: 'unit-1' },
  });
  return { ...rendered, userApi, unitUserApi };
}

// The first table lists users outside the unit, the second the unit's members.
const nonMembers = () => screen.getAllByRole('table')[0];
const members = () => screen.getAllByRole('table')[1];

describe('AdminUnitUsersComponent', () => {
  /**
   * Verifies: the unit's members load from the API, and the other users are offered to add.
   * Interacts with: UserService.getUnitUsers (stub), real UnitUserDataService, real UserQuery.
   * Data: Alice is a member of unit-1; Bob is not.
   */
  it('lists members and non-members', async () => {
    const { userApi } = await renderUnitUsers();

    expect(userApi.getUnitUsers).toHaveBeenCalledWith('unit-1');
    expect(within(members()).getByText('Alice')).toBeInTheDocument();
    expect(within(nonMembers()).getByText('Bob')).toBeInTheDocument();
    expect(within(nonMembers()).queryByText('Alice')).not.toBeInTheDocument();
  });

  /**
   * Verifies: with canManage, Add moves Bob into the members table and Remove moves Alice out, through the unit-user API.
   * Interacts with: UnitUserService.createUnitUser / deleteUnitUserByIds (stubs), real UnitUserDataService and UserQuery.
   * Data: canManage true; Bob added, Alice removed.
   */
  it('adds and removes unit users with canManage', async () => {
    const { fixture, unitUserApi } = await renderUnitUsers({ canManage: true });
    const user = userEvent.setup();

    await user.click(within(nonMembers()).getByRole('button', { name: 'Add Bob' }));
    expect(unitUserApi.createUnitUser).toHaveBeenCalledWith({ unitId: 'unit-1', userId: 'user-b' });
    fixture.detectChanges();
    expect(within(members()).getByText('Bob')).toBeInTheDocument();
    expect(within(nonMembers()).queryByText('Bob')).not.toBeInTheDocument();

    await user.click(within(members()).getByRole('button', { name: 'Remove Alice' }));
    expect(unitUserApi.deleteUnitUserByIds).toHaveBeenCalledWith('unit-1', 'user-a');
    fixture.detectChanges();
    expect(within(members()).queryByText('Alice')).not.toBeInTheDocument();
    expect(within(nonMembers()).getByText('Alice')).toBeInTheDocument();
  });

  /**
   * Verifies: without canManage the Add and Remove buttons are disabled.
   * Interacts with: AdminUnitUsersComponent template.
   * Data: canManage false; Alice a member, Bob not.
   */
  it('disables Add and Remove without canManage', async () => {
    await renderUnitUsers({ canManage: false });

    expect(within(nonMembers()).getByRole('button', { name: 'Add Bob' })).toBeDisabled();
    expect(within(members()).getByRole('button', { name: 'Remove Alice' })).toBeDisabled();
  });
});
