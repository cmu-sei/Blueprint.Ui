// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, input, output } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { ComnAuthService, ComnSettingsService } from '@cmusei/crucible-common';
import { Msel, MselService, SystemPermission, SystemPermissionsService, User, UserService } from 'src/app/generated/blueprint.api';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { DashboardComponent } from './dashboard.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { permissionApiStubs } from 'src/app/test-utils/mock-permission-data.service';
import { TopbarComponent } from '../../shared/top-bar/topbar.component';

@Component({ selector: 'app-topbar', template: '' })
class TopbarStub {
  readonly title = input<string>(undefined);
  readonly topbarView = input<unknown>(undefined);
  readonly imageFilePath = input<string>(undefined);
  readonly urlNavigate = output<string>();
}

const ALPHA: Msel = { id: 'msel-1', name: 'Exercise Alpha' };
const ALL_BUT_CREATE_MSELS = Object.values(SystemPermission).filter((p) => p !== SystemPermission.CreateMsels);

async function renderDashboard(
  overrides: { permissions?: SystemPermission[]; join?: Msel[]; launch?: Msel[]; build?: Msel[] } = {},
) {
  const { permissions = [], join = [], launch = [], build = [] } = overrides;
  const mselApi = {
    getMyJoinMsels: vi.fn(() => of(structuredClone(join))),
    getMyLaunchMsels: vi.fn(() => of(structuredClone(launch))),
    getMyMsels: vi.fn(() => of(structuredClone(build))),
  } satisfies ApiStub<MselService>;
  const userApi = {
    getUsers: vi.fn(() => of<User[]>([])),
  } satisfies ApiStub<UserService>;
  // DashboardComponent loads the permissions itself in ngOnInit, so the real
  // service is provided over the stubbed endpoint, without priming it.
  const permissionApis = permissionApiStubs({ system: permissions });
  const rendered = await renderComponent(DashboardComponent, {
    imports: [MatCardModule, MatProgressSpinnerModule],
    childStubs: [
      { replace: TopbarComponent, with: TopbarStub },
    ],
    providers: [
      { provide: SystemPermissionsService, useValue: permissionApis.systemPermissions },
      PermissionDataService,
      { provide: MselService, useValue: mselApi },
      { provide: UserService, useValue: userApi },
      {
        provide: ComnSettingsService,
        useValue: { settings: { AppTopBarImage: '/assets/img/logo-white.png' } } satisfies Pick<ComnSettingsService, 'settings'>,
      },
      {
        provide: ComnAuthService,
        useValue: { user$: of({ profile: { sub: 'user-me', name: 'Me' } }) } as Pick<ComnAuthService, 'user$'>,
      },
    ],
  });
  rendered.fixture.detectChanges();
  return { ...rendered, mselApi };
}

const card = (title: string) => screen.queryByRole('button', { name: new RegExp(`^${title}`) });

describe('DashboardComponent', () => {
  /**
   * Verifies: once the current user is known the dashboard loads the user's MSELs and offers a card for each kind it has.
   * Interacts with: MselService.getMyJoinMsels / getMyLaunchMsels / getMyMsels (stubs), real CurrentUserStore through UserDataService.setCurrentUser.
   * Data: one MSEL of each kind; no system permission.
   */
  it('offers join, start and manage cards for the user MSELs', async () => {
    const { mselApi } = await renderDashboard({ join: [ALPHA], launch: [ALPHA], build: [ALPHA] });

    expect(mselApi.getMyMsels).toHaveBeenCalledTimes(1);
    expect(card('Join an Event')).toBeInTheDocument();
    expect(card('Start an Event')).toBeInTheDocument();
    expect(card('Manage an Event')).toBeInTheDocument();
  });

  /**
   * Verifies: with CreateMsels the Manage card is offered even with no MSEL to manage, and opens /build.
   * Interacts with: real PermissionDataService (grants: CreateMsels), Router.navigate (spy).
   * Data: no MSELs; CreateMsels.
   */
  it('offers Manage an Event with CreateMsels', async () => {
    await renderDashboard({ permissions: [SystemPermission.CreateMsels] });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const user = userEvent.setup();

    await user.click(card('Manage an Event') as HTMLElement);

    expect(navigate).toHaveBeenCalledWith(['build']);
    expect(screen.queryByText('Nothing to see here!')).not.toBeInTheDocument();
  });

  /**
   * Verifies: without CreateMsels and no MSELs there is no Manage card, only the nothing-to-see message.
   * Interacts with: real PermissionDataService (stubbed grants), DashboardComponent template.
   * Data: no MSELs; every permission but CreateMsels (near miss).
   */
  it('hides Manage an Event without CreateMsels or an MSEL', async () => {
    await renderDashboard({ permissions: ALL_BUT_CREATE_MSELS });

    expect(card('Manage an Event')).not.toBeInTheDocument();
    expect(screen.getByText('Nothing to see here!')).toBeInTheDocument();
  });
});
