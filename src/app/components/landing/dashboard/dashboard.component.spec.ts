// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, input, output } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { Observable, Subject, of, throwError } from 'rxjs';
import { ComnAuthService, ComnSettingsService } from '@cmusei/crucible-common';
import { Msel, MselItemStatus, MselRole, MselService, SystemPermission, SystemPermissionsService, User, UserService } from 'src/app/generated/blueprint.api';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { CAPABILITY_CARDS, DashboardComponent } from './dashboard.component';
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
  overrides: {
    permissions?: SystemPermission[];
    permissionsFail?: boolean;
    join?: Msel[];
    launch?: Msel[];
    build?: Msel[];
    buildMsels?: () => Observable<Msel[]>;
    background?: string;
  } = {},
) {
  const { permissions = [], permissionsFail = false, join = [], launch = [], build = [], background } = overrides;
  const mselApi = {
    getMyJoinMsels: vi.fn(() => of(structuredClone(join))),
    getMyLaunchMsels: vi.fn(() => of(structuredClone(launch))),
    getMyMsels: vi.fn(overrides.buildMsels ?? (() => of(structuredClone(build)))),
  } satisfies ApiStub<MselService>;
  const userApi = {
    getUsers: vi.fn(() => of<User[]>([])),
  } satisfies ApiStub<UserService>;
  // DashboardComponent loads the permissions itself in ngOnInit, so the real
  // service is provided over the stubbed endpoint, without priming it.
  const permissionApis = permissionApiStubs({ system: permissions });
  if (permissionsFail) {
    permissionApis.systemPermissions.getMySystemPermissions.mockImplementation(() => throwError(() => new Error('permissions down')));
  }
  const rendered = await renderComponent(DashboardComponent, {
    imports: [MatCardModule, MatIconModule, MatProgressSpinnerModule],
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
        useValue: {
          settings: { AppTopBarImage: '/assets/img/logo-white.png', AppLandingBackgroundImage: background },
        } satisfies Pick<ComnSettingsService, 'settings'>,
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
   * Verifies: MSELs that fail to load end the spinner with a message in place of the cards, instead of reloading the page.
   * Interacts with: MselService.getMyMsels (stub, errors), ErrorService.
   * Data: the MSEL request fails.
   */
  it('says so when the events fail to load', async () => {
    const { fixture } = await renderDashboard({ buildMsels: () => throwError(() => new Error('msels down')) });

    expect(fixture.componentInstance.isStarted).toBe(true);
    expect(screen.getByText('Your events could not be loaded. Reload the page to try again.')).toBeInTheDocument();
    expect(screen.queryByText(/No accessible resources found/)).not.toBeInTheDocument();
  });

  /**
   * Verifies: once startup has begun, the watchdog does not reload the page while the requests are still running.
   * Interacts with: DashboardComponent.reloadIfNotStarted, reloadPage (spy).
   * Data: the MSEL request never answers.
   */
  it('leaves slow requests to finish rather than reloading', async () => {
    const { fixture } = await renderDashboard({ buildMsels: () => new Subject<Msel[]>() });
    const reload = vi.spyOn(fixture.componentInstance, 'reloadPage').mockImplementation(() => undefined);

    fixture.componentInstance.reloadIfNotStarted();

    expect(fixture.componentInstance.isStarted).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  /**
   * Verifies: permissions that fail to load count as none, so the dashboard still starts and its watchdog does not reload the page.
   * Interacts with: SystemPermissionsService.getMySystemPermissions (stub, errors), real PermissionDataService.
   * Data: one MSEL to manage; the permissions request fails.
   */
  it('starts even when the permissions fail to load', async () => {
    const { fixture } = await renderDashboard({ build: [ALPHA], permissionsFail: true });

    expect(fixture.componentInstance.isStarted).toBe(true);
    expect(card('BUILD')).toBeInTheDocument();
  });

  /**
   * Verifies: once the current user is known the dashboard loads the user's MSELs and offers a card for each kind it has.
   * Interacts with: MselService.getMyJoinMsels / getMyLaunchMsels / getMyMsels (stubs), real CurrentUserStore through UserDataService.setCurrentUser.
   * Data: one MSEL of each kind; no system permission.
   */
  it('offers join, launch and build cards for the user MSELs', async () => {
    const { mselApi } = await renderDashboard({ join: [ALPHA], launch: [ALPHA], build: [ALPHA] });

    expect(mselApi.getMyMsels).toHaveBeenCalledTimes(1);
    expect(card('JOIN')).toBeInTheDocument();
    expect(card('LAUNCH')).toBeInTheDocument();
    expect(card('BUILD')).toBeInTheDocument();
  });

  /**
   * Verifies: with CreateMsels the BUILD card is offered even with no MSEL to manage, and opens /build.
   * Interacts with: real PermissionDataService (grants: CreateMsels), Router.navigate (spy).
   * Data: no MSELs; CreateMsels.
   */
  it('offers BUILD with CreateMsels', async () => {
    await renderDashboard({ permissions: [SystemPermission.CreateMsels] });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const user = userEvent.setup();

    await user.click(card('BUILD') as HTMLElement);

    expect(navigate).toHaveBeenCalledWith(['build']);
    expect(screen.queryByText('NO ACCESS')).not.toBeInTheDocument();
  });

  /**
   * Verifies: without CreateMsels and no MSELs there is no BUILD card, and the NO ACCESS card shows.
   * Interacts with: real PermissionDataService (stubbed grants), DashboardComponent template.
   * Data: no MSELs; every permission but CreateMsels (near miss).
   */
  it('hides BUILD without CreateMsels or an MSEL', async () => {
    await renderDashboard({ permissions: ALL_BUT_CREATE_MSELS });

    expect(card('BUILD')).not.toBeInTheDocument();
    expect(screen.getByText('NO ACCESS')).toBeInTheDocument();
  });

  /**
   * Verifies: the page shows the background image named in settings, and none without the setting.
   * Interacts with: ComnSettingsService.settings (stub), DashboardComponent template.
   * Data: AppLandingBackgroundImage set to a relative asset URL, or unset.
   */
  it.each([
    { label: 'with', background: '/assets/local/landing-background.jpg', expected: 'url("/assets/local/landing-background.jpg")' },
    { label: 'without', background: undefined, expected: '' },
  ])('shows the landing background $label the setting', async ({ background, expected }) => {
    const { container } = await renderDashboard({ background });

    const page = container.querySelector('.command-center') as HTMLElement;
    expect(page.style.getPropertyValue('--landing-background')).toBe(expected);
    expect(page.classList.contains('has-background')).toBe(!!background);
  });
  /**
   * Verifies: ASSESS counts the running events the user can assess, checking every role they hold, and opens /assess.
   * Interacts with: MselService.getMyMsels (stub), real PermissionDataService (no grants), Router.navigate (spy).
   * Data: Bravo deployed with Viewer + Evaluator rows; Charlie deployed with Viewer only (near miss on role).
   */
  it('counts the events the user can assess', async () => {
    const roles = (id: string, r: MselRole[]) => r.map((role) => ({ userId: 'user-me', mselId: id, role }));
    await renderDashboard({
      build: [
        { id: 'msel-2', name: 'Exercise Bravo', status: MselItemStatus.Deployed, userMselRoles: roles('msel-2', [MselRole.Viewer, MselRole.Evaluator]) },
        { id: 'msel-3', name: 'Exercise Charlie', status: MselItemStatus.Deployed, userMselRoles: roles('msel-3', [MselRole.Viewer]) },
      ],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const assess = card('ASSESS') as HTMLElement;

    expect(assess.querySelector('.metric-value')?.textContent).toBe('1');
    await userEvent.setup().click(assess);
    expect(navigate).toHaveBeenCalledWith(['assess']);
  });

  /**
   * Verifies: the capability cards describe the stack by feature, with competency-based assessment from xAPI evidence first, and name no application.
   * Interacts with: DashboardComponent template, CAPABILITY_CARDS.
   * Data: no MSELs; no system permission (the cards show for every user).
   */
  it('shows a card for each capability, by feature', async () => {
    const { container } = await renderDashboard();

    const titles = [...container.querySelectorAll('.value-card .value-title')].map((t) => t.textContent?.trim());
    expect(titles).toEqual([
      'Competency-Based Assessment',
      'Collaborative Planning',
      'Cyber Range Exercises',
    ]);
    expect(card('Competency-Based Assessment')).toHaveTextContent('Capture what teams do as evidence, and rate them against NICE, DCWF or your own competencies');
    const allText = CAPABILITY_CARDS.map((c) => [c.summary, c.data.title, c.data.description, ...c.data.features, ...c.data.benefits].join(' ')).join(' ');
    expect(allText).not.toMatch(/\b(Player|Gallery|CITE|Steamfitter|Caster|TopoMojo|Gameboard)\b/);
  });

  /**
   * Verifies: clicking a capability card, or pressing Enter on it, opens the dialog with that capability's details, and Close shuts it.
   * Interacts with: real MatDialog and CapabilityDialogComponent.
   * Data: the Competency-Based Assessment and Cyber Range Exercises cards.
   */
  it('opens the details of a capability card', async () => {
    await renderDashboard();
    const user = userEvent.setup();

    await user.click(card('Competency-Based Assessment') as HTMLElement);

    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByText('Competency-Based Assessment')).toBeInTheDocument();
    expect(dialog.getByText(/^Tie the exercise to the competencies it trains/)).toBeInTheDocument();
    expect(dialog.getByText('Each rating is sent as a competency assertion to your learning record store')).toBeInTheDocument();
    expect(dialog.getByText('Rate every team on the same proficiency scale')).toBeInTheDocument();
    expect(dialog.queryByText(/^Publish news/)).not.toBeInTheDocument();

    await user.click(dialog.getByRole('button', { name: 'Close' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    (card('Cyber Range Exercises') as HTMLElement).focus();
    await user.keyboard('{Enter}');
    const delivery = within(await screen.findByRole('dialog'));
    expect(delivery.getByText('Publish news, intelligence and orders to each team move by move')).toBeInTheDocument();
    expect(delivery.getByText('Teams evaluate each move\'s incident and score their response')).toBeInTheDocument();
  });
});
