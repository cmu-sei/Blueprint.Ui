// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { NEVER, Observable, of, throwError } from 'rxjs';
import { ComnAuthService, ComnSettingsService } from '@cmusei/crucible-common';
import { Msel, MselService, User, UserService } from 'src/app/generated/blueprint.api';
import { ErrorService } from 'src/app/services/error/error.service';
import { XApiService } from 'src/app/services/xapi/xapi.service';
import { JoinComponent } from './join.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';

@Component({ selector: 'app-topbar', template: '', standalone: false })
class TopbarStub {
  @Input() title: string;
  @Input() topbarView: unknown;
  @Input() imageFilePath: string;
  @Output() urlNavigate = new EventEmitter<string>();
}

const ALPHA: Msel = { id: 'msel-1', name: 'Exercise Alpha', description: 'An exercise in progress' };

// A successful join sends the window to Player, which jsdom cannot do, so the
// default answer stays pending.
async function renderJoin(join: () => Observable<string> = () => NEVER) {
  const mselApi = {
    ...({
      getMyJoinMsels: vi.fn(() => of(structuredClone([ALPHA]))),
    } satisfies ApiStub<MselService>),
    // POST msels/{mselId}/join answers the Player view id (MselController.JoinMsel),
    // although the generated client types it as an Msel; the stub is typed to what the API sends.
    joinMselByInvitation: vi.fn(join),
  };
  const userApi = {
    getUsers: vi.fn(() => of<User[]>([])),
  } satisfies ApiStub<UserService>;
  const xApi = { viewedJoinPage: vi.fn(() => of(null)) } satisfies Pick<XApiService, 'viewedJoinPage'>;
  const handleError = vi.fn();
  const rendered = await renderComponent(JoinComponent, {
    imports: [MatButtonModule, MatCardModule],
    declarations: [JoinComponent, TopbarStub],
    providers: [
      { provide: MselService, useValue: mselApi },
      { provide: UserService, useValue: userApi },
      { provide: XApiService, useValue: xApi },
      { provide: ErrorService, useValue: { handleError } satisfies Pick<ErrorService, 'handleError'> },
      {
        provide: ComnSettingsService,
        useValue: { settings: { AppTopBarImage: '/assets/img/logo-white.png', PlayerUrl: 'https://player.example.com' } } satisfies Pick<ComnSettingsService, 'settings'>,
      },
      {
        provide: ComnAuthService,
        useValue: { user$: of({ profile: { sub: 'user-me', name: 'Me' } }) } as Pick<ComnAuthService, 'user$'>,
      },
    ],
  });
  return { ...rendered, mselApi, xApi, handleError };
}

describe('JoinComponent', () => {
  /**
   * Verifies: the component mounts with the default test providers, logs the xAPI view and lists the events the user can join.
   * Interacts with: MselService.getMyJoinMsels (stub), XApiService.viewedJoinPage (stub).
   * Data: one joinable MSEL, Exercise Alpha.
   */
  it('renders with the default test providers', async () => {
    const { fixture, xApi } = await renderJoin();

    expect(fixture.componentInstance).toBeInstanceOf(JoinComponent);
    expect(xApi.viewedJoinPage).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Exercise Alpha')).toBeInTheDocument();
    expect(screen.getByTitle('Join Exercise Alpha')).toBeInTheDocument();
  });

  /**
   * Verifies: Join asks the API to join the user to the event.
   * Interacts with: MselService.joinMselByInvitation (stub, pending).
   * Data: Exercise Alpha, no team.
   */
  it('joins the chosen event', async () => {
    const { mselApi } = await renderJoin();
    const user = userEvent.setup();

    await user.click(screen.getByTitle('Join Exercise Alpha'));

    expect(mselApi.joinMselByInvitation).toHaveBeenCalledWith('msel-1', '');
  });

  /**
   * Verifies: a failed join is reported to the error service.
   * Interacts with: MselService.joinMselByInvitation (stub, fails), ErrorService.handleError (spy).
   * Data: the join answers 403.
   */
  it('reports a failed join', async () => {
    const failure = new Error('403');
    const { handleError } = await renderJoin(() => throwError(() => failure));
    const user = userEvent.setup();

    await user.click(screen.getByTitle('Join Exercise Alpha'));

    expect(handleError).toHaveBeenCalledWith(failure);
  });
});
