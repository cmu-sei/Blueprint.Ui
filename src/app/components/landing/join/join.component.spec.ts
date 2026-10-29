// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Component, input, output } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Params, Router, UrlTree } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { NEVER, Observable, of, throwError } from 'rxjs';
import { ComnAuthService, ComnSettingsService } from '@cmusei/crucible-common';
import { Msel, MselImageService, MselService, User, UserService } from 'src/app/generated/blueprint.api';
import { ErrorService } from 'src/app/services/error/error.service';
import { XApiService } from 'src/app/services/xapi/xapi.service';
import { JoinComponent } from './join.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { activatedRouteStub } from 'src/app/test-utils/activated-route';
import { renderComponent } from 'src/app/test-utils/render-component';
import { TopbarComponent } from '../../shared/top-bar/topbar.component';
import { FakeImage } from 'src/app/test-utils/fake-image';

@Component({ selector: 'app-topbar', template: '' })
class TopbarStub {
  readonly title = input<string>(undefined);
  readonly topbarView = input<unknown>(undefined);
  readonly imageFilePath = input<string>(undefined);
  readonly urlNavigate = output<string>();
}

const ALPHA: Msel = { id: 'msel-1', name: 'Exercise Alpha', description: 'An exercise in progress' };
const BRAVO: Msel = { id: 'msel-2', name: 'Exercise Bravo', description: 'Another exercise' };

// A successful join sends the window to Player, which jsdom cannot do, so the
// default answer stays pending. The page joins the MSEL named in its query
// parameters; without them it lists the events the user can join.
async function renderJoin(join: () => Observable<string> = () => NEVER, queryParams: Params = {}, msels: Msel[] = [ALPHA, BRAVO], background?: string) {
  const mselApi = {
    ...({
      getMyJoinMsels: vi.fn(() => of(structuredClone(msels))),
    } satisfies ApiStub<MselService>),
    // POST msels/{mselId}/join answers the Player view id (MselController.JoinMsel),
    // although the generated client types it as an Msel; the stub is typed to what the API sends.
    joinMselByInvitation: vi.fn(join),
  };
  const userApi = {
    getUsers: vi.fn(() => of<User[]>([])),
  } satisfies ApiStub<UserService>;
  const imageApi = {
    getMselImage: vi.fn(() => of(new Blob(['image'], { type: 'image/png' }))),
  } satisfies ApiStub<MselImageService>;
  const xApi = { viewedJoinPage: vi.fn(() => of(null)) } satisfies Pick<XApiService, 'viewedJoinPage'>;
  const handleError = vi.fn();
  const rendered = await renderComponent(JoinComponent, {
    imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule],
    childStubs: [
      { replace: TopbarComponent, with: TopbarStub },
    ],
    providers: [
      { provide: MselService, useValue: mselApi },
      { provide: MselImageService, useValue: imageApi },
      { provide: UserService, useValue: userApi },
      { provide: XApiService, useValue: xApi },
      { provide: ActivatedRoute, useValue: activatedRouteStub(queryParams).route },
      { provide: ErrorService, useValue: { handleError } satisfies Pick<ErrorService, 'handleError'> },
      {
        provide: ComnSettingsService,
        useValue: { settings: { AppTopBarImage: '/assets/img/logo-white.png', PlayerUrl: 'https://player.example.com', AppLandingBackgroundImage: background } } satisfies Pick<ComnSettingsService, 'settings'>,
      },
      {
        provide: ComnAuthService,
        useValue: { user$: of({ profile: { sub: 'user-me', name: 'Me' } }) } as Pick<ComnAuthService, 'user$'>,
      },
    ],
  });
  return { ...rendered, mselApi, imageApi, xApi, handleError };
}

describe('JoinComponent', () => {
  // jsdom has no object URLs.
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:photo');
    URL.revokeObjectURL = vi.fn();
  });

  /**
   * Verifies: the component mounts with the default test providers, logs the xAPI view and lists the events the user can join.
   * Interacts with: MselService.getMyJoinMsels (stub), XApiService.viewedJoinPage (stub).
   * Data: one joinable MSEL, Exercise Alpha.
   */
  it('renders with the default test providers', async () => {
    const { fixture, xApi } = await renderJoin();

    expect(fixture.componentInstance).toBeInstanceOf(JoinComponent);
    expect(xApi.viewedJoinPage).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'Exercise Alpha' })).toBeInTheDocument();
    expect(screen.getByTitle('Join Exercise Alpha')).toBeInTheDocument();
  });

  /**
   * Verifies: each event's Join is a link, named Join and titled with the event, to the join page for that event; nothing is joined until that page opens.
   * Interacts with: routerLink (real router), MselService.joinMselByInvitation (stub, not called).
   * Data: joinable MSELs Exercise Alpha (msel-1) and Exercise Bravo (msel-2); no query parameters.
   */
  it('links each event to its join page', async () => {
    const { mselApi } = await renderJoin();

    const links = screen.getAllByRole('link', { name: 'Join' });
    expect(links.map((link) => [link.getAttribute('href'), link.getAttribute('title')])).toEqual([
      ['/join?msel=msel-1', 'Join Exercise Alpha'],
      ['/join?msel=msel-2', 'Join Exercise Bravo'],
    ]);
    expect(screen.queryByRole('button', { name: 'Join' })).not.toBeInTheDocument();
    expect(mselApi.joinMselByInvitation).not.toHaveBeenCalled();
  });

  /**
   * Verifies: clicking Join navigates in place to the join page for that event, without joining from the list.
   * Interacts with: routerLink, Router.navigateByUrl (spied, resolves), MselService.joinMselByInvitation (stub, not called).
   * Data: Exercise Bravo's Join link.
   */
  it('opens the join page of the chosen event', async () => {
    const { mselApi } = await renderJoin();
    const router = TestBed.inject(Router);
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const user = userEvent.setup();

    await user.click(screen.getByTitle('Join Exercise Bravo'));

    expect(navigateByUrl).toHaveBeenCalledTimes(1);
    expect(router.serializeUrl(navigateByUrl.mock.calls[0][0] as UrlTree)).toBe('/join?msel=msel-2');
    expect(mselApi.joinMselByInvitation).not.toHaveBeenCalled();
  });

  /**
   * Verifies: an event with an image shows it on its card instead of the generated pattern; an event without one keeps the generated pattern, with nothing written on it.
   * Interacts with: MselImageService.getMselImage (stub, answers a PNG blob), URL.createObjectURL (stub).
   * Data: Exercise Alpha with ImageDateModified set; Exercise Bravo without.
   */
  it('shows the image of an event on its card', async () => {
    const { fixture, imageApi } = await renderJoin(undefined, {}, [{ ...ALPHA, imageDateModified: new Date('2026-10-23T12:00:00Z') }, BRAVO]);

    const cards = Array.from(fixture.nativeElement.querySelectorAll('.event-card')) as HTMLElement[];
    expect(imageApi.getMselImage.mock.calls).toEqual([['msel-1']]);
    expect((cards[0].querySelector('.card-photo') as HTMLElement).style.backgroundImage).toBe('url("blob:photo")');
    expect(cards[1].querySelector('.card-photo')).toBeNull();
    expect(cards[1].querySelector('.card-image')).toBeEmptyDOMElement();
  });

  /**
   * Verifies: the join page asks the API to join the user to the event named in its msel query parameter, with the team parameter when there is one.
   * Interacts with: ActivatedRoute.queryParamMap (activatedRouteStub), MselService.joinMselByInvitation (stub, pending).
   * Data: ?msel=msel-1 (no team), or ?msel=msel-1&team=team-1.
   */
  it.each([
    { label: 'without a team', queryParams: { msel: 'msel-1' }, team: null as string },
    { label: 'with a team', queryParams: { msel: 'msel-1', team: 'team-1' }, team: 'team-1' },
  ])('joins the event named in the query parameters $label', async ({ queryParams, team }) => {
    const { mselApi } = await renderJoin(undefined, queryParams);

    expect(mselApi.joinMselByInvitation.mock.calls).toEqual([['msel-1', team]]);
  });

  /**
   * Verifies: a failed join is reported to the error service.
   * Interacts with: ActivatedRoute.queryParamMap (activatedRouteStub), MselService.joinMselByInvitation (stub, fails), ErrorService.handleError (spy).
   * Data: ?msel=msel-1; the join answers 403.
   */
  it('reports a failed join', async () => {
    const failure = new Error('403');
    const { mselApi, handleError } = await renderJoin(() => throwError(() => failure), { msel: 'msel-1' });

    expect(mselApi.joinMselByInvitation).toHaveBeenCalledWith('msel-1', null);
    expect(handleError).toHaveBeenCalledWith(failure);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    FakeImage.last = undefined;
  });

  /**
   * Verifies: the page shows the background image named in settings once it loads.
   * Interacts with: ComnSettingsService.settings (stub), a stubbed Image, JoinComponent template.
   * Data: AppLandingBackgroundImage set to a relative asset URL; the image load event fires.
   */
  it('shows the landing background once the image loads', async () => {
    vi.stubGlobal('Image', FakeImage);
    const { fixture, container } = await renderJoin(undefined, {}, undefined, '/assets/local/landing-background.jpg');

    expect(FakeImage.last?.src).toBe('/assets/local/landing-background.jpg');
    FakeImage.last!.onload!();
    fixture.detectChanges();

    const page = container.querySelector('.join-page') as HTMLElement;
    expect(page.style.getPropertyValue('--landing-background')).toBe('url("/assets/local/landing-background.jpg")');
    expect(page.classList.contains('has-background')).toBe(true);
  });

  /**
   * Verifies: an image that fails to load leaves the normal page background, as if unset.
   * Interacts with: ComnSettingsService.settings (stub), a stubbed Image, JoinComponent template.
   * Data: AppLandingBackgroundImage set to a missing image; the image error event fires.
   */
  it('keeps the normal background when the image fails to load', async () => {
    vi.stubGlobal('Image', FakeImage);
    const { fixture, container } = await renderJoin(undefined, {}, undefined, '/assets/local/missing.jpg');

    FakeImage.last!.onerror?.();
    fixture.detectChanges();

    const page = container.querySelector('.join-page') as HTMLElement;
    expect(page.style.getPropertyValue('--landing-background')).toBe('');
    expect(page.classList.contains('has-background')).toBe(false);
  });

  /**
   * Verifies: without the setting, no image is requested and the normal page background is kept.
   * Interacts with: ComnSettingsService.settings (stub), a stubbed Image, JoinComponent template.
   * Data: AppLandingBackgroundImage unset.
   */
  it('keeps the normal background without the setting', async () => {
    vi.stubGlobal('Image', FakeImage);
    const { container } = await renderJoin();

    expect(FakeImage.last).toBeUndefined();
    const page = container.querySelector('.join-page') as HTMLElement;
    expect(page.style.getPropertyValue('--landing-background')).toBe('');
    expect(page.classList.contains('has-background')).toBe(false);
  });
});
