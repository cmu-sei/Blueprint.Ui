// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, Subject } from 'rxjs';
import { ComnAuthService, ComnSettingsService } from '@cmusei/crucible-common';
import { Msel, MselService, User, UserService } from 'src/app/generated/blueprint.api';
import { ApplicationArea, SignalRService } from 'src/app/services/signalr.service';
import { LaunchComponent } from './launch.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { captureUnhandledRejections, flush } from 'src/app/test-utils/unhandled-rx-errors';

@Component({ selector: 'app-topbar', template: '', standalone: false })
class TopbarStub {
  @Input() title: string;
  @Input() topbarView: unknown;
  @Input() imageFilePath: string;
  @Output() urlNavigate = new EventEmitter<string>();
}

const TEMPLATE: Msel = { id: 'msel-t', name: 'Ransomware Starter', description: 'A launchable template' };

async function renderLaunch(logout: ComnAuthService['logout'] = () => Promise.resolve()) {
  // The launch answer is held, so the test can watch the in-progress state.
  const launched = new Subject<Msel>();
  const mselApi = {
    getMyLaunchMsels: vi.fn(() => of(structuredClone([TEMPLATE]))),
    launchMselByInvitation: vi.fn(() => launched),
  } satisfies ApiStub<MselService>;
  const userApi = {
    getUsers: vi.fn(() => of<User[]>([])),
  } satisfies ApiStub<UserService>;
  const signalR = {
    startConnection: vi.fn(() => Promise.resolve()),
    join: vi.fn(),
    selectMsel: vi.fn(),
    leave: vi.fn(),
  } satisfies Pick<SignalRService, 'startConnection' | 'join' | 'selectMsel' | 'leave'>;
  const rendered = await renderComponent(LaunchComponent, {
    imports: [MatButtonModule, MatCardModule, MatProgressSpinnerModule],
    declarations: [LaunchComponent, TopbarStub],
    providers: [
      { provide: MselService, useValue: mselApi },
      { provide: UserService, useValue: userApi },
      { provide: SignalRService, useValue: signalR },
      {
        provide: ComnAuthService,
        useValue: {
          user$: of({ profile: { sub: 'user-1' } }) as ComnAuthService['user$'],
          logout,
        } satisfies Pick<ComnAuthService, 'user$' | 'logout'>,
      },
      {
        provide: ComnSettingsService,
        useValue: { settings: { AppTopBarImage: '/assets/img/logo-white.png', PlayerUrl: 'https://player.example.com' } } satisfies Pick<ComnSettingsService, 'settings'>,
      },
    ],
  });
  await rendered.fixture.whenStable();
  return { ...rendered, mselApi, signalR, launched };
}

describe('LaunchComponent', () => {
  /**
   * Verifies: calling logout lets its rejected promise escape (current behavior).
   * Interacts with: ComnAuthService.logout, captureUnhandledRejections.
   * Data: logout rejects with a metadata request failure; no template calls this method.
   */
  it('leaves a rejected logout unhandled', async () => {
    const failure = new Error('signout metadata request failed');
    const rejections = captureUnhandledRejections();
    const { fixture } = await renderLaunch(() => Promise.reject(failure));

    fixture.componentInstance.logout();
    await flush();

    expect(rejections).toEqual([failure]);
  });

  /**
   * Verifies: the component mounts with the default test providers, joins the home hub and lists the events the user can start.
   * Interacts with: MselService.getMyLaunchMsels (stub), SignalRService (stub).
   * Data: one launchable MSEL, Ransomware Starter.
   */
  it('renders with the default test providers', async () => {
    const { fixture, signalR } = await renderLaunch();

    expect(fixture.componentInstance).toBeInstanceOf(LaunchComponent);
    expect(signalR.startConnection).toHaveBeenCalledWith(ApplicationArea.home);
    expect(signalR.join).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Start Ransomware Starter' })).toBeInTheDocument();
  });

  /**
   * Verifies: starting an event asks the API to launch it, shows the progress, and follows the launched MSEL on the hub.
   * Interacts with: MselService.launchMselByInvitation (stub, answered after the click), SignalRService.selectMsel (stub).
   * Data: Ransomware Starter launched as msel-new.
   */
  it('launches the chosen event', async () => {
    const { fixture, mselApi, signalR, launched } = await renderLaunch();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Start Ransomware Starter' }));
    expect(mselApi.launchMselByInvitation).toHaveBeenCalledWith('msel-t', '');
    expect(screen.getByText('Starting the event ...')).toBeInTheDocument();

    launched.next({ id: 'msel-new', name: 'Ransomware Starter' });
    fixture.detectChanges();

    expect(signalR.selectMsel).toHaveBeenCalledWith('msel-new');
  });
});
