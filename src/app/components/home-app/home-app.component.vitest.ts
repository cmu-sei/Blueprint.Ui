// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import { of } from 'rxjs';
import { HomeAppComponent } from './home-app.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { HealthCheckService } from 'src/app/generated/blueprint.api';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { CurrentUserQuery } from 'src/app/data/user/user.query';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { ComnSettingsService } from '@cmusei/crucible-common';
import { UIDataService } from 'src/app/data/ui/ui-data.service';
import { SignalRService } from 'src/app/services/signalr.service';

async function renderHome(
  overrides: {
    apiHealthy?: boolean;
    permissions?: string[];
    appTitle?: string;
  } = {},
) {
  const {
    apiHealthy = true,
    permissions = [],
    appTitle = 'Blueprint',
  } = overrides;

  return renderComponent(HomeAppComponent, {
    declarations: [HomeAppComponent],
    providers: [
      {
        provide: HealthCheckService,
        useValue: {
          getReadiness: () =>
            apiHealthy
              ? of({ status: 'Healthy' })
              : of({ status: 'Unhealthy' }),
        },
      },
      {
        provide: MselQuery,
        useValue: {
          selectAll: () => of([]),
          selectActive: () => of(null),
          selectLoading: () => of(false),
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
        provide: PermissionDataService,
        useValue: {
          permissions,
          load: () => of(permissions),
          hasPermission: (p: string) => permissions.includes(p),
          canViewAdministration: () =>
            permissions.some((y: string) => y.startsWith('View')),
        },
      },
      {
        provide: ComnSettingsService,
        useValue: {
          settings: {
            ApiUrl: '',
            AppTitle: appTitle,
            AppTopBarText: appTitle,
            AppTopBarHexColor: '#0F1D47',
            AppTopBarHexTextColor: '#FFFFFF',
            AppTopBarImage: '',
          },
        },
      },
      {
        provide: UIDataService,
        useValue: { inIframe: () => false },
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
  });
}

describe('HomeAppComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderHome();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should pass title to topbar when not in iframe', async () => {
    const { fixture } = await renderHome({ appTitle: 'Blueprint Test' });
    const topbar = fixture.nativeElement.querySelector('app-topbar');
    expect(topbar).toBeTruthy();
    expect(topbar.getAttribute('title')).toBe('Blueprint Test');
  });

  it('should show API error message when API is unhealthy', async () => {
    await renderHome({ apiHealthy: false });
    expect(screen.getByText('Please refresh this page.')).toBeInTheDocument();
  });

  it('should not show API error when API is healthy', async () => {
    await renderHome({ apiHealthy: true });
    expect(
      screen.queryByText('Please refresh this page.'),
    ).not.toBeInTheDocument();
  });

  it('should show admin cog button when user has admin permissions', async () => {
    await renderHome({ permissions: ['ViewUsers'] });
    const adminButton = screen.getByTitle('Administration');
    expect(adminButton).toBeInTheDocument();
  });

  it('should hide admin cog button when user has no permissions', async () => {
    await renderHome({ permissions: [] });
    expect(screen.queryByTitle('Administration')).not.toBeInTheDocument();
  });

  it('should hide admin cog when user only has Msel permissions', async () => {
    await renderHome({ permissions: ['EditMsels'] });
    expect(screen.queryByTitle('Administration')).not.toBeInTheDocument();
  });
});
