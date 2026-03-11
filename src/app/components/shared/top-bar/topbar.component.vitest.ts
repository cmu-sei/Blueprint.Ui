// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import { of } from 'rxjs';
import { TopbarComponent } from './topbar.component';
import { TopbarView } from './topbar.models';
import { renderComponent } from 'src/app/test-utils/render-component';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { CurrentUserQuery } from 'src/app/data/user/user.query';
import { UIDataService } from 'src/app/data/ui/ui-data.service';
import { ComnAuthService, ComnAuthQuery, Theme } from '@cmusei/crucible-common';

async function renderTopbar(
  overrides: {
    title?: string;
    topbarView?: TopbarView;
    canViewAdmin?: boolean;
  } = {},
) {
  const {
    title = 'Test Title',
    topbarView = TopbarView.BLUEPRINT_HOME,
    canViewAdmin = false,
  } = overrides;

  return renderComponent(TopbarComponent, {
    declarations: [TopbarComponent],
    providers: [
      {
        provide: PermissionDataService,
        useValue: {
          permissions: [],
          load: () => of([]),
          hasPermission: () => false,
          canViewAdministration: () => canViewAdmin,
        },
      },
      {
        provide: CurrentUserQuery,
        useValue: {
          userTheme$: of('light-theme'),
          select: () =>
            of({ name: 'Test User', id: 'user-1', theme: 'light-theme' }),
        },
      },
      {
        provide: UIDataService,
        useValue: {
          inIframe: () => false,
          getTheme: () => Theme.LIGHT,
          setTheme: () => {},
        },
      },
      {
        provide: ComnAuthService,
        useValue: {
          isAuthenticated$: of(true),
          user$: of({}),
          logout: vi.fn(),
          setUserTheme: vi.fn(),
        },
      },
      {
        provide: ComnAuthQuery,
        useValue: {
          userTheme$: of('light-theme'),
          isLoggedIn$: of(true),
        },
      },
    ],
    componentProperties: {
      title,
      topbarView,
    },
  });
}

describe('TopbarComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderTopbar();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display title from input', async () => {
    await renderTopbar({ title: 'My Custom Title' });
    expect(screen.getByText('My Custom Title')).toBeInTheDocument();
  });

  it('should show user name in menu button', async () => {
    await renderTopbar();
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('should show Administration link when canViewAdmin is true and not in admin view', async () => {
    const { fixture } = await renderTopbar({
      canViewAdmin: true,
      topbarView: TopbarView.BLUEPRINT_HOME,
    });
    // Need to trigger change detection after ngOnInit sets canViewAdmin
    fixture.detectChanges();
    // Open the menu by clicking the user button
    const menuButton = screen.getByText('Test User');
    menuButton.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(screen.getByText('Administration')).toBeInTheDocument();
  });

  it('should hide Administration link when canViewAdmin is false', async () => {
    const { fixture } = await renderTopbar({
      canViewAdmin: false,
      topbarView: TopbarView.BLUEPRINT_HOME,
    });
    fixture.detectChanges();
    const menuButton = screen.getByText('Test User');
    menuButton.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(screen.queryByText('Administration')).not.toBeInTheDocument();
  });

  it('should show Logout option in menu', async () => {
    const { fixture } = await renderTopbar();
    fixture.detectChanges();
    const menuButton = screen.getByText('Test User');
    menuButton.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });

  it('should show Dark Theme toggle in menu', async () => {
    const { fixture } = await renderTopbar();
    fixture.detectChanges();
    const menuButton = screen.getByText('Test User');
    menuButton.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(screen.getByText('Dark Theme')).toBeInTheDocument();
  });

  it('should show Exit Administration when in admin view', async () => {
    const { fixture } = await renderTopbar({
      topbarView: TopbarView.BLUEPRINT_ADMIN,
    });
    fixture.detectChanges();
    const menuButton = screen.getByText('Test User');
    menuButton.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(screen.getByText('Exit Administration')).toBeInTheDocument();
  });

  it('should hide Exit Administration when not in admin view', async () => {
    const { fixture } = await renderTopbar({
      topbarView: TopbarView.BLUEPRINT_HOME,
    });
    fixture.detectChanges();
    const menuButton = screen.getByText('Test User');
    menuButton.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(screen.queryByText('Exit Administration')).not.toBeInTheDocument();
  });

  it('should not show Administration when in admin view even with permissions', async () => {
    const { fixture } = await renderTopbar({
      canViewAdmin: true,
      topbarView: TopbarView.BLUEPRINT_ADMIN,
    });
    fixture.detectChanges();
    const menuButton = screen.getByText('Test User');
    menuButton.click();
    fixture.detectChanges();
    await fixture.whenStable();
    // Should show Exit Administration instead
    expect(screen.getByText('Exit Administration')).toBeInTheDocument();
    // The "Administration" link should not appear (only Exit Administration)
    const adminButtons = screen.getAllByRole('menuitem');
    const adminLink = adminButtons.find(
      (btn) => btn.textContent?.trim() === 'Administration',
    );
    expect(adminLink).toBeUndefined();
  });
});
