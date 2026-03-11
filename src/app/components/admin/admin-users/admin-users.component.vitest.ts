// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { of } from 'rxjs';
import { AdminUsersComponent } from './admin-users.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { UserDataService } from 'src/app/data/user/user-data.service';
import { UserQuery } from 'src/app/data/user/user.query';
import { ComnSettingsService } from '@cmusei/crucible-common';

async function renderAdminUsers(
  overrides: {
    canEdit?: boolean;
    users?: any[];
  } = {},
) {
  const { canEdit = false, users = [] } = overrides;

  return renderComponent(AdminUsersComponent, {
    declarations: [AdminUsersComponent],
    providers: [
      {
        provide: PermissionDataService,
        useValue: {
          permissions: [],
          load: () => of([]),
          hasPermission: () => canEdit,
          canViewAdministration: () => false,
        },
      },
      {
        provide: UserDataService,
        useValue: {
          setCurrentUser: () => {},
          load: () => of(users),
          create: () => of({}),
          delete: () => of({}),
          update: () => {},
          setUserTheme: () => {},
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
        provide: ComnSettingsService,
        useValue: {
          settings: {
            ApiUrl: '',
            AppTitle: 'Blueprint',
            AppTopBarText: 'Blueprint',
            AppTopBarHexColor: '#0F1D47',
            AppTopBarHexTextColor: '#FFFFFF',
            AppTopBarImage: '',
          },
        },
      },
    ],
  });
}

describe('AdminUsersComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderAdminUsers();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should set canEdit to true when user has ManageUsers permission', async () => {
    const { fixture } = await renderAdminUsers({ canEdit: true });
    expect(fixture.componentInstance.canEdit).toBe(true);
  });

  it('should set canEdit to false when user lacks ManageUsers permission', async () => {
    const { fixture } = await renderAdminUsers({ canEdit: false });
    expect(fixture.componentInstance.canEdit).toBe(false);
  });

  it('should render the admin-user-list child component', async () => {
    const { fixture } = await renderAdminUsers();
    fixture.detectChanges();
    const el = fixture.nativeElement;
    expect(el.querySelector('app-admin-user-list')).toBeTruthy();
  });

  it('should initialize users$ observable from UserQuery', async () => {
    const testUsers = [
      { id: 'u1', name: 'Alice' },
      { id: 'u2', name: 'Bob' },
    ];
    const { fixture } = await renderAdminUsers({ users: testUsers });
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(component.users$).toBeTruthy();
  });
});
