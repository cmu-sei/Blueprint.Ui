// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatToolbarModule } from '@angular/material/toolbar';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { ComnAuthQuery, ComnAuthService, Theme } from '@cmusei/crucible-common';
import { SystemPermission, SystemPermissionsService } from 'src/app/generated/blueprint.api';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { CurrentUserStore } from 'src/app/data/user/user.store';
import { UIDataService } from 'src/app/data/ui/ui-data.service';
import { TopbarComponent } from './topbar.component';
import { TopbarView } from './topbar.models';
import { renderComponent } from 'src/app/test-utils/render-component';
import { permissionApiStubs } from 'src/app/test-utils/mock-permission-data.service';

@Component({ selector: 'app-presence-bar', template: '' })
class PresenceBarStubComponent {}

async function renderTopbar(
  overrides: {
    permissions?: SystemPermission[];
    topbarView?: TopbarView;
    userName?: string;
  } = {},
) {
  const { permissions = [], topbarView = TopbarView.BLUEPRINT_HOME, userName = 'Alice Analyst' } =
    overrides;
  const logout = vi.fn();
  const setUserTheme = vi.fn();
  const auth: Pick<ComnAuthService, 'logout' | 'setUserTheme'> = { logout, setUserTheme };
  const authQuery: Pick<ComnAuthQuery, 'userTheme$'> = { userTheme$: of(Theme.LIGHT) };
  // TopbarComponent loads the permissions itself in ngOnInit, so the real
  // service is provided over the stubbed endpoint, without priming it.
  const permissionApis = permissionApiStubs({ system: permissions });

  const rendered = await renderComponent(TopbarComponent, {
    imports: [
      MatToolbarModule,
      MatIconModule,
      MatButtonModule,
      MatMenuModule,
      MatSlideToggleModule,
      PresenceBarStubComponent,
    ],
    declarations: [TopbarComponent],
    providers: [
      { provide: SystemPermissionsService, useValue: permissionApis.systemPermissions },
      PermissionDataService,
      { provide: ComnAuthService, useValue: auth },
      { provide: ComnAuthQuery, useValue: authQuery },
      // A real current-user store, seeded before the component reads it.
      {
        provide: CurrentUserStore,
        useFactory: () => {
          const store = new CurrentUserStore();
          store.update({ name: userName, id: 'user-1' });
          return store;
        },
      },
    ],
    inputs: { title: 'Blueprint', topbarView },
  });
  return { ...rendered, logout, setUserTheme, permissionApis };
}

async function openUserMenu(name = 'Alice Analyst') {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name }));
  return user;
}

describe('TopbarComponent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  /**
   * Verifies: the toolbar heading shows the title and the user menu is labelled with the current user's name.
   * Interacts with: real CurrentUserStore/CurrentUserQuery, TopbarComponent template.
   * Data: title "Blueprint", user "Alice Analyst".
   */
  it('shows the title and the signed-in user', async () => {
    await renderTopbar();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Blueprint');
    expect(screen.getByRole('button', { name: 'Alice Analyst' })).toBeInTheDocument();
  });

  /**
   * Verifies: without any View* system permission the user menu has no Administration entry.
   * Interacts with: real PermissionDataService over SystemPermissionsService.getMySystemPermissions (stub), mat-menu.
   * Data: every system permission that does not start with View (near miss: CreateMsels, every Manage*).
   */
  it('hides Administration without a View permission', async () => {
    const { permissionApis } = await renderTopbar({
      permissions: Object.values(SystemPermission).filter((p) => !p.startsWith('View')),
    });
    expect(permissionApis.systemPermissions.getMySystemPermissions).toHaveBeenCalledTimes(1);

    await openUserMenu();

    expect(screen.getByRole('menuitem', { name: 'Logout' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Administration' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Exit Administration' })).not.toBeInTheDocument();
  });

  /**
   * Verifies: any View* system permission adds an Administration entry that navigates to /admin with the current URL as returnUrl.
   * Interacts with: real PermissionDataService (grants: ViewUsers), mat-menu, routerLink → Router.navigateByUrl (spy).
   * Data: ViewUsers only; the router sits at "/".
   */
  it('shows Administration with a View permission', async () => {
    await renderTopbar({ permissions: [SystemPermission.ViewUsers] });
    const router = TestBed.inject(Router);
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    const user = await openUserMenu();
    await user.click(screen.getByRole('menuitem', { name: 'Administration' }));

    const [target] = navigateByUrl.mock.calls[0];
    expect(router.serializeUrl(target as UrlTree)).toBe('/admin?returnUrl=%2F');
  });

  /**
   * Verifies: inside the admin area the menu offers Exit Administration instead of Administration, even with View permissions.
   * Interacts with: real PermissionDataService (grants: ViewUsers), topbarView input.
   * Data: topbarView BLUEPRINT_ADMIN.
   */
  it('offers Exit Administration inside the admin area', async () => {
    await renderTopbar({
      permissions: [SystemPermission.ViewUsers],
      topbarView: TopbarView.BLUEPRINT_ADMIN,
    });

    await openUserMenu();

    expect(screen.getByRole('menuitem', { name: 'Exit Administration' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Administration' })).not.toBeInTheDocument();
  });

  /**
   * Verifies: Logout calls the auth service.
   * Interacts with: ComnAuthService.logout (spy), mat-menu.
   * Data: default user.
   */
  it('logs out from the menu', async () => {
    const { logout } = await renderTopbar();

    const user = await openUserMenu();
    await user.click(screen.getByRole('menuitem', { name: 'Logout' }));

    expect(logout).toHaveBeenCalledTimes(1);
  });

  /**
   * Verifies: the theme starts from the saved UI theme (light by default), and the Dark Theme toggle applies and saves the dark theme.
   * Interacts with: ComnAuthService.setUserTheme (spy), real UIDataService (localStorage), mat-slide-toggle.
   * Data: no saved theme; toggle switched on.
   */
  it('applies and saves the dark theme toggle', async () => {
    const { setUserTheme } = await renderTopbar();
    expect(setUserTheme).toHaveBeenCalledWith(Theme.LIGHT);

    const user = await openUserMenu();
    await user.click(screen.getByRole('switch', { name: 'Dark Theme' }));

    expect(setUserTheme).toHaveBeenLastCalledWith(Theme.DARK);
    expect(TestBed.inject(UIDataService).getTheme()).toBe(Theme.DARK);
  });
});
