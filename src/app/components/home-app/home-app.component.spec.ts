// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
import { ComnAuthService, ComnSettingsService, Theme } from '@cmusei/crucible-common';
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
import { captureUnhandledRejections, flush } from 'src/app/test-utils/unhandled-rx-errors';
import { FakeImage } from 'src/app/test-utils/fake-image';

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
  overrides: { permissions?: SystemPermission[]; mselId?: string; health?: HealthReport; logout?: ComnAuthService['logout']; background?: string } = {},
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
      {
        provide: ComnSettingsService,
        useValue: {
          settings: { AppTitle: '', AppTopBarText: '', AppTopBarImage: '', AppLandingBackgroundImage: overrides.background },
        } satisfies Pick<ComnSettingsService, 'settings'>,
      },
      {
        provide: ComnAuthService,
        useValue: {
          user$: of({ profile: { sub: 'user-1' } }) as ComnAuthService['user$'],
          logout: overrides.logout ?? vi.fn(() => Promise.resolve()),
        } satisfies Pick<ComnAuthService, 'user$' | 'logout'>,
      },
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
   * Verifies: calling logout lets its rejected promise escape (current behavior).
   * Interacts with: ComnAuthService.logout, captureUnhandledRejections.
   * Data: logout rejects with a metadata request failure; no template calls this method.
   */
  it('leaves a rejected logout unhandled', async () => {
    const failure = new Error('signout metadata request failed');
    const rejections = captureUnhandledRejections();
    const { fixture } = await renderHome({ logout: () => Promise.reject(failure) });

    fixture.componentInstance.logout();
    await flush();

    expect(rejections).toEqual([failure]);
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
   * Verifies: each non-MSEL system permission alone opens the Administration control.
   * Interacts with: real PermissionDataService over SystemPermissionsService, MselListStub input.
   * Data: exactly one system permission not ending in Msels, with no broader grant.
   */
  it.each(Object.values(SystemPermission).filter((permission) => !permission.endsWith('Msels')))(
    'offers Administration with exactly %s', async (permission) => {
      const { fixture } = await renderHome({ permissions: [permission] });

      expect(screen.getByRole('button', { name: 'Administration' })).toBeInTheDocument();
      expect(child(fixture, MselListStub)?.canAccessAdminSection()).toBe(true);
    },
  );

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

  afterEach(() => {
    vi.unstubAllGlobals();
    FakeImage.last = undefined;
  });

  /**
   * Verifies: the MSEL list shows the background image named in settings once it loads.
   * Interacts with: ComnSettingsService.settings (stub), a stubbed Image, HomeAppComponent template.
   * Data: AppLandingBackgroundImage set to a relative asset URL; the image load event fires.
   */
  it('shows the landing background once the image loads', async () => {
    vi.stubGlobal('Image', FakeImage);
    const { fixture, container } = await renderHome({ background: '/assets/local/landing-background.jpg' });

    expect(FakeImage.last?.src).toBe('/assets/local/landing-background.jpg');
    FakeImage.last!.onload!();
    fixture.detectChanges();

    const page = container.querySelector('.app-content-container') as HTMLElement;
    expect(page.style.getPropertyValue('--landing-background')).toBe('url("/assets/local/landing-background.jpg")');
    expect(page.classList.contains('has-background')).toBe(true);
  });

  /**
   * Verifies: an image that fails to load leaves the normal page background, as if unset.
   * Interacts with: ComnSettingsService.settings (stub), a stubbed Image, HomeAppComponent template.
   * Data: AppLandingBackgroundImage set to a missing image; the image error event fires.
   */
  it('keeps the normal background when the image fails to load', async () => {
    vi.stubGlobal('Image', FakeImage);
    const { fixture, container } = await renderHome({ background: '/assets/local/missing.jpg' });

    FakeImage.last!.onerror?.();
    fixture.detectChanges();

    const page = container.querySelector('.app-content-container') as HTMLElement;
    expect(page.style.getPropertyValue('--landing-background')).toBe('');
    expect(page.classList.contains('has-background')).toBe(false);
  });

  /**
   * Verifies: without the setting, no image is requested and the normal page background is kept.
   * Interacts with: ComnSettingsService.settings (stub), a stubbed Image, HomeAppComponent template.
   * Data: AppLandingBackgroundImage unset.
   */
  it('keeps the normal background without the setting', async () => {
    vi.stubGlobal('Image', FakeImage);
    const { container } = await renderHome();

    expect(FakeImage.last).toBeUndefined();
    const page = container.querySelector('.app-content-container') as HTMLElement;
    expect(page.style.getPropertyValue('--landing-background')).toBe('');
    expect(page.classList.contains('has-background')).toBe(false);
  });

  /**
   * Verifies: an open MSEL shows no landing background, even once the image loads.
   * Interacts with: ComnSettingsService.settings (stub), ActivatedRoute (?msel), a stubbed Image, HomeAppComponent template.
   * Data: AppLandingBackgroundImage set to a relative asset URL; msel-1 open; the image load event fires.
   */
  it('hides the landing background on an open MSEL', async () => {
    vi.stubGlobal('Image', FakeImage);
    const { fixture, container } = await renderHome({ background: '/assets/local/landing-background.jpg', mselId: 'msel-1' });

    FakeImage.last!.onload!();
    fixture.detectChanges();

    const page = container.querySelector('.app-content-container') as HTMLElement;
    expect(page.classList.contains('has-background')).toBe(false);
  });
});
