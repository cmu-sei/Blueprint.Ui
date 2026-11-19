// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, input, output } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Params } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { screen } from '@testing-library/angular';
import { of } from 'rxjs';
import { ComnAuthService, Theme } from '@cmusei/crucible-common';
import {
  AutomationRun,
  AutomationRunKind,
  AutomationService,
  AutomationTask,
  Msel,
  MselExecution,
  MselExecutionService,
  MselItemStatus,
  MselRole,
  SystemPermission,
  SystemPermissionsService,
  UserMselRole,
} from 'src/app/generated/blueprint.api';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { SignalRService } from 'src/app/services/signalr.service';
import { activatedRouteStub } from 'src/app/test-utils/activated-route';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { permissionApiStubs } from 'src/app/test-utils/mock-permission-data.service';
import {
  mselLoadApiProviders,
  mselLoadApiStubs,
} from 'src/app/test-utils/msel-load-api-stubs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { FacilitatorViewComponent } from '../facilitator-view/facilitator-view.component';
import { FacilitateComponent } from '../landing/facilitate/facilitate.component';
import { TopbarComponent } from '../shared/top-bar/topbar.component';
import { FacilitatorPageComponent } from './facilitator-page.component';

@Component({ selector: 'app-facilitate', template: '' })
class FacilitateStub {}

@Component({ selector: 'app-topbar', template: '' })
class TopbarStub {
  readonly title = input<string>(undefined);
  readonly topbarView = input<unknown>(undefined);
  readonly imageFilePath = input<string>(undefined);
  readonly urlNavigate = output<string>();
}
@Component({ selector: 'app-facilitator-view', template: '' })
class FacilitatorViewStub {
  readonly loggedInUserId = input<string>(undefined);
  readonly userTheme = input<Theme>(undefined);
  readonly canFacilitate = input<boolean>(undefined);
  readonly standalone = input<boolean>(undefined);
  readonly canChooseFields = input<boolean>(undefined);
}

const ME = 'user-me';

function roles(...list: MselRole[]): UserMselRole[] {
  return list.map((role, i) => ({
    id: `umr-${i}`,
    userId: ME,
    mselId: 'msel-1',
    role,
  }));
}

async function renderFacilitatorPage(
  overrides: {
    permissions?: SystemPermission[];
    myRoles?: UserMselRole[];
    createdBy?: string;
    queryParams?: Params;
    isTemplate?: boolean;
  } = {},
) {
  const {
    permissions = [],
    myRoles = [],
    createdBy = 'someone-else',
    queryParams = { msel: 'msel-1' },
  } = overrides;
  const msel: Msel = {
    id: 'msel-1',
    name: 'Exercise Alpha',
    status: MselItemStatus.Deployed,
    createdBy,
    userMselRoles: myRoles,
    isTemplate: overrides.isTemplate ?? false,
  };
  const apis = mselLoadApiStubs({ msel, userMselRoles: myRoles });
  const permissionApis = permissionApiStubs({ system: permissions });
  const automationApi = {
    getAutomationTasksByMsel: vi.fn(() => of<AutomationTask[]>([])),
    getAutomationRunsByMsel: vi.fn(() => of<AutomationRun[]>([])),
  } satisfies ApiStub<AutomationService>;
  const executionApi = {
    getMselExecution: vi.fn(() =>
      of<MselExecution>({ mselId: 'msel-1', positions: [] }),
    ),
  } satisfies ApiStub<MselExecutionService>;
  const signalR = {
    startConnection: vi.fn(() => Promise.resolve()),
    join: vi.fn(() => Promise.resolve()),
    selectMsel: vi.fn(),
  } satisfies Pick<SignalRService, 'startConnection' | 'join' | 'selectMsel'>;
  const { route } = activatedRouteStub(queryParams);
  const rendered = await renderComponent(FacilitatorPageComponent, {
    imports: [MatIconModule],
    childStubs: [
      { replace: TopbarComponent, with: TopbarStub },
      { replace: FacilitatorViewComponent, with: FacilitatorViewStub },
      { replace: FacilitateComponent, with: FacilitateStub },
    ],
    providers: [
      ...mselLoadApiProviders(apis),
      {
        provide: SystemPermissionsService,
        useValue: permissionApis.systemPermissions,
      },
      PermissionDataService,
      { provide: AutomationService, useValue: automationApi },
      { provide: MselExecutionService, useValue: executionApi },
      { provide: SignalRService, useValue: signalR },
      { provide: ActivatedRoute, useValue: route },
      {
        provide: ComnAuthService,
        useValue: { user$: of({ profile: { sub: ME, name: 'Me' } }) } as Pick<
          ComnAuthService,
          'user$'
        >,
      },
    ],
  });
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();
  return { ...rendered, apis, automationApi, executionApi, signalR };
}

function view(
  fixture: ComponentFixture<unknown>,
): FacilitatorViewStub | undefined {
  return fixture.debugElement.query(By.directive(FacilitatorViewStub))
    ?.componentInstance as FacilitatorViewStub | undefined;
}

describe('FacilitatorPageComponent', () => {
  /**
   * Verifies: the page loads the MSEL with its tasks, exercise runs and position, and selects it on the hub so its runs arrive live.
   * Interacts with: the MSEL, automation and execution endpoints (stubs), SignalRService (stub).
   * Data: msel=msel-1; the Facilitator role.
   */
  it('loads the exercise and follows it live', async () => {
    const { apis, automationApi, executionApi, signalR } =
      await renderFacilitatorPage({
        myRoles: roles(MselRole.Facilitator),
      });

    expect(apis.msel.getMsel).toHaveBeenCalledWith('msel-1');
    expect(automationApi.getAutomationTasksByMsel).toHaveBeenCalledWith(
      'msel-1',
    );
    expect(automationApi.getAutomationRunsByMsel).toHaveBeenCalledWith(
      'msel-1',
      AutomationRunKind.Exercise,
    );
    expect(executionApi.getMselExecution).toHaveBeenCalledWith('msel-1');
    expect(signalR.join).toHaveBeenCalled();
    expect(signalR.selectMsel).toHaveBeenCalledWith('msel-1');
  });

  /**
   * Verifies: Owner and Facilitator act on the view, Editor and Approver open it read-only.
   * Interacts with: updateRolePermissions, FacilitatorViewStub inputs.
   * Data: no system permission; one MSEL role per row.
   */
  it.each([
    { role: MselRole.Owner, canFacilitate: true },
    { role: MselRole.Facilitator, canFacilitate: true },
    { role: MselRole.Editor, canFacilitate: false },
    { role: MselRole.Approver, canFacilitate: false },
  ])(
    'shows the view to a $role, canFacilitate $canFacilitate',
    async ({ role, canFacilitate }) => {
      const { fixture } = await renderFacilitatorPage({ myRoles: roles(role) });

      expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
      expect(view(fixture)?.canFacilitate()).toBe(canFacilitate);
      expect(view(fixture)?.standalone()).toBe(true);
    },
  );

  /**
   * Verifies: an Evaluator, a Viewer and a Move Editor are denied the page, and so is a CreateMsels holder without a role.
   * Interacts with: updateRolePermissions, the page template.
   * Data: one case per row.
   */
  it.each([
    {
      label: 'an Evaluator',
      myRoles: roles(MselRole.Evaluator),
      permissions: [],
    },
    { label: 'a Viewer', myRoles: roles(MselRole.Viewer), permissions: [] },
    {
      label: 'a Move Editor',
      myRoles: roles(MselRole.MoveEditor),
      permissions: [],
    },
    {
      label: 'a CreateMsels holder',
      myRoles: [],
      permissions: [SystemPermission.CreateMsels],
    },
  ])('denies the page to $label', async ({ myRoles, permissions }) => {
    const { fixture } = await renderFacilitatorPage({ myRoles, permissions });

    expect(
      screen.getByRole('heading', { name: 'Access Denied' }),
    ).toBeInTheDocument();
    expect(view(fixture)).toBeUndefined();
  });

  /**
   * Verifies: ViewMsels opens the view read-only, EditMsels lets the user act, a template is never run, and the creator is its Owner.
   * Interacts with: canViewFacilitator, canFacilitate.
   * Data: one case per row, with no MSEL role.
   */
  it.each([
    {
      label: 'ViewMsels',
      permissions: [SystemPermission.ViewMsels],
      createdBy: 'someone-else',
      isTemplate: false,
      canFacilitate: false,
    },
    {
      label: 'EditMsels and ViewMsels',
      permissions: [SystemPermission.ViewMsels, SystemPermission.EditMsels],
      createdBy: 'someone-else',
      isTemplate: false,
      canFacilitate: true,
    },
    {
      label: 'the creator',
      permissions: [],
      createdBy: ME,
      isTemplate: false,
      canFacilitate: true,
    },
    {
      label: 'the creator of a template',
      permissions: [],
      createdBy: ME,
      isTemplate: true,
      canFacilitate: false,
    },
  ])(
    'counts $label',
    async ({ permissions, createdBy, isTemplate, canFacilitate }) => {
      const { fixture } = await renderFacilitatorPage({
        permissions,
        createdBy,
        isTemplate,
      });

      expect(view(fixture)?.canFacilitate()).toBe(canFacilitate);
    },
  );

  /**
   * Verifies: without an msel query parameter the page offers the Facilitate list and loads no MSEL.
   * Interacts with: FacilitateStub, the MSEL endpoints (stubs, not called).
   * Data: no query parameters.
   */
  it('offers the Facilitate list when no exercise is chosen', async () => {
    const { fixture, apis } = await renderFacilitatorPage({ queryParams: {} });

    expect(
      fixture.debugElement.query(By.directive(FacilitateStub)),
    ).not.toBeNull();
    expect(view(fixture)).toBeUndefined();
    expect(apis.msel.getMsel).not.toHaveBeenCalled();
  });
});
