// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { of } from 'rxjs';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MselListComponent } from './msel-list.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { MselDataService } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { UserQuery, CurrentUserQuery } from 'src/app/data/user/user.query';
import { UserDataService } from 'src/app/data/user/user-data.service';
import { SignalRService } from 'src/app/services/signalr.service';
import { UIDataService } from 'src/app/data/ui/ui-data.service';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { SystemPermission } from 'src/app/generated/blueprint.api';
import { ComnSettingsService } from '@cmusei/crucible-common';

async function renderMselList(
  overrides: {
    permissions?: string[];
  } = {},
) {
  const { permissions = [] } = overrides;

  return renderComponent(MselListComponent, {
    declarations: [MselListComponent],
    imports: [
      MatTableModule,
      MatPaginatorModule,
      MatSortModule,
      MatSelectModule,
      MatCheckboxModule,
    ],
    componentProperties: {
      loggedInUserId: 'user-1',
      canAccessAdminSection: false,
    },
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
        provide: MselDataService,
        useValue: {
          load: () => of([]),
          loadMine: () => {},
          add: () => of({}),
          copy: () => of({}),
          delete: () => of({}),
          downloadXlsx: () => of(new Blob()),
          downloadJson: () => of(new Blob()),
          uploadXlsx: () => {},
          uploadJson: () => {},
          uploadProgress: of(0),
        },
      },
      {
        provide: MselQuery,
        useValue: {
          selectAll: () => of([]),
          select: () => of(null),
          selectActive: () => of(null),
          selectEntity: () => of(null),
          selectLoading: () => of(false),
        },
      },
      {
        provide: UserQuery,
        useValue: {
          selectAll: () => of([]),
          select: () => of(null),
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
        provide: UserDataService,
        useValue: {
          setCurrentUser: () => {},
          load: () => of([]),
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
        provide: UIDataService,
        useValue: {
          inIframe: () => false,
          setMselTab: () => {},
        },
      },
      {
        provide: DialogService,
        useValue: {
          confirm: () => of({ confirm: true }),
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
            DefaultDataFields: [],
          },
        },
      },
    ],
  });
}

describe('MselListComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderMselList();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should enable Add blank MSEL button when user has CreateMsels permission', async () => {
    const { fixture } = await renderMselList({
      permissions: [SystemPermission.CreateMsels],
    });
    fixture.detectChanges();
    const addButton = fixture.nativeElement.querySelector(
      'button[title="Add blank MSEL"]',
    );
    expect(addButton).toBeTruthy();
    expect(addButton.disabled).toBe(false);
  });

  it('should disable Add blank MSEL button when user lacks CreateMsels permission', async () => {
    const { fixture } = await renderMselList({ permissions: [] });
    fixture.detectChanges();
    const addButton = fixture.nativeElement.querySelector(
      'button[title="Add blank MSEL"]',
    );
    expect(addButton).toBeTruthy();
    expect(addButton.disabled).toBe(true);
  });

  it('should enable Upload button when user has CreateMsels permission', async () => {
    const { fixture } = await renderMselList({
      permissions: [SystemPermission.CreateMsels],
    });
    fixture.detectChanges();
    const uploadButton = fixture.nativeElement.querySelector(
      'button[title="Upload a new MSEL from a file"]',
    );
    expect(uploadButton).toBeTruthy();
    expect(uploadButton.disabled).toBe(false);
  });

  it('should disable Upload button when user lacks CreateMsels permission', async () => {
    const { fixture } = await renderMselList({ permissions: [] });
    fixture.detectChanges();
    const uploadButton = fixture.nativeElement.querySelector(
      'button[title="Upload a new MSEL from a file"]',
    );
    expect(uploadButton).toBeTruthy();
    expect(uploadButton.disabled).toBe(true);
  });

  it('should show No results found when no MSELs loaded', async () => {
    const { fixture } = await renderMselList();
    fixture.detectChanges();
    const noResults = fixture.nativeElement.querySelector('.no-results');
    expect(noResults).toBeTruthy();
    expect(noResults.textContent).toContain('No results found');
  });
});
