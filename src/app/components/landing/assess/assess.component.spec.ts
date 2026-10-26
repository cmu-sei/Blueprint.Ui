// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { screen } from '@testing-library/angular';
import { Observable, of, throwError } from 'rxjs';
import { ComnAuthService, ComnSettingsService } from '@cmusei/crucible-common';
import {
  Msel,
  MselCompetency,
  MselCompetencyService,
  MselImageService,
  MselItemStatus,
  MselRole,
  MselService,
  SystemPermission,
  SystemPermissionsService,
  User,
  UserService,
} from 'src/app/generated/blueprint.api';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { AssessComponent } from './assess.component';
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

const ME = 'user-me';
const msel = (id: string, name: string, roles: MselRole[], extra: Partial<Msel> = {}): Msel => ({
  id,
  name,
  status: MselItemStatus.Deployed,
  userMselRoles: roles.map((role) => ({ userId: ME, mselId: id, role })),
  ...extra,
});
const ALPHA = msel('msel-1', 'Exercise Alpha', [MselRole.Owner]);
const BRAVO = msel('msel-2', 'Exercise Bravo', [MselRole.Viewer, MselRole.Evaluator]);
const CHARLIE = msel('msel-3', 'Exercise Charlie', [MselRole.Viewer]);
const DELTA = msel('msel-4', 'Exercise Delta', [MselRole.Owner], { status: MselItemStatus.Approved });
const competencies = (n: number): MselCompetency[] => Array.from({ length: n }, (_, i) => ({ competencyId: `c-${i}` }));

async function renderAssess(
  overrides: {
    msels?: Msel[];
    mselsFail?: boolean;
    permissions?: SystemPermission[];
    competencies?: (mselId: string) => Observable<MselCompetency[]>;
  } = {},
) {
  const { msels = [ALPHA, BRAVO, CHARLIE, DELTA], permissions = [] } = overrides;
  const mselApi = {
    getMyMsels: vi.fn(() => (overrides.mselsFail ? throwError(() => new Error('msels down')) : of(structuredClone(msels)))),
  } satisfies ApiStub<MselService>;
  const competencyApi = {
    getMselCompetencies: vi.fn(overrides.competencies ?? (() => of(competencies(2)))),
  } satisfies ApiStub<MselCompetencyService>;
  const userApi = {
    getUsers: vi.fn(() => of<User[]>([])),
  } satisfies ApiStub<UserService>;
  const imageApi = {
    getMselImage: vi.fn(() => of(new Blob(['image'], { type: 'image/png' }))),
  } satisfies ApiStub<MselImageService>;
  // The page loads the permissions itself, so the real service is provided
  // over the stubbed endpoint, without priming it.
  const permissionApis = permissionApiStubs({ system: permissions });
  const rendered = await renderComponent(AssessComponent, {
    imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule],
    childStubs: [{ replace: TopbarComponent, with: TopbarStub }],
    providers: [
      { provide: SystemPermissionsService, useValue: permissionApis.systemPermissions },
      PermissionDataService,
      { provide: MselService, useValue: mselApi },
      { provide: MselCompetencyService, useValue: competencyApi },
      { provide: MselImageService, useValue: imageApi },
      { provide: UserService, useValue: userApi },
      {
        provide: ComnSettingsService,
        useValue: { settings: { AppTopBarImage: '/assets/img/logo-white.png' } } satisfies Pick<ComnSettingsService, 'settings'>,
      },
      {
        provide: ComnAuthService,
        useValue: { user$: of({ profile: { sub: ME, name: 'Me' } }) } as Pick<ComnAuthService, 'user$'>,
      },
    ],
  });
  rendered.fixture.detectChanges();
  return { ...rendered, mselApi, competencyApi, imageApi };
}

const assessLinks = () =>
  screen.queryAllByRole('link', { name: 'Assess' }).map((link) => [link.getAttribute('href'), link.getAttribute('title')]);

describe('AssessComponent', () => {
  // jsdom has no object URLs.
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:photo');
    URL.revokeObjectURL = vi.fn();
  });

  /**
   * Verifies: the list offers the deployed MSELs where the user is Owner or Evaluator (any of their roles), each linking to its assessor view.
   * Interacts with: MselService.getMyMsels (stub), real PermissionDataService (no grants), routerLink (real router).
   * Data: Alpha Owner, Bravo Viewer + Evaluator, Charlie Viewer only (near miss on role), Delta Owner but Approved (near miss on status).
   */
  it('lists the running events the user can assess', async () => {
    await renderAssess();

    expect(assessLinks()).toEqual([
      ['/assess?msel=msel-1', 'Assess Exercise Alpha'],
      ['/assess?msel=msel-2', 'Assess Exercise Bravo'],
    ]);
    expect(screen.queryByText('Exercise Charlie')).not.toBeInTheDocument();
    expect(screen.queryByText('Exercise Delta')).not.toBeInTheDocument();
    expect(screen.getAllByText('2 competencies')).toHaveLength(2);
  });

  /**
   * Verifies: with CreateMsels every deployed, non-template MSEL is offered whatever the user's roles.
   * Interacts with: real PermissionDataService (grants: CreateMsels).
   * Data: the default list plus a deployed template (excluded).
   */
  it('lists every running event for a system admin', async () => {
    const template = msel('msel-5', 'Template Echo', [MselRole.Owner], { isTemplate: true });
    await renderAssess({ msels: [ALPHA, BRAVO, CHARLIE, DELTA, template], permissions: [SystemPermission.CreateMsels] });

    expect(assessLinks().map(([href]) => href)).toEqual(['/assess?msel=msel-1', '/assess?msel=msel-2', '/assess?msel=msel-3']);
  });

  /**
   * Verifies: an event with no competencies says so but still opens, since its assessor view shows evidence and checkbox fields; one competency reads in the singular.
   * Interacts with: MselCompetencyService.getMselCompetencies (stub answering per MSEL).
   * Data: Alpha has 0 competencies, Bravo has 1.
   */
  it('still opens an event with no competencies', async () => {
    await renderAssess({ competencies: (id) => of(competencies(id === 'msel-1' ? 0 : 1)) });

    expect(screen.getByText('No competencies to assess')).toBeInTheDocument();
    expect(screen.getByText('1 competency')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Assess' })).not.toBeInTheDocument();
    expect(assessLinks()).toEqual([
      ['/assess?msel=msel-1', 'Assess Exercise Alpha'],
      ['/assess?msel=msel-2', 'Assess Exercise Bravo'],
    ]);
  });

  /**
   * Verifies: a failed competency count leaves the card usable and shows no count.
   * Interacts with: MselCompetencyService.getMselCompetencies (stub, errors).
   * Data: Alpha only; the count request fails.
   */
  it('keeps the card usable when the count fails', async () => {
    const { container } = await renderAssess({ msels: [ALPHA], competencies: () => throwError(() => new Error('boom')) });

    expect(assessLinks()).toEqual([['/assess?msel=msel-1', 'Assess Exercise Alpha']]);
    expect(container.querySelector('.card-competencies')?.textContent.trim()).toBe('');
  });

  /**
   * Verifies: a failed request ends the spinner and says the events could not be loaded, instead of loading forever.
   * Interacts with: MselService.getMyMsels (stub, errors).
   * Data: the MSEL list request fails.
   */
  it('says so when the events fail to load', async () => {
    await renderAssess({ mselsFail: true });

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByText(/could not be loaded/)).toBeInTheDocument();
  });

  /**
   * Verifies: with nothing assessable the empty state shows and no competency counts are requested.
   * Interacts with: MselCompetencyService.getMselCompetencies (stub, not called).
   * Data: Charlie (Viewer) and Delta (Approved) only.
   */
  it('shows the empty state when there is nothing to assess', async () => {
    const { competencyApi } = await renderAssess({ msels: [CHARLIE, DELTA] });

    expect(screen.getByText('No running events available to assess')).toBeInTheDocument();
    expect(competencyApi.getMselCompetencies).not.toHaveBeenCalled();
  });
});
