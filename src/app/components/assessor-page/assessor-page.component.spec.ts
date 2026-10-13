// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
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

@Component({ selector: 'app-topbar', template: '', standalone: false })
class TopbarStub {
  @Input() title: string;
  @Input() topbarView: unknown;
  @Input() imageFilePath: string;
  @Output() urlNavigate = new EventEmitter<string>();
}
@Component({ selector: 'app-assessor-view', template: '', standalone: false })
class AssessorViewStub {
  @Input() loggedInUserId: string;
  @Input() userTheme: Theme;
  @Input() canEditCheckboxes: boolean;
}

const ME = 'user-me';
const ALL_BUT_CREATE_MSELS = Object.values(SystemPermission).filter((p) => p !== SystemPermission.CreateMsels);

function roles(...list: MselRole[]): UserMselRole[] {
  return list.map((role, i) => ({ id: `umr-${i}`, userId: ME, mselId: 'msel-1', role }));
}

async function renderAssessorPage(overrides: { permissions?: SystemPermission[]; myRoles?: UserMselRole[]; createdBy?: string } = {}) {
  const { permissions = [], myRoles = [], createdBy = 'someone-else' } = overrides;
  const msel: Msel = { id: 'msel-1', name: 'Exercise Alpha', createdBy, userMselRoles: myRoles };
  const apis = mselLoadApiStubs({ msel, userMselRoles: myRoles });
  // AssessorPageComponent loads the permissions itself in ngOnInit, so the
  // real service is provided over the stubbed endpoint, without priming it.
  const permissionApis = permissionApiStubs({ system: permissions });
  const { route } = activatedRouteStub({ msel: 'msel-1' });
  const rendered = await renderComponent(AssessorPageComponent, {
    imports: [MatIconModule],
    declarations: [AssessorPageComponent, TopbarStub, AssessorViewStub],
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
    expect(assessorView(fixture)?.canEditCheckboxes).toBe(true);
    expect(assessorView(fixture)?.loggedInUserId).toBe(ME);
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
    expect(assessorView(fixture)?.canEditCheckboxes).toBe(canEditCheckboxes);
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
   * Verifies: a Viewer who is also an Evaluator, and the MSEL's creator without a role row, see Access Denied (current behavior).
   * Interacts with: AssessorPageComponent.updateRolePermissions (roles.find).
   * Data: no system permission; Viewer then Evaluator rows; or createdBy the user with no role row.
   */
  it.each([
    { label: 'a Viewer who is also an Evaluator', myRoles: roles(MselRole.Viewer, MselRole.Evaluator), createdBy: 'someone-else' },
    { label: 'the MSEL creator without a role row', myRoles: [], createdBy: ME },
  ])('denies the assessor page to $label', async ({ myRoles, createdBy }) => {
    const { fixture } = await renderAssessorPage({ myRoles, createdBy });

    // Current behavior; see agent-docs/ui-test-bugs/blueprint.ui.md.
    expect(screen.getByRole('heading', { name: 'Access Denied' })).toBeInTheDocument();
    expect(assessorView(fixture)).toBeUndefined();
  });
});
