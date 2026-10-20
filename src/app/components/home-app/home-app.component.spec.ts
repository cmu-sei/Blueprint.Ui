// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Component, input, output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { Observable, of } from 'rxjs';
import { Theme } from '@cmusei/crucible-common';
import {
  HealthCheckService,
  HealthReport,
  HealthStatus,
  SystemPermission,
  SystemPermissionsService,
} from 'src/app/generated/blueprint.api';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { SignalRService } from 'src/app/services/signalr.service';
import { HomeAppComponent } from './home-app.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { activatedRouteStub } from 'src/app/test-utils/activated-route';
import { renderComponent } from 'src/app/test-utils/render-component';
import { permissionApiStubs } from 'src/app/test-utils/mock-permission-data.service';
import { TopbarComponent } from '../shared/top-bar/topbar.component';
import { MselListComponent } from '../msel-list/msel-list.component';
import { MselComponent } from '../msel/msel.component';

@Component({ selector: 'app-topbar', template: '' })
class TopbarStub {
  readonly title = input<string>(undefined);
  readonly topbarView = input<unknown>(undefined);
  readonly imageFilePath = input<string>(undefined);
  readonly urlNavigate = output<string>();
}
@Component({ selector: 'app-msel-list', template: '' })
class MselListStub {
  readonly loggedInUserId = input<string>(undefined);
  readonly canAccessAdminSection = input<boolean>(undefined);
}
@Component({ selector: 'app-msel', template: '' })
class MselStub {
  readonly loggedInUserId = input<string>(undefined);
  readonly canEditMsel = input<boolean>(undefined);
  readonly canAccessAdminSection = input<boolean>(undefined);
  readonly canEditCheckboxes = input<boolean>(undefined);
  readonly userTheme$ = input<Observable<Theme>>(undefined);
  readonly deleteThisMsel = output<string>();
}

const MSEL_PERMISSIONS = [SystemPermission.CreateMsels, SystemPermission.ViewMsels, SystemPermission.EditMsels, SystemPermission.ManageMsels];

async function renderHome(
  overrides: { permissions?: SystemPermission[]; mselId?: string; health?: HealthReport } = {},
) {
  const { permissions = [], mselId, health = { status: HealthStatus.Healthy } } = overrides;
  const healthApi = {
    getReadiness: vi.fn(() => of(structuredClone(health))),
  } satisfies ApiStub<HealthCheckService>;
  const signalR = {
    startConnection: vi.fn(() => Promise.resolve()),
    join: vi.fn(),
    leave: vi.fn(),
    clearPresence: vi.fn(),
    selectMsel: vi.fn(),
  } satisfies Pick<SignalRService, 'startConnection' | 'join' | 'leave' | 'clearPresence' | 'selectMsel'>;
  // HomeAppComponent loads the permissions itself in ngOnInit, so the real
  // service is provided over the stubbed endpoint, without priming it.
  const permissionApis = permissionApiStubs({ system: permissions });
  const { route } = activatedRouteStub(mselId ? { msel: mselId } : {});
  const rendered = await renderComponent(HomeAppComponent, {
    imports: [MatButtonModule, MatIconModule, MatProgressBarModule],
    childStubs: [
      { replace: TopbarComponent, with: TopbarStub },
      { replace: MselListComponent, with: MselListStub },
      { replace: MselComponent, with: MselStub },
    ],
    providers: [
      { provide: SystemPermissionsService, useValue: permissionApis.systemPermissions },
      PermissionDataService,
      { provide: HealthCheckService, useValue: healthApi },
      { provide: SignalRService, useValue: signalR },
      { provide: ActivatedRoute, useValue: route },
    ],
  });
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();
  return { ...rendered, signalR, healthApi };
}

function child<T>(fixture: ComponentFixture<unknown>, stub: new (...args: never[]) => T): T | undefined {
  return fixture.debugElement.query(By.directive(stub))?.componentInstance;
}

describe('HomeAppComponent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  /**
   * Verifies: on the MSEL list a permission outside the MSEL family shows the Administration button, which opens /admin with the return URL.
   * Interacts with: real PermissionDataService over SystemPermissionsService (stub), Router.navigate (spy), MselListStub input.
   * Data: no msel query parameter; ViewUnits.
   */
  it('offers Administration with a non-MSEL permission', async () => {
    const { fixture } = await renderHome({ permissions: [SystemPermission.ViewUnits] });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const user = userEvent.setup();

    expect(child(fixture, MselListStub)?.canAccessAdminSection()).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Administration' }));

    expect(navigate).toHaveBeenCalledWith(['/admin'], { queryParams: { returnUrl: '/' } });
  });

  /**
   * Verifies: with only MSEL permissions there is no Administration button and the list is told so.
   * Interacts with: real PermissionDataService (stubbed grants), MselListStub input.
   * Data: no msel query parameter; CreateMsels, ViewMsels, EditMsels and ManageMsels (near miss: every MSEL permission).
   */
  it('hides Administration with only MSEL permissions', async () => {
    const { fixture } = await renderHome({ permissions: MSEL_PERMISSIONS });

    expect(screen.queryByRole('button', { name: 'Administration' })).not.toBeInTheDocument();
    expect(child(fixture, MselListStub)?.canAccessAdminSection()).toBe(false);
    expect(child(fixture, MselStub)).toBeUndefined();
  });

  /**
   * Verifies: with a selected MSEL the MSEL page gets canEditMsel from EditMsels, canEditCheckboxes from CreateMsels, and canAccessAdminSection from a permission outside the MSEL family, each true only when granted.
   * Interacts with: real PermissionDataService (stubbed grants), MselStub inputs.
   * Data: msel=msel-1; one row per permission set (the MSEL-only rows are the near misses for canAccessAdminSection).
   */
  it.each([
    { permissions: [SystemPermission.EditMsels], canEditMsel: true, canEditCheckboxes: false, admin: false },
    { permissions: [SystemPermission.CreateMsels], canEditMsel: false, canEditCheckboxes: true, admin: false },
    { permissions: [SystemPermission.ViewMsels, SystemPermission.ManageMsels], canEditMsel: false, canEditCheckboxes: false, admin: false },
    { permissions: [SystemPermission.ViewMsels, SystemPermission.ViewUnits], canEditMsel: false, canEditCheckboxes: false, admin: true },
  ])('passes canEditMsel $canEditMsel, canEditCheckboxes $canEditCheckboxes and canAccessAdminSection $admin for $permissions', async ({ permissions, canEditMsel, canEditCheckboxes, admin }) => {
    const { fixture, signalR } = await renderHome({ permissions, mselId: 'msel-1' });

    const msel = child(fixture, MselStub);
    expect(msel?.canEditMsel()).toBe(canEditMsel);
    expect(msel?.canEditCheckboxes()).toBe(canEditCheckboxes);
    expect(msel?.canAccessAdminSection()).toBe(admin);
    expect(child(fixture, MselListStub)).toBeUndefined();
    expect(signalR.join).toHaveBeenCalled();
  });

  /**
   * Verifies: when the API reports it is not healthy, the page shows only the bare status as the message (current behavior).
   * Interacts with: HealthCheckService.getReadiness (stub), healthCheck.
   * Data: status Unhealthy.
   */
  it('shows the bare health status when the API is unhealthy', async () => {
    await renderHome({ health: { status: HealthStatus.Unhealthy } });

    // Current behavior; see agent-docs/ui-test-bugs/blueprint.ui.md.
    expect(screen.getByRole('heading', { name: 'Unhealthy' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Please refresh this page.' })).toBeInTheDocument();
  });
});
