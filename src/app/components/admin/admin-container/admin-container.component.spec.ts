// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Component, EventEmitter, Input, Output, Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { ComnAuthService } from '@cmusei/crucible-common';
import {
  CompetencyFramework,
  CompetencyFrameworkService,
  HealthCheckService,
  InjectType,
  InjectTypeService,
  SystemPermission,
  SystemPermissionsService,
  Unit,
  UnitService,
  User,
  UserService,
} from 'src/app/generated/blueprint.api';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { UIDataService } from 'src/app/data/ui/ui-data.service';
import { ApplicationArea, SignalRService } from 'src/app/services/signalr.service';
import { AdminContainerComponent } from './admin-container.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { activatedRouteStub } from 'src/app/test-utils/activated-route';
import { renderComponent } from 'src/app/test-utils/render-component';
import { permissionApiStubs } from 'src/app/test-utils/mock-permission-data.service';

@Component({ selector: 'app-topbar', template: '' })
class TopbarStub {
  @Input() title?: string;
  @Input() topbarView?: string;
  @Output() urlNavigate = new EventEmitter<string>();
}
@Component({ selector: 'app-admin-units', template: '' })
class AdminUnitsStub {
  @Input() canManage: boolean;
}
@Component({ selector: 'app-admin-users', template: '' })
class AdminUsersStub {}
@Component({ selector: 'app-admin-roles', template: '' })
class AdminRolesStub {}
@Component({ selector: 'app-admin-groups', template: '' })
class AdminGroupsStub {}
@Component({ selector: 'app-data-field-list', template: '' })
class DataFieldListStub {
  @Input() loggedInUserId: string;
  @Input() showTemplates: boolean;
}
@Component({ selector: 'app-admin-inject-types', template: '' })
class AdminInjectTypesStub {
  @Input() loggedInUserId: string;
  @Input() canEdit: boolean;
}
@Component({ selector: 'app-admin-competency-frameworks', template: '' })
class AdminCompetencyFrameworksStub {
  @Input() loggedInUserId: string;
  @Input() canEdit: boolean;
}
@Component({ selector: 'app-admin-proficiency-scales', template: '' })
class AdminProficiencyScalesStub {
  @Input() loggedInUserId: string;
  @Input() canEdit: boolean;
}
@Component({ selector: 'app-admin-catalog-list', template: '' })
class AdminCatalogListStub {
  @Input() loggedInUserId: string;
  @Input() canEdit: boolean;
}
@Component({ selector: 'app-organization-list', template: '' })
class OrganizationListStub {
  @Input() loggedInUserId: string;
  @Input() canEdit: boolean;
  @Input() showTemplates: boolean;
}
@Component({ selector: 'app-card-list', template: '' })
class CardListStub {
  @Input() loggedInUserId: string;
  @Input() canEdit: boolean;
  @Input() showTemplates: boolean;
}
@Component({ selector: 'app-cite-action-list', template: '' })
class CiteActionListStub {
  @Input() loggedInUserId: string;
  @Input() canEdit: boolean;
  @Input() showTemplates: boolean;
}
@Component({ selector: 'app-cite-duty-list', template: '' })
class CiteDutyListStub {
  @Input() loggedInUserId: string;
  @Input() canEdit: boolean;
  @Input() showTemplates: boolean;
}

const CHILD_STUBS = [
  TopbarStub,
  AdminUnitsStub,
  AdminUsersStub,
  AdminRolesStub,
  AdminGroupsStub,
  DataFieldListStub,
  AdminInjectTypesStub,
  AdminCompetencyFrameworksStub,
  AdminProficiencyScalesStub,
  AdminCatalogListStub,
  OrganizationListStub,
  CardListStub,
  CiteActionListStub,
  CiteDutyListStub,
];

async function renderAdmin(
  overrides: { permissions?: SystemPermission[]; savedTab?: string } = {},
) {
  const { permissions = [], savedTab } = overrides;
  if (savedTab) {
    localStorage.setItem('uiState', JSON.stringify({ selectedAdminTab: savedTab }));
  }
  const health = {
    getVersion: vi.fn(() => of('2.4.0+abc123')),
  } satisfies ApiStub<HealthCheckService>;
  const users = {
    getUsers: vi.fn(() => of<User[]>([])),
  } satisfies ApiStub<UserService>;
  const units = {
    getUnits: vi.fn(() => of<Unit[]>([])),
  } satisfies ApiStub<UnitService>;
  const injectTypes = {
    getInjectTypes: vi.fn(() => of<InjectType[]>([])),
  } satisfies ApiStub<InjectTypeService>;
  const frameworks = {
    getCompetencyFrameworks: vi.fn(() => of<CompetencyFramework[]>([])),
  } satisfies ApiStub<CompetencyFrameworkService>;
  const signalR: Pick<SignalRService, 'startConnection' | 'join' | 'leave'> = {
    startConnection: vi.fn(() => Promise.resolve()),
    join: vi.fn(),
    leave: vi.fn(),
  };
  // The data services read queryParamMap; the component reads ?returnUrl
  // from the (live) snapshot.
  const { route } = activatedRouteStub();
  // AdminContainerComponent loads the permissions itself in ngOnInit, so the
  // real service is provided over the stubbed endpoint, without priming it.
  const permissionApis = permissionApiStubs({ system: permissions });
  const auth: Pick<ComnAuthService, 'user$' | 'logout'> = {
    user$: of({ profile: { sub: 'user-1', name: 'Alice Admin' } }) as ComnAuthService['user$'],
    logout: vi.fn(),
  };

  const rendered = await renderComponent(AdminContainerComponent, {
    imports: [MatSidenavModule, MatToolbarModule, MatListModule, MatIconModule, MatButtonModule, ...CHILD_STUBS],
    declarations: [AdminContainerComponent],
    providers: [
      { provide: SystemPermissionsService, useValue: permissionApis.systemPermissions },
      PermissionDataService,
      { provide: HealthCheckService, useValue: health },
      { provide: UserService, useValue: users },
      { provide: UnitService, useValue: units },
      { provide: InjectTypeService, useValue: injectTypes },
      { provide: CompetencyFrameworkService, useValue: frameworks },
      { provide: SignalRService, useValue: signalR },
      { provide: ComnAuthService, useValue: auth },
      { provide: ActivatedRoute, useValue: route },
    ],
  });
  return { ...rendered, signalR, units, permissionApis };
}

const nav = () => screen.getByRole('navigation', { name: 'Administration sections' });

// The View* permissions that open an admin section. Everything else is a near
// miss for "no sections".
const SECTION_VIEWS: SystemPermission[] = [
  SystemPermission.ViewUnits,
  SystemPermission.ViewDataFields,
  SystemPermission.ViewInjectTypes,
  SystemPermission.ViewCatalogs,
  SystemPermission.ViewOrganizations,
  SystemPermission.ViewGalleryCards,
  SystemPermission.ViewCiteActions,
  SystemPermission.ViewCiteDuties,
  SystemPermission.ViewCompetencyFrameworks,
  SystemPermission.ViewUsers,
  SystemPermission.ViewRoles,
  SystemPermission.ViewGroups,
];
const ALL_PERMISSIONS = Object.values(SystemPermission);
const MANAGE_PERMISSIONS = ALL_PERMISSIONS.filter((p) => p.startsWith('Manage'));

// The rendered instance of a child stub, to read the inputs the container bound.
function child<T>(fixture: ComponentFixture<unknown>, stub: Type<T>): T | undefined {
  return fixture.debugElement.query(By.directive(stub))?.componentInstance;
}

describe('AdminContainerComponent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  /**
   * Verifies: without any section View permission the navigation lists no sections and no section is rendered, even with every Manage permission.
   * Interacts with: real PermissionDataService over SystemPermissionsService.getMySystemPermissions (stub), AdminContainerComponent template.
   * Data: every system permission except the section View permissions (near miss: Manage without View, ViewMsels).
   */
  it('shows no sections without a section View permission', async () => {
    const { fixture, permissionApis } = await renderAdmin({
      permissions: ALL_PERMISSIONS.filter((p) => !SECTION_VIEWS.includes(p)),
    });

    expect(permissionApis.systemPermissions.getMySystemPermissions).toHaveBeenCalledTimes(1);
    for (const label of [
      'Units', 'Data Fields', 'Inject Types', 'Catalogs', 'Organizations', 'Gallery Cards',
      'CITE Actions', 'CITE Duties', 'Competencies', 'Proficiency Scales', 'Users', 'Roles', 'Groups',
    ]) {
      expect(within(nav()).queryByText(label)).not.toBeInTheDocument();
    }
    expect(child(fixture, AdminUnitsStub)).toBeUndefined();
  });

  /**
   * Verifies: each View permission adds exactly its own section to the navigation.
   * Interacts with: real PermissionDataService (grants: one permission), AdminContainerComponent nav.
   * Data: each View* permission on its own, with the section label(s) it unlocks.
   */
  it.each([
    [SystemPermission.ViewUnits, ['Units']],
    [SystemPermission.ViewDataFields, ['Data Fields']],
    [SystemPermission.ViewInjectTypes, ['Inject Types']],
    [SystemPermission.ViewCatalogs, ['Catalogs']],
    [SystemPermission.ViewOrganizations, ['Organizations']],
    [SystemPermission.ViewGalleryCards, ['Gallery Cards']],
    [SystemPermission.ViewCiteActions, ['CITE Actions']],
    [SystemPermission.ViewCiteDuties, ['CITE Duties']],
    [SystemPermission.ViewCompetencyFrameworks, ['Competencies', 'Proficiency Scales']],
    [SystemPermission.ViewUsers, ['Users']],
    [SystemPermission.ViewRoles, ['Roles']],
    [SystemPermission.ViewGroups, ['Groups']],
  ])('%s unlocks only its sections', async (permission, labels) => {
    await renderAdmin({ permissions: [permission] });
    const all = [
      'Units', 'Data Fields', 'Inject Types', 'Catalogs', 'Organizations', 'Gallery Cards',
      'CITE Actions', 'CITE Duties', 'Competencies', 'Proficiency Scales', 'Users', 'Roles', 'Groups',
    ];

    for (const label of all) {
      if (labels.includes(label)) {
        expect(within(nav()).getByText(label)).toBeInTheDocument();
      } else {
        expect(within(nav()).queryByText(label)).not.toBeInTheDocument();
      }
    }
  });

  /**
   * Verifies: choosing a section renders it, saves it as the admin tab, and passes the matching Manage permission down as canEdit.
   * Interacts with: real PermissionDataService (stubbed grants), real UIDataService, child stubs' inputs.
   * Data: ViewOrganizations + ManageOrganizations and ViewCatalogs (no ManageCatalogs).
   */
  it('renders the chosen section with its Manage permission', async () => {
    const { fixture } = await renderAdmin({
      permissions: [
        SystemPermission.ViewUnits,
        SystemPermission.ViewOrganizations,
        SystemPermission.ManageOrganizations,
        SystemPermission.ViewCatalogs,
      ],
    });
    const user = userEvent.setup();

    await user.click(within(nav()).getByText('Organizations'));
    const orgs = child(fixture, OrganizationListStub);
    expect(orgs.canEdit).toBe(true);
    expect(orgs.showTemplates).toBe(true);
    expect(orgs.loggedInUserId).toBe('user-1');
    expect(child(fixture, AdminUnitsStub)).toBeUndefined();
    expect(TestBed.inject(UIDataService).getAdminTab()).toBe('Organizations');

    await user.click(within(nav()).getByText('Catalogs'));
    expect(child(fixture, AdminCatalogListStub).canEdit).toBe(false);
    expect(child(fixture, OrganizationListStub)).toBeUndefined();
  });

  // Each section that passes a Manage permission down to its child, with the
  // nav label, the permissions, and how to read the bound input off the stub.
  const MANAGED_SECTIONS = [
    { label: 'Units', view: SystemPermission.ViewUnits, manage: SystemPermission.ManageUnits, gate: (f: ComponentFixture<unknown>) => child(f, AdminUnitsStub)?.canManage },
    { label: 'Inject Types', view: SystemPermission.ViewInjectTypes, manage: SystemPermission.ManageInjectTypes, gate: (f: ComponentFixture<unknown>) => child(f, AdminInjectTypesStub)?.canEdit },
    { label: 'Competencies', view: SystemPermission.ViewCompetencyFrameworks, manage: SystemPermission.ManageCompetencyFrameworks, gate: (f: ComponentFixture<unknown>) => child(f, AdminCompetencyFrameworksStub)?.canEdit },
    { label: 'Proficiency Scales', view: SystemPermission.ViewCompetencyFrameworks, manage: SystemPermission.ManageCompetencyFrameworks, gate: (f: ComponentFixture<unknown>) => child(f, AdminProficiencyScalesStub)?.canEdit },
    { label: 'Catalogs', view: SystemPermission.ViewCatalogs, manage: SystemPermission.ManageCatalogs, gate: (f: ComponentFixture<unknown>) => child(f, AdminCatalogListStub)?.canEdit },
    { label: 'Organizations', view: SystemPermission.ViewOrganizations, manage: SystemPermission.ManageOrganizations, gate: (f: ComponentFixture<unknown>) => child(f, OrganizationListStub)?.canEdit },
    { label: 'Gallery Cards', view: SystemPermission.ViewGalleryCards, manage: SystemPermission.ManageGalleryCards, gate: (f: ComponentFixture<unknown>) => child(f, CardListStub)?.canEdit },
    { label: 'CITE Actions', view: SystemPermission.ViewCiteActions, manage: SystemPermission.ManageCiteActions, gate: (f: ComponentFixture<unknown>) => child(f, CiteActionListStub)?.canEdit },
    { label: 'CITE Duties', view: SystemPermission.ViewCiteDuties, manage: SystemPermission.ManageCiteDuties, gate: (f: ComponentFixture<unknown>) => child(f, CiteDutyListStub)?.canEdit },
  ];

  /**
   * Verifies: opening a section from the navigation passes its Manage permission to the child as true when granted, and as false when only other Manage permissions are.
   * Interacts with: real PermissionDataService (stubbed grants), the nav item click, the child stub's canEdit / canManage input.
   * Data: the section's View permission plus its own Manage permission (allowed), or plus every other Manage permission (near miss).
   */
  it.each(
    MANAGED_SECTIONS.flatMap((section) => [
      { ...section, granted: true, permissions: [section.view, section.manage] },
      { ...section, granted: false, permissions: [section.view, ...MANAGE_PERMISSIONS.filter((p) => p !== section.manage)] },
    ]),
  )('$label passes its Manage permission down (granted: $granted)', async ({ label, granted, permissions, gate }) => {
    const { fixture } = await renderAdmin({ permissions });
    const user = userEvent.setup();

    await user.click(within(nav()).getByText(label));

    expect(gate(fixture)).toBe(granted);
  });

  /**
   * Verifies: the Units section opens by default and receives canManage from ManageUnits; units are loaded once the user may see any admin section.
   * Interacts with: real PermissionDataService (stubbed grants), UnitService.getUnits (stub), AdminUnitsStub input.
   * Data: ViewUnits + ManageUnits; no saved tab.
   */
  it('opens Units by default and loads units', async () => {
    const { fixture, units } = await renderAdmin({
      permissions: [SystemPermission.ViewUnits, SystemPermission.ManageUnits],
    });

    expect(child(fixture, AdminUnitsStub).canManage).toBe(true);
    expect(units.getUnits).toHaveBeenCalledTimes(1);
  });

  /**
   * Verifies: a user whose only admin permission is ViewGalleryCards never loads the units.
   * Interacts with: real PermissionDataService (grants: ViewGalleryCards), UnitService.getUnits (stub).
   * Data: ViewGalleryCards only.
   */
  it('does not load units for a ViewGalleryCards-only user', async () => {
    const { units } = await renderAdmin({ permissions: [SystemPermission.ViewGalleryCards] });

    expect(units.getUnits).not.toHaveBeenCalled();
  });

  /**
   * Verifies: a user who cannot view Units still lands on the Units tab, so the main area is empty until they pick a section.
   * Interacts with: real PermissionDataService (grants: ViewUsers only), real UIDataService.
   * Data: ViewUsers only; no saved tab.
   */
  it('defaults to the Units tab even without ViewUnits', async () => {
    const { fixture } = await renderAdmin({ permissions: [SystemPermission.ViewUsers] });

    expect(TestBed.inject(UIDataService).getAdminTab()).toBe('Units');
    expect(child(fixture, AdminUsersStub)).toBeUndefined();
    expect(child(fixture, AdminUnitsStub)).toBeUndefined();
  });

  /**
   * Verifies: a saved admin tab is restored on load.
   * Interacts with: real UIDataService (localStorage), real PermissionDataService (stubbed grants).
   * Data: saved tab "Groups"; ViewGroups granted.
   */
  it('restores the saved tab', async () => {
    const { fixture } = await renderAdmin({
      permissions: [SystemPermission.ViewGroups],
      savedTab: 'Groups',
    });

    expect(child(fixture, AdminGroupsStub)).toBeDefined();
  });

  /**
   * Verifies: the container joins the admin SignalR area on init, leaves it on destroy, and shows the API version without its build suffix.
   * Interacts with: SignalRService (stub), HealthCheckService.getVersion (stub).
   * Data: API version "2.4.0+abc123".
   */
  it('joins the admin hub and shows the API version', async () => {
    const { fixture, signalR } = await renderAdmin({ permissions: [SystemPermission.ViewUnits] });
    await fixture.whenStable();

    expect(signalR.startConnection).toHaveBeenCalledWith(ApplicationArea.admin);
    expect(signalR.join).toHaveBeenCalled();
    expect(screen.getByText(/API 2\.4\.0$/)).toBeInTheDocument();

    fixture.destroy();
    expect(signalR.leave).toHaveBeenCalled();
  });

  /**
   * Verifies: clicking the Exit Administration header returns to the returnUrl (the root when none is given).
   * Interacts with: Router.navigateByUrl (spy), mat-toolbar click handler.
   * Data: no returnUrl query param.
   */
  it('exits administration to the return URL', async () => {
    await renderAdmin({ permissions: [SystemPermission.ViewUnits] });
    const navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const user = userEvent.setup();

    await user.click(within(nav()).getByText('Administration'));

    expect(navigateByUrl).toHaveBeenCalledWith('/');
  });
});
