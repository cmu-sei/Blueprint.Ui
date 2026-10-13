// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { AngularEditorModule } from '@kolkov/angular-editor';
import { ClipboardModule } from 'ngx-clipboard';
import { NgxMatDatepickerActions, NgxMatDatepickerApply, NgxMatDatepickerCancel, NgxMatDatepickerInput, NgxMatDatetimepicker } from '@ngxmc/datetime-picker';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import {
  CiteService,
  CompetencyFramework,
  CompetencyFrameworkService,
  Msel,
  MselCompetency,
  MselCompetencyService,
  MselItemStatus,
  MselPage,
  MselPageService,
  MselRole,
  ScoringModel,
  SystemPermission,
  SystemPermissionsService,
  User,
  UserService,
} from 'src/app/generated/blueprint.api';
import { MselStore } from 'src/app/data/msel/msel.store';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { MselInfoComponent } from './msel-info.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { TimezoneAbbrPipe } from 'src/app/utilities/timezone-abbr';
import { renderComponent } from 'src/app/test-utils/render-component';
import { permissionApiStubs } from 'src/app/test-utils/mock-permission-data.service';
import { unstubbed } from 'src/app/test-utils/unstubbed';

@Component({ selector: 'app-integration-status', template: '', standalone: false })
class IntegrationStatusStub {
  @Input() msel: Msel;
  @Output() closed = new EventEmitter<void>();
}
@Component({ selector: 'app-duration-edit', template: '', standalone: false })
class DurationEditStub {
  @Input() startTime: Date;
  @Input() canEdit: boolean;
  @Input() durationSeconds: number;
  @Output() durationSecondsChange = new EventEmitter<number>();
  @Input() timeName: string;
  @Input() postScript: string;
  @Output() change = new EventEmitter<number>();
}

const ME = 'user-me';
const PAGE: MselPage = { id: 'page-1', mselId: 'msel-1', name: 'Read Ahead', content: '<p>Welcome</p>', allCanView: true };
const ALL = Object.values(SystemPermission);
const allBut = (...missing: SystemPermission[]) => ALL.filter((p) => !missing.includes(p));

function msel(myRoles: MselRole[] = [], startTime?: Date): Msel {
  return {
    ...(startTime ? { startTime } : {}),
    id: 'msel-1',
    name: 'Exercise Alpha',
    description: 'Alpha',
    status: MselItemStatus.Pending,
    isTemplate: false,
    usePlayer: true,
    createdBy: 'user-creator',
    durationSeconds: 3600,
    teams: [],
    units: [],
    userMselRoles: myRoles.map((role, i) => ({ id: `umr-${i}`, userId: ME, mselId: 'msel-1', role })),
  };
}

async function renderInfo(overrides: { permissions?: SystemPermission[]; myRoles?: MselRole[]; startTime?: Date } = {}) {
  const { permissions = [], myRoles = [], startTime } = overrides;
  const pageApi = {
    getMselPages: vi.fn(() => of(structuredClone([PAGE]))),
    deleteMselPage: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<MselPageService>;
  const competencyApi = {
    getMselCompetencies: vi.fn(() => of<MselCompetency[]>([])),
  } satisfies ApiStub<MselCompetencyService>;
  const frameworkApi = {
    getCompetencyFrameworks: vi.fn(() => of<CompetencyFramework[]>([])),
  } satisfies ApiStub<CompetencyFrameworkService>;
  const citeApi = {
    getScoringModels: vi.fn(() => of<ScoringModel[]>([])),
  } satisfies ApiStub<CiteService>;
  const userApi = {
    getUser: vi.fn(() => of<User>({ id: 'user-creator', name: 'Casey Creator' })),
  } satisfies ApiStub<UserService>;
  // The user confirms every dialog.
  const confirm = vi.fn(() => dialogRefStub<unknown, boolean>(true).dialogRef);
  const dialog = { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>;
  // MselInfoComponent loads the permissions itself in ngOnInit, so the real
  // service is provided over the stubbed endpoint, without priming it.
  const permissionApis = permissionApiStubs({ system: permissions });
  const rendered = await renderComponent(MselInfoComponent, {
    imports: [
      AngularEditorModule,
      ClipboardModule,
      MatButtonModule,
      MatCheckboxModule,
      MatDatepickerModule,
      MatExpansionModule,
      MatFormFieldModule,
      MatIconModule,
      MatInputModule,
      MatMenuModule,
      MatNativeDateModule,
      MatSelectModule,
      MatTabsModule,
      MatTooltipModule,
      NgxMatDatepickerActions,
      NgxMatDatepickerApply,
      NgxMatDatepickerCancel,
      NgxMatDatepickerInput,
      NgxMatDatetimepicker,
    ],
    declarations: [MselInfoComponent, IntegrationStatusStub, DurationEditStub, TimezoneAbbrPipe],
    providers: [
      { provide: SystemPermissionsService, useValue: permissionApis.systemPermissions },
      PermissionDataService,
      { provide: MselPageService, useValue: pageApi },
      { provide: MselCompetencyService, useValue: competencyApi },
      { provide: CompetencyFrameworkService, useValue: frameworkApi },
      { provide: CiteService, useValue: citeApi },
      { provide: UserService, useValue: userApi },
      { provide: CrucibleDialogService, useValue: dialog },
      unstubbed(MatDialog),
      // angular-editor injects HttpClient for its image upload.
      provideHttpClient(),
      provideHttpClientTesting(),
      // The MSEL page loads the MSEL; the store is seeded instead.
      {
        provide: MselStore,
        useFactory: () => {
          const store = new MselStore();
          store.set([msel(myRoles, startTime)]);
          store.setActive('msel-1');
          return store;
        },
      },
    ],
    inputs: { loggedInUserId: ME },
  });
  // ngModel applies [disabled] in a microtask.
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();
  return { ...rendered, pageApi, confirm };
}

// The settings page is large, so queries go by label, title or text: whole-page
// role queries are slow enough to time out under coverage.
const nameInput = () => screen.getByLabelText('Name');
const descriptionInput = () => screen.getByLabelText('Description');
function durationEdit(fixture: ComponentFixture<unknown>): DurationEditStub {
  return fixture.debugElement.query(By.directive(DurationEditStub)).componentInstance;
}
async function openPage() {
  const user = userEvent.setup();
  await user.click(screen.getByText('Read Ahead'));
  return user;
}

describe('MselInfoComponent', () => {
  // A test that sets TZ runs in a zone with daylight saving time; this restores the host's.
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    sessionStorage.clear();
  });

  /**
   * Verifies: with EditMsels, or as an MSEL Editor, the MSEL's settings are editable and the duration editor is told so.
   * Interacts with: real PermissionDataService over SystemPermissionsService (stub), MselPlus.hasRole, DurationEditStub input.
   * Data: EditMsels with no role; or the Editor role with no permission.
   */
  it.each([
    { label: 'with EditMsels', permissions: [SystemPermission.EditMsels], myRoles: [] },
    { label: 'as an MSEL Editor', permissions: [], myRoles: [MselRole.Editor] },
  ])('edits the MSEL settings $label', async ({ permissions, myRoles }) => {
    const { fixture } = await renderInfo({ permissions, myRoles });

    expect(nameInput()).toBeEnabled();
    expect(descriptionInput()).toBeEnabled();
    expect(screen.getByLabelText('Player')).toBeEnabled();
    expect(durationEdit(fixture).canEdit).toBe(true);
  });

  /**
   * Verifies: without EditMsels and the Editor role the settings are read-only, even with ManageMsels.
   * Interacts with: real PermissionDataService (stubbed grants), MselInfoComponent.canEditMsel, DurationEditStub input.
   * Data: every permission but EditMsels (near miss: ManageMsels); MSEL roles Viewer and Evaluator.
   */
  it('makes the MSEL settings read-only without EditMsels or the Editor role', async () => {
    const { fixture } = await renderInfo({ permissions: allBut(SystemPermission.EditMsels), myRoles: [MselRole.Viewer, MselRole.Evaluator] });

    expect(nameInput()).toBeDisabled();
    expect(descriptionInput()).toBeDisabled();
    expect(screen.getByLabelText('Player')).toBeDisabled();
    expect(durationEdit(fixture).canEdit).toBe(false);
  });

  /**
   * Verifies: with ManageMsels, or as the owner, the MSEL can be deleted and pushed, its header metadata set, its pages edited and new pages added.
   * Interacts with: MselInfoComponent.canManageMsel, mat-tab-group.
   * Data: ManageMsels with no role; or the Owner role. A pending MSEL using Player with one page.
   */
  it.each([
    { label: 'with ManageMsels', permissions: [SystemPermission.ManageMsels], myRoles: [] },
    { label: 'as the MSEL owner', permissions: [], myRoles: [MselRole.Owner] },
  ])('offers the managing actions $label', async ({ permissions, myRoles }) => {
    await renderInfo({ permissions, myRoles });

    expect(screen.getByTitle('Delete this MSEL').querySelector('button')).toBeEnabled();
    expect(screen.getByTitle('Push Integrations')).toBeEnabled();
    expect(screen.getByLabelText('Header Row Metadata (Height)')).toBeInTheDocument();
    expect(screen.getByText(/Add Page/)).toBeInTheDocument();
    await openPage();
    expect(screen.getByTitle('Edit Page')).toBeInTheDocument();
  });

  /**
   * Verifies: without ManageMsels and not the owner there is no Delete, Add Page, Edit Page or header metadata, and Push Integrations is disabled, even with EditMsels as an Editor.
   * Interacts with: real PermissionDataService (stubbed grants), MselInfoComponent.canManageMsel.
   * Data: every permission but ManageMsels (near miss: EditMsels); MSEL roles Editor and Approver.
   */
  it('hides the managing actions without ManageMsels or ownership', async () => {
    await renderInfo({ permissions: allBut(SystemPermission.ManageMsels), myRoles: [MselRole.Editor, MselRole.Approver] });

    expect(screen.queryByTitle('Delete this MSEL')).not.toBeInTheDocument();
    expect(screen.queryByTitle('You do not have permission to delete this MSEL')).not.toBeInTheDocument();
    expect(screen.getByTitle('Push Integrations')).toBeDisabled();
    expect(screen.queryByLabelText('Header Row Metadata (Height)')).not.toBeInTheDocument();
    expect(screen.queryByText(/Add Page/)).not.toBeInTheDocument();
    await openPage();
    expect(screen.queryByTitle('Edit Page')).not.toBeInTheDocument();
  });

  /**
   * Verifies: a page's Delete button is offered and works without any MSEL permission or role (current behavior).
   * Interacts with: CrucibleDialogService.confirm (stub, confirms), MselPageService.deleteMselPage (stub).
   * Data: no system permission; MSEL role Viewer; page Read Ahead.
   */
  it('lets a viewer delete a page', async () => {
    const { pageApi, confirm } = await renderInfo({ permissions: [], myRoles: [MselRole.Viewer] });

    const user = await openPage();
    await user.click(screen.getByTitle('Delete Read Ahead'));

    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delete Page' }));
    // Current behavior; see agent-docs/ui-test-bugs/blueprint.ui.md.
    expect(pageApi.deleteMselPage).toHaveBeenCalledWith('page-1');
  });

  /**
   * Verifies: the creator's name is looked up when the creator is not among the loaded users.
   * Interacts with: UserService.getUser (stub), real UserDataService.
   * Data: createdBy user-creator, not in the user store.
   */
  it('shows the creator name', async () => {
    await renderInfo({ permissions: [SystemPermission.EditMsels] });

    expect(screen.getByLabelText('Created By')).toHaveValue('Casey Creator');
  });

  /**
   * Verifies: the MSEL start time is labelled with the zone in effect on that date.
   * Interacts with: MselInfoComponent.hasStartTime, DatePipe, TimezoneAbbrPipe.
   * Data: TZ America/New_York; start time 20 Oct 2026 16:00 UTC (EDT) or 20 Nov 2026 17:00 UTC (EST, after DST ends); EditMsels.
   */
  it.each([
    { date: '2026-10-20T16:00:00Z', label: '20 Oct 2026 12:00 EDT' },
    { date: '2026-11-20T17:00:00Z', label: '20 Nov 2026 12:00 EST' },
  ])('labels the start time with the zone in effect on that date ($label)', async ({ date, label }) => {
    vi.stubEnv('TZ', 'America/New_York');

    await renderInfo({ permissions: [SystemPermission.EditMsels], startTime: new Date(date) });

    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
