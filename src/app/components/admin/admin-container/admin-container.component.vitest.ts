// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import { of } from 'rxjs';
import { AdminContainerComponent } from './admin-container.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { HealthCheckService } from 'src/app/generated/blueprint.api';
import { CurrentUserQuery } from 'src/app/data/user/user.query';
import { UIDataService } from 'src/app/data/ui/ui-data.service';
import { SignalRService } from 'src/app/services/signalr.service';
import { ComnSettingsService } from '@cmusei/crucible-common';

async function renderAdminContainer(
  overrides: {
    permissions?: string[];
  } = {},
) {
  const { permissions = [] } = overrides;

  return renderComponent(AdminContainerComponent, {
    declarations: [AdminContainerComponent],
    providers: [
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
        provide: HealthCheckService,
        useValue: {
          getVersion: () => of('1.0.0'),
          getReadiness: () => of({ status: 'Healthy' }),
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
          getAdminTab: () => 'Organizations',
          setAdminTab: () => {},
        },
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

describe('AdminContainerComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderAdminContainer();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display Administration header', async () => {
    await renderAdminContainer();
    expect(screen.getByText('Administration')).toBeInTheDocument();
  });

  it('should show Units nav when canViewUnits', async () => {
    await renderAdminContainer({ permissions: ['ViewUnits'] });
    expect(screen.getByText('Units')).toBeInTheDocument();
  });

  it('should hide Units nav when user lacks ViewUnits', async () => {
    await renderAdminContainer({ permissions: [] });
    expect(screen.queryByText('Units')).not.toBeInTheDocument();
  });

  it('should show Users nav when canViewUsers', async () => {
    await renderAdminContainer({ permissions: ['ViewUsers'] });
    expect(screen.getByText('Users')).toBeInTheDocument();
  });

  it('should hide Users nav when user lacks ViewUsers', async () => {
    await renderAdminContainer({ permissions: [] });
    expect(screen.queryByText('Users')).not.toBeInTheDocument();
  });

  it('should show Roles nav when canViewRoles', async () => {
    await renderAdminContainer({ permissions: ['ViewRoles'] });
    expect(screen.getByText('Roles')).toBeInTheDocument();
  });

  it('should show Groups nav when canViewGroups', async () => {
    await renderAdminContainer({ permissions: ['ViewGroups'] });
    expect(screen.getByText('Groups')).toBeInTheDocument();
  });

  it('should show Data Fields nav when canViewDataFields', async () => {
    await renderAdminContainer({ permissions: ['ViewDataFields'] });
    expect(screen.getByText('Data Fields')).toBeInTheDocument();
  });

  it('should show Inject Types nav when canViewInjectTypes', async () => {
    await renderAdminContainer({ permissions: ['ViewInjectTypes'] });
    expect(screen.getByText('Inject Types')).toBeInTheDocument();
  });

  it('should show Catalogs nav when canViewCatalogs', async () => {
    await renderAdminContainer({ permissions: ['ViewCatalogs'] });
    expect(screen.getByText('Catalogs')).toBeInTheDocument();
  });

  it('should show Organizations nav when canViewOrganizations', async () => {
    await renderAdminContainer({ permissions: ['ViewOrganizations'] });
    expect(screen.getByText('Organizations')).toBeInTheDocument();
  });

  it('should show Gallery Cards nav when canViewGalleryCards', async () => {
    await renderAdminContainer({ permissions: ['ViewGalleryCards'] });
    expect(screen.getByText('Gallery Cards')).toBeInTheDocument();
  });

  it('should show CITE Actions nav when canViewCiteActions', async () => {
    await renderAdminContainer({ permissions: ['ViewCiteActions'] });
    expect(screen.getByText('CITE Actions')).toBeInTheDocument();
  });

  it('should show CITE Duties nav when canViewCiteDuties', async () => {
    await renderAdminContainer({ permissions: ['ViewCiteDuties'] });
    expect(screen.getByText('CITE Duties')).toBeInTheDocument();
  });

  it('should show all nav items when all permissions present', async () => {
    await renderAdminContainer({
      permissions: [
        'ViewUnits',
        'ViewUsers',
        'ViewRoles',
        'ViewGroups',
        'ViewDataFields',
        'ViewInjectTypes',
        'ViewCatalogs',
        'ViewOrganizations',
        'ViewGalleryCards',
        'ViewCiteActions',
        'ViewCiteDuties',
      ],
    });
    expect(screen.getByText('Units')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Roles')).toBeInTheDocument();
    expect(screen.getByText('Groups')).toBeInTheDocument();
    expect(screen.getByText('Data Fields')).toBeInTheDocument();
    expect(screen.getByText('Inject Types')).toBeInTheDocument();
    expect(screen.getByText('Catalogs')).toBeInTheDocument();
    expect(screen.getByText('Organizations')).toBeInTheDocument();
    expect(screen.getByText('Gallery Cards')).toBeInTheDocument();
    expect(screen.getByText('CITE Actions')).toBeInTheDocument();
    expect(screen.getByText('CITE Duties')).toBeInTheDocument();
  });
});
