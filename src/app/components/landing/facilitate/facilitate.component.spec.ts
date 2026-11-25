// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Component, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { screen } from '@testing-library/angular';
import { Observable, of, throwError } from 'rxjs';
import {
  ComnAuthService,
  ComnSettingsService,
  CrucibleThemeService,
} from '@cmusei/crucible-common';
import {
  AutomationRun,
  AutomationRunKind,
  AutomationService,
  AutomationStatus,
  Msel,
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
import { ApiStub } from 'src/app/test-utils/api-stub';
import { permissionApiStubs } from 'src/app/test-utils/mock-permission-data.service';
import { renderComponent } from 'src/app/test-utils/render-component';
import { TopbarComponent } from '../../shared/top-bar/topbar.component';
import { FacilitateComponent } from './facilitate.component';

@Component({ selector: 'app-topbar', template: '' })
class TopbarStub {
  readonly title = input<string>(undefined);
  readonly topbarView = input<unknown>(undefined);
  readonly imageFilePath = input<string>(undefined);
  readonly urlNavigate = output<string>();
}

const ME = 'user-me';
const msel = (
  id: string,
  name: string,
  roles: MselRole[],
  extra: Partial<Msel> = {},
): Msel => ({
  id,
  name,
  status: MselItemStatus.Deployed,
  deploymentId: `dep-${id}`,
  userMselRoles: roles.map((role) => ({ userId: ME, mselId: id, role })),
  ...extra,
});
const ALPHA = msel('msel-1', 'Exercise Alpha', [MselRole.Facilitator], {
  currentMoveNumber: 2,
  currentGroupNumber: 1,
  automationPaused: true,
});
const BRAVO = msel('msel-2', 'Exercise Bravo', [MselRole.Editor]);
const CHARLIE = msel('msel-3', 'Exercise Charlie', [MselRole.Evaluator]);
const DELTA = msel('msel-4', 'Exercise Delta', [MselRole.Facilitator], {
  status: MselItemStatus.Approved,
});

async function renderFacilitate(
  overrides: {
    msels?: Msel[];
    mselsFail?: boolean;
    permissions?: SystemPermission[];
    runs?: (mselId: string) => Observable<AutomationRun[]>;
  } = {},
) {
  const { msels = [ALPHA, BRAVO, CHARLIE, DELTA], permissions = [] } =
    overrides;
  const mselApi = {
    getMyMsels: vi.fn(() =>
      overrides.mselsFail
        ? throwError(() => new Error('msels down'))
        : of(structuredClone(msels)),
    ),
  } satisfies ApiStub<MselService>;
  const automationApi = {
    getAutomationRunsByMsel: vi.fn<
      (mselId: string, kind?: AutomationRunKind) => Observable<AutomationRun[]>
    >(overrides.runs ?? (() => of([]))),
  } satisfies ApiStub<AutomationService>;
  const permissionApis = permissionApiStubs({ system: permissions });
  const rendered = await renderComponent(FacilitateComponent, {
    imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule],
    childStubs: [{ replace: TopbarComponent, with: TopbarStub }],
    providers: [
      {
        provide: CrucibleThemeService,
        useValue: { isDarkMode: signal(false) },
      },
      {
        provide: SystemPermissionsService,
        useValue: permissionApis.systemPermissions,
      },
      PermissionDataService,
      { provide: MselService, useValue: mselApi },
      { provide: AutomationService, useValue: automationApi },
      {
        provide: MselImageService,
        useValue: {
          getMselImage: vi.fn(() =>
            of(new Blob(['image'], { type: 'image/png' })),
          ),
        } satisfies ApiStub<MselImageService>,
      },
      {
        provide: UserService,
        useValue: {
          getUsers: vi.fn(() => of<User[]>([])),
        } satisfies ApiStub<UserService>,
      },
      {
        provide: ComnSettingsService,
        useValue: { settings: { AppTopBarImage: '' } } satisfies Pick<
          ComnSettingsService,
          'settings'
        >,
      },
      {
        provide: ComnAuthService,
        useValue: { user$: of({ profile: { sub: ME, name: 'Me' } }) } as Pick<
          ComnAuthService,
          'user$'
        >,
      },
    ],
  });
  rendered.fixture.detectChanges();
  return { ...rendered, mselApi, automationApi };
}

const links = () =>
  screen
    .queryAllByRole('link', { name: 'Facilitate' })
    .map((link) => [link.getAttribute('href'), link.getAttribute('title')]);

describe('FacilitateComponent', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:photo');
    URL.revokeObjectURL = vi.fn();
  });

  /**
   * Verifies: the list offers the deployed MSELs whose Facilitator View the user can open, each linking to it.
   * Interacts with: MselService.getMyMsels (stub), facilitatableMsels, routerLink.
   * Data: Alpha as Facilitator, Bravo as Editor (read-only), Charlie as Evaluator (near miss on role), Delta Approved (near miss on status).
   */
  it('lists the running exercises the user can facilitate', async () => {
    await renderFacilitate();

    expect(links()).toEqual([
      ['/facilitate?msel=msel-1', 'Facilitate Exercise Alpha'],
      ['/facilitate?msel=msel-2', 'Facilitate Exercise Bravo'],
    ]);
  });

  /**
   * Verifies: ViewMsels lists every running exercise without a role.
   * Interacts with: the ViewMsels permission.
   * Data: ViewMsels; Charlie as Evaluator only.
   */
  it('lists every running exercise for ViewMsels', async () => {
    await renderFacilitate({
      msels: [CHARLIE],
      permissions: [SystemPermission.ViewMsels],
    });

    expect(links()).toEqual([
      ['/facilitate?msel=msel-3', 'Facilitate Exercise Charlie'],
    ]);
  });

  /**
   * Verifies: a card says where its exercise is, that its automation is paused, and how many of its tasks' newest runs in this deployment failed or are running.
   * Interacts with: AutomationService.getAutomationRunsByMsel (stub), DeploymentRuns.
   * Data: Alpha at move 2 group 1, paused; t-1 failed, t-2 running, and an earlier deployment's failed run.
   */
  it('says how each exercise stands', async () => {
    const { automationApi } = await renderFacilitate({
      msels: [ALPHA, BRAVO],
      runs: (mselId) =>
        of(
          mselId === 'msel-1'
            ? [
                {
                  id: 'a',
                  automationTaskId: 't-1',
                  deploymentId: 'dep-msel-1',
                  status: AutomationStatus.Failed,
                },
                {
                  id: 'b',
                  automationTaskId: 't-2',
                  deploymentId: 'dep-msel-1',
                  status: AutomationStatus.Running,
                },
                {
                  id: 'c',
                  automationTaskId: 't-3',
                  deploymentId: 'old',
                  status: AutomationStatus.Failed,
                },
              ]
            : [],
        ),
    });

    expect(automationApi.getAutomationRunsByMsel).toHaveBeenCalledWith(
      'msel-1',
      AutomationRunKind.Exercise,
    );
    expect(
      screen.getByText(
        /Move 2 · Group 1\s*· Automation paused\s*· 1 failed\s*· 1 running/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Not started')).toBeInTheDocument();
  });

  /**
   * Verifies: with none to offer the list says so, and a failed load says to reload.
   * Interacts with: the empty state.
   * Data: only Charlie as Evaluator; then the MSELs fail to load.
   */
  it.each([
    {
      label: 'none to facilitate',
      overrides: { msels: [CHARLIE] },
      text: 'No running exercises available to facilitate',
    },
    {
      label: 'a failed load',
      overrides: { mselsFail: true },
      text: /could not be loaded/,
    },
  ])('says when there is $label', async ({ overrides, text }) => {
    await renderFacilitate(overrides);

    expect(screen.getByText(text)).toBeInTheDocument();
    expect(links()).toEqual([]);
  });
});
