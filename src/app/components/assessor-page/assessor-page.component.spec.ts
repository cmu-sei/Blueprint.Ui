// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { Component, input, output } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Params } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { screen } from '@testing-library/angular';
import { of } from 'rxjs';
import { ComnAuthService, Theme } from '@cmusei/crucible-common';
import { Msel, MselRole, SystemPermission, SystemPermissionsService, UserMselRole } from 'src/app/generated/blueprint.api';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { AssessorPageComponent } from './assessor-page.component';
import { activatedRouteStub } from 'src/app/test-utils/activated-route';
import { renderComponent } from 'src/app/test-utils/render-component';
import { permissionApiStubs } from 'src/app/test-utils/mock-permission-data.service';
import { mselLoadApiProviders, mselLoadApiStubs } from 'src/app/test-utils/msel-load-api-stubs';
import { TopbarComponent } from '../shared/top-bar/topbar.component';
import { AssessorViewComponent } from '../assessor-view/assessor-view.component';
import { AssessComponent } from '../landing/assess/assess.component';

@Component({ selector: 'app-assess', template: '' })
class AssessStub {}

@Component({ selector: 'app-topbar', template: '' })
class TopbarStub {
  readonly title = input<string>(undefined);
  readonly topbarView = input<unknown>(undefined);
  readonly imageFilePath = input<string>(undefined);
  readonly urlNavigate = output<string>();
}
@Component({ selector: 'app-assessor-view', template: '' })
class AssessorViewStub {
  readonly loggedInUserId = input<string>(undefined);
  readonly userTheme = input<Theme>(undefined);
  readonly canEditCheckboxes = input<boolean>(undefined);
  readonly standalone = input<boolean>(undefined);
  readonly canChooseFields = input<boolean>(undefined);
}

const ME = 'user-me';
const ALL_BUT_CREATE_MSELS = Object.values(SystemPermission).filter((p) => p !== SystemPermission.CreateMsels);

function roles(...list: MselRole[]): UserMselRole[] {
  return list.map((role, i) => ({ id: `umr-${i}`, userId: ME, mselId: 'msel-1', role }));
}

async function renderAssessorPage(
  overrides: { permissions?: SystemPermission[]; myRoles?: UserMselRole[]; createdBy?: string; queryParams?: Params } = {},
) {
  const { permissions = [], myRoles = [], createdBy = 'someone-else', queryParams = { msel: 'msel-1' } } = overrides;
  const msel: Msel = { id: 'msel-1', name: 'Exercise Alpha', createdBy, userMselRoles: myRoles };
  const apis = mselLoadApiStubs({ msel, userMselRoles: myRoles });
  // AssessorPageComponent loads the permissions itself in ngOnInit, so the
  // real service is provided over the stubbed endpoint, without priming it.
  const permissionApis = permissionApiStubs({ system: permissions });
  const { route } = activatedRouteStub(queryParams);
  const rendered = await renderComponent(AssessorPageComponent, {
    imports: [MatIconModule],
    childStubs: [
      { replace: TopbarComponent, with: TopbarStub },
      { replace: AssessorViewComponent, with: AssessorViewStub },
      { replace: AssessComponent, with: AssessStub },
    ],
    providers: [
      ...mselLoadApiProviders(apis),
      { provide: SystemPermissionsService, useValue: permissionApis.systemPermissions },
      PermissionDataService,
      { provide: ActivatedRoute, useValue: route },
      {
        provide: ComnAuthService,
        useValue: { user$: of({ profile: { sub: ME, name: 'Me' } }) } as Pick<ComnAuthService, 'user$'>,
      },
    ],
  });
  rendered.fixture.detectChanges();
  return { ...rendered, apis };
}

function assessorView(fixture: ComponentFixture<unknown>): AssessorViewStub | undefined {
  return fixture.debugElement.query(By.directive(AssessorViewStub))?.componentInstance;
}

describe('AssessorPageComponent', () => {
  /**
   * Verifies: the page loads the MSEL and its user roles, and with CreateMsels shows the assessor view with checkbox editing.
   * Interacts with: the MSEL endpoints (stubs), real PermissionDataService over SystemPermissionsService (stub), AssessorViewStub input.
   * Data: msel=msel-1; CreateMsels; no MSEL role.
   */
  it('lets a content developer edit the assessor checkboxes', async () => {
    const { fixture, apis } = await renderAssessorPage({ permissions: [SystemPermission.CreateMsels] });

    expect(apis.msel.getMsel).toHaveBeenCalledWith('msel-1');
    expect(apis.userMselRole.getUserMselRolesByMsel).toHaveBeenCalledWith('msel-1');
    expect(assessorView(fixture)?.canEditCheckboxes()).toBe(true);
    expect(assessorView(fixture)?.loggedInUserId()).toBe(ME);
  });

  /**
   * Verifies: the MSEL role decides access: Owner and Evaluator may view and edit, Editor and Approver may only view.
   * Interacts with: AssessorPageComponent.updateRolePermissions, real UserMselRoleQuery, AssessorViewStub input.
   * Data: no system permission; one MSEL role per row.
   */
  it.each([
    { role: MselRole.Owner, canEditCheckboxes: true },
    { role: MselRole.Evaluator, canEditCheckboxes: true },
    { role: MselRole.Editor, canEditCheckboxes: false },
    { role: MselRole.Approver, canEditCheckboxes: false },
  ])('shows the assessor view to a $role with canEditCheckboxes $canEditCheckboxes', async ({ role, canEditCheckboxes }) => {
    const { fixture } = await renderAssessorPage({ myRoles: roles(role) });

    expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
    expect(assessorView(fixture)?.canEditCheckboxes()).toBe(canEditCheckboxes);
  });

  /**
   * Verifies: the page shows the view standalone, and only an Owner or an EditMsels holder may choose its data fields.
   * Interacts with: AssessorPageComponent.updateRolePermissions, AssessorViewStub inputs.
   * Data: one row per case; EditMsels alone (near miss for CreateMsels) still grants choosing.
   */
  it.each([
    { label: 'an Owner', myRoles: roles(MselRole.Owner), permissions: [], canChooseFields: true },
    { label: 'an Evaluator', myRoles: roles(MselRole.Evaluator), permissions: [], canChooseFields: false },
    { label: 'an Evaluator with EditMsels', myRoles: roles(MselRole.Evaluator), permissions: [SystemPermission.EditMsels], canChooseFields: true },
  ])('lets $label choose the assessor fields: $canChooseFields', async ({ myRoles, permissions, canChooseFields }) => {
    const { fixture } = await renderAssessorPage({ myRoles, permissions });

    expect(assessorView(fixture)?.standalone()).toBe(true);
    expect(assessorView(fixture)?.canChooseFields()).toBe(canChooseFields);
  });

  /**
   * Verifies: a Viewer or Move Editor without CreateMsels is denied the assessor page.
   * Interacts with: AssessorPageComponent.updateRolePermissions, AssessorPageComponent template.
   * Data: every permission but CreateMsels (near miss); MSEL role Viewer, or MoveEditor.
   */
  it.each([MselRole.Viewer, MselRole.MoveEditor])('denies the assessor page to a %s without CreateMsels', async (role) => {
    const { fixture } = await renderAssessorPage({ permissions: ALL_BUT_CREATE_MSELS, myRoles: roles(role) });

    expect(screen.getByRole('heading', { name: 'Access Denied' })).toBeInTheDocument();
    expect(assessorView(fixture)).toBeUndefined();
  });

  /**
   * Verifies: a user holding several roles on the MSEL gets the access of the strongest one, so a Viewer who is also an Evaluator can assess.
   * Interacts with: AssessorPageComponent.updateRolePermissions (every role row counts).
   * Data: no system permission; Viewer then Evaluator rows for the user.
   */
  it('lets a Viewer who is also an Evaluator assess', async () => {
    const { fixture } = await renderAssessorPage({ myRoles: roles(MselRole.Viewer, MselRole.Evaluator), createdBy: 'someone-else' });

    expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
    expect(assessorView(fixture)?.canEditCheckboxes()).toBe(true);
  });

  /**
   * Verifies: the MSEL's creator without a role row sees Access Denied (current behavior).
   * Interacts with: AssessorPageComponent.updateRolePermissions.
   * Data: no system permission; createdBy the user with no role row.
   */
  it('denies the assessor page to the MSEL creator without a role row', async () => {
    const { fixture } = await renderAssessorPage({ myRoles: [], createdBy: ME });

    // Current behavior: the page reads only the role store, which has no row for the creator.
    expect(screen.getByRole('heading', { name: 'Access Denied' })).toBeInTheDocument();
    expect(assessorView(fixture)).toBeUndefined();
  });
  /**
   * Verifies: without an msel query parameter the page offers the Assess list instead of a blank page, and loads no MSEL.
   * Interacts with: AssessStub (in place of AssessComponent), the MSEL endpoints (stubs, not called).
   * Data: no query parameters; CreateMsels.
   */
  it('offers the Assess list when no event is chosen', async () => {
    const { fixture, apis } = await renderAssessorPage({ permissions: [SystemPermission.CreateMsels], queryParams: {} });

    expect(fixture.debugElement.query(By.directive(AssessStub))).not.toBeNull();
    expect(assessorView(fixture)).toBeUndefined();
    expect(apis.msel.getMsel).not.toHaveBeenCalled();
  });
});
