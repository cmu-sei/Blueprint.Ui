// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Component, EventEmitter, Output, input } from '@angular/core';
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
import { MatSelectHarness } from '@angular/material/select/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { Observable, of, throwError } from 'rxjs';
import { AngularEditorModule } from '@kolkov/angular-editor';
import { ClipboardModule } from 'ngx-clipboard';
import { NgxMatDatepickerActions, NgxMatDatepickerApply, NgxMatDatepickerCancel, NgxMatDatepickerInput, NgxMatDatetimepicker } from '@ngxmc/datetime-picker';
import { ComnSettingsService, CrucibleDialogService } from '@cmusei/crucible-common';
import {
  CasterDirectory,
  CasterService,
  CiteService,
  CompetencyFramework,
  CompetencyFrameworkService,
  Msel,
  MselCompetency,
  MselCompetencyService,
  MselItemStatus,
  MselPage,
  MselIntegrationNames,
  MselPageService,
  MselRole,
  MselService,
  PlayerApplication,
  PlayerApplicationService,
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
import { IntegrationStatusComponent } from '../integration-status/integration-status.component';
import { DurationEditComponent } from '../shared/duration-edit/duration-edit.component';

@Component({ selector: 'app-integration-status', template: '' })
class IntegrationStatusStub {
  readonly msel = input<Msel>(undefined);
  @Output() closed = new EventEmitter<void>();
}
@Component({ selector: 'app-duration-edit', template: '' })
class DurationEditStub {
  readonly startTime = input<Date>(undefined);
  readonly canEdit = input<boolean>(undefined);
  readonly durationSeconds = input<number>(undefined);
  @Output() durationSecondsChange = new EventEmitter<number>();
  readonly timeName = input<string>(undefined);
  readonly postScript = input<string>(undefined);
  @Output() change = new EventEmitter<number>();
}

const ME = 'user-me';
const PAGE: MselPage = { id: 'page-1', mselId: 'msel-1', name: 'Read Ahead', content: '<p>Welcome</p>', allCanView: true };
const ALL = Object.values(SystemPermission);
const allBut = (...missing: SystemPermission[]) => ALL.filter((p) => !missing.includes(p));

// Caster directories the user can deploy from, labelled "<project> / <directory>".
const BASE: CasterDirectory = { id: 'dir-1', name: 'Base', projectId: 'proj-1', projectName: 'Range' };
const EXTENDED: CasterDirectory = { id: 'dir-2', name: 'Extended', projectId: 'proj-2', projectName: 'Range' };
const VM_APP_WARNING =
  'No Player application opens the VM UI, so participants will not be able to reach the Caster VMs. Add one using {vmUrl}, for example {vmUrl}/views/{playerViewId}.';

function msel(myRoles: MselRole[] = [], startTime?: Date, extra: Partial<Msel> = {}): Msel {
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
    ...extra,
  };
}

async function renderInfo(
  overrides: {
    permissions?: SystemPermission[];
    myRoles?: MselRole[];
    startTime?: Date;
    mselExtra?: Partial<Msel>;
    directories?: () => Observable<CasterDirectory[]>;
    apps?: PlayerApplication[];
    names?: MselIntegrationNames;
    casterUrl?: string;
  } = {},
) {
  const {
    permissions = [],
    myRoles = [],
    startTime,
    mselExtra = {},
    directories = () => of([BASE, EXTENDED]),
    apps = [],
    names = {},
    casterUrl = 'http://caster.example/',
  } = overrides;
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
  const appApi = {
    getApplicationsByMsel: vi.fn(() => of(structuredClone(apps))),
  } satisfies ApiStub<PlayerApplicationService>;
  const casterApi = {
    getCasterDirectories: vi.fn(() => directories()),
  } satisfies ApiStub<CasterService>;
  const mselApi = {
    getMselIntegrationNames: vi.fn(() => of(structuredClone(names))),
  } satisfies ApiStub<MselService>;
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
    childStubs: [
      { replace: IntegrationStatusComponent, with: IntegrationStatusStub },
      { replace: DurationEditComponent, with: DurationEditStub },
    ],
    providers: [
      { provide: SystemPermissionsService, useValue: permissionApis.systemPermissions },
      PermissionDataService,
      { provide: MselPageService, useValue: pageApi },
      { provide: MselCompetencyService, useValue: competencyApi },
      { provide: CompetencyFrameworkService, useValue: frameworkApi },
      { provide: CiteService, useValue: citeApi },
      { provide: UserService, useValue: userApi },
      { provide: PlayerApplicationService, useValue: appApi },
      { provide: CasterService, useValue: casterApi },
      { provide: MselService, useValue: mselApi },
      {
        provide: ComnSettingsService,
        useValue: { settings: { CasterUrl: casterUrl, VmUrl: 'http://vm.example' } } satisfies Pick<ComnSettingsService, 'settings'>,
      },
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
          store.set([msel(myRoles, startTime, mselExtra)]);
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
  return { ...rendered, pageApi, confirm, appApi, casterApi, mselApi };
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
    expect(durationEdit(fixture).canEdit()).toBe(true);
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
    expect(durationEdit(fixture).canEdit()).toBe(false);
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

  describe('Caster', () => {
    // The directory select is the only mat-select of the integration section while CITE is off.
    const directorySelects = (fixture: ComponentFixture<unknown>) =>
      TestbedHarnessEnvironment.loader(fixture).getAllHarnesses(MatSelectHarness.with({ ancestor: '.integration-div' }));
    const optionTexts = async (select: MatSelectHarness) => {
      await select.open();
      const texts = await Promise.all((await select.getOptions()).map((option) => option.getText()));
      await select.close();
      return texts;
    };
    const casterBox = () => screen.getByLabelText('Caster');
    const pushButton = () => screen.getByTitle('Push Integrations');

    /**
     * Verifies: with EditMsels, or as an MSEL Editor, Approver or owner, Caster can be ticked and a directory chosen from those Caster lists, and choosing one clears the directory warning and marks the MSEL changed.
     * Interacts with: real PermissionDataService (stubbed grants), MselPlus.hasRole, CasterService.getCasterDirectories (stub), MatSelectHarness.
     * Data: EditMsels; or the Editor, Approver or Owner role with no permission. A pending MSEL using Player and Caster with no directory; directories Range / Base and Range / Extended.
     */
    it.each([
      { label: 'with EditMsels', permissions: [SystemPermission.EditMsels], myRoles: [] },
      { label: 'as an MSEL Editor', permissions: [], myRoles: [MselRole.Editor] },
      { label: 'as an MSEL Approver', permissions: [], myRoles: [MselRole.Approver] },
      { label: 'as the MSEL owner', permissions: [], myRoles: [MselRole.Owner] },
    ])('lets the Caster directory be chosen $label', async ({ permissions, myRoles }) => {
      const { fixture, casterApi } = await renderInfo({ permissions, myRoles, mselExtra: { useCaster: true } });

      expect(casterBox()).toBeEnabled();
      expect(casterApi.getCasterDirectories).toHaveBeenCalledTimes(1);
      const [select] = await directorySelects(fixture);
      expect(await optionTexts(select)).toEqual(['', 'Range / Base', 'Range / Extended']);
      expect(screen.getByText('Select the Caster directory to deploy.')).toBeInTheDocument();

      await select.clickOptions({ text: 'Range / Extended' });

      expect(await select.getValueText()).toBe('Range / Extended');
      expect(screen.queryByText('Select the Caster directory to deploy.')).not.toBeInTheDocument();
      expect(screen.getByText('Changes have not been saved!')).toBeInTheDocument();
    });

    /**
     * Verifies: with EditMsels, a MSEL that already has a directory shows the select with that directory chosen, and not the read-only id.
     * Interacts with: real PermissionDataService (stubbed grants), MselInfoComponent.canEditMsel, MatSelectHarness.
     * Data: EditMsels with no role; a pending MSEL using Player and Caster with directory dir-1 (Range / Base).
     */
    it('offers the chosen Caster directory in the select with EditMsels', async () => {
      const { fixture } = await renderInfo({
        permissions: [SystemPermission.EditMsels],
        mselExtra: { usePlayer: true, useCaster: true, casterDirectoryId: 'dir-1' },
      });

      const [select] = await directorySelects(fixture);
      expect(await select.getValueText()).toBe('Range / Base');
      expect(screen.queryByTitle('dir-1')).not.toBeInTheDocument();
    });

    /**
     * Verifies: without EditMsels or an editing role the Caster box is disabled and the chosen directory is shown read-only, by id and label, with no select.
     * Interacts with: real PermissionDataService (stubbed grants), MselInfoComponent.canEditMsel, selectedCasterDirectory.
     * Data: every permission but EditMsels (near miss: ManageMsels); MSEL roles Viewer, Evaluator and MoveEditor. A pending MSEL using Caster with directory dir-1 (Range / Base).
     */
    it('shows the Caster directory read-only without EditMsels or an editing role', async () => {
      const { fixture } = await renderInfo({
        permissions: allBut(SystemPermission.EditMsels),
        myRoles: [MselRole.Viewer, MselRole.Evaluator, MselRole.MoveEditor],
        mselExtra: { useCaster: true, casterDirectoryId: 'dir-1' },
      });

      expect(casterBox()).toBeDisabled();
      expect(await directorySelects(fixture)).toEqual([]);
      expect(screen.getByTitle('dir-1')).toHaveTextContent('dir-1');
      expect(screen.getByText('Range / Base')).toBeInTheDocument();
    });

    /**
     * Verifies: a deployed MSEL shows its Caster directory and workspace read-only, with the workspace name and a link to the directory's Caster project (a slash added to CasterUrl when missing), even with EditMsels.
     * Interacts with: MselService.getMselIntegrationNames (stub), getCasterProjectUrl, ComnSettingsService (stub, CasterUrl).
     * Data: EditMsels; a deployed MSEL using Player and Caster with directory dir-1 (project proj-1) and workspace ws-1 named blueprint-msel-1; CasterUrl with and without a trailing slash.
     */
    it.each(['http://caster.example/', 'http://caster.example'])('shows the deployed Caster workspace with CasterUrl %s', async (casterUrl) => {
      const { fixture, mselApi } = await renderInfo({
        permissions: [SystemPermission.EditMsels],
        mselExtra: { status: MselItemStatus.Deployed, usePlayer: true, useCaster: true, casterDirectoryId: 'dir-1', casterWorkspaceId: 'ws-1' },
        names: { casterDirectoryName: 'Range / Base', casterWorkspaceName: 'blueprint-msel-1' },
        casterUrl,
      });

      expect(mselApi.getMselIntegrationNames).toHaveBeenCalledWith('msel-1');
      expect(casterBox()).toBeDisabled();
      expect(await directorySelects(fixture)).toEqual([]);
      expect(screen.getByTitle('dir-1')).toHaveTextContent('dir-1');
      expect(screen.getByTitle('ws-1')).toHaveTextContent('ws-1');
      expect(screen.getByText('blueprint-msel-1')).toBeInTheDocument();
      expect(screen.getByTitle('Open in Caster')).toHaveAttribute('href', 'http://caster.example/projects/proj-1');
    });

    /**
     * Verifies: when Caster does not list the deployed directory to this user, its name comes from Blueprint and there is no link to Caster.
     * Interacts with: MselService.getMselIntegrationNames (stub), CasterService.getCasterDirectories (stub, empty), getCasterProjectUrl.
     * Data: EditMsels; a deployed MSEL using Caster with directory dir-1 and workspace ws-1; Caster lists no directory; Blueprint names the directory Range / Base.
     */
    it('names a directory Caster does not list from Blueprint, without a Caster link', async () => {
      await renderInfo({
        permissions: [SystemPermission.EditMsels],
        mselExtra: { status: MselItemStatus.Deployed, usePlayer: true, useCaster: true, casterDirectoryId: 'dir-1', casterWorkspaceId: 'ws-1' },
        directories: () => of<CasterDirectory[]>([]),
        names: { casterDirectoryName: 'Range / Base', casterWorkspaceName: 'blueprint-msel-1' },
      });

      expect(screen.getByTitle('dir-1')).toHaveTextContent('dir-1');
      expect(screen.getByText('Range / Base')).toBeInTheDocument();
      expect(screen.getByText('blueprint-msel-1')).toBeInTheDocument();
      expect(screen.queryByTitle('Open in Caster')).not.toBeInTheDocument();
    });

    /**
     * Verifies: the Caster directories are loaded only once Caster is ticked, and only once however often it is ticked again.
     * Interacts with: the Caster checkbox change handler, loadCasterDirectories, CasterService.getCasterDirectories (stub).
     * Data: EditMsels; a pending MSEL that does not use Caster.
     */
    it('loads the Caster directories once, when Caster is ticked', async () => {
      const { fixture, casterApi } = await renderInfo({ permissions: [SystemPermission.EditMsels] });
      const user = userEvent.setup();

      expect(casterApi.getCasterDirectories).not.toHaveBeenCalled();
      await user.click(casterBox());
      expect(casterApi.getCasterDirectories).toHaveBeenCalledTimes(1);
      expect(await directorySelects(fixture)).toHaveLength(1);

      await user.click(casterBox());
      await user.click(casterBox());

      expect(casterApi.getCasterDirectories).toHaveBeenCalledTimes(1);
    });

    /**
     * Verifies: a failed directory load is logged and explained, and ticking Caster again retries it.
     * Interacts with: CasterService.getCasterDirectories (fails once, then answers), console.error (spied), loadCasterDirectories.
     * Data: EditMsels; a pending MSEL that does not use Caster; the first load fails with a 403.
     */
    it('explains a failed directory load and retries when Caster is ticked again', async () => {
      const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
      const failure = { status: 403 };
      const answers = [throwError(() => failure), of([BASE])];
      const { fixture, casterApi } = await renderInfo({ permissions: [SystemPermission.EditMsels], directories: () => answers.shift() });
      const user = userEvent.setup();
      const error = 'Caster directories could not be loaded. You need access to Caster to choose one.';

      await user.click(casterBox());

      expect(screen.getByText(error)).toBeInTheDocument();
      expect(await directorySelects(fixture)).toEqual([]);
      expect(logged.mock.calls).toEqual([['Failed to load Caster directories:', failure]]);

      await user.click(casterBox());
      expect(screen.queryByText(error)).not.toBeInTheDocument();
      await user.click(casterBox());

      expect(casterApi.getCasterDirectories).toHaveBeenCalledTimes(2);
      expect(screen.queryByText(error)).not.toBeInTheDocument();
      const [select] = await directorySelects(fixture);
      expect(await optionTexts(select)).toEqual(['', 'Range / Base']);
    });

    /**
     * Verifies: a MSEL using Caster offers Push Integrations, which stays disabled while Caster lacks Player or a directory, with a warning saying which.
     * Interacts with: casterWarningMessage, the Push Integrations button.
     * Data: ManageMsels; a pending MSEL using only Caster, with directory dir-1; then one using Player and Caster with no directory.
     */
    it.each([
      { label: 'Player', mselExtra: { usePlayer: false, useCaster: true, casterDirectoryId: 'dir-1' }, warning: 'Caster requires Player: the VMs are added to the Player view and its teams.' },
      { label: 'a directory', mselExtra: { usePlayer: true, useCaster: true }, warning: 'Select the Caster directory to deploy.' },
    ])('blocks Push Integrations until Caster has $label', async ({ mselExtra, warning }) => {
      await renderInfo({ permissions: [SystemPermission.ManageMsels], mselExtra });

      expect(screen.getByText(warning)).toBeInTheDocument();
      expect(pushButton()).toBeDisabled();
    });

    /**
     * Verifies: with Player and a directory, Push Integrations is enabled and only an informational warning says no Player application opens the VM UI.
     * Interacts with: casterWarningMessage, casterVmAppWarning, PlayerApplicationService.getApplicationsByMsel (stub), real PlayerApplicationQuery.
     * Data: ManageMsels; a pending MSEL using Player and Caster with directory dir-1; its only application is Mail.
     */
    it('enables Push Integrations for a Caster set up with Player and a directory', async () => {
      const { appApi } = await renderInfo({
        permissions: [SystemPermission.ManageMsels],
        mselExtra: { usePlayer: true, useCaster: true, casterDirectoryId: 'dir-1' },
        apps: [{ id: 'app-1', mselId: 'msel-1', name: 'Mail', url: 'https://mail.example.com' }],
      });

      expect(appApi.getApplicationsByMsel).toHaveBeenCalledWith('msel-1');
      expect(pushButton()).toBeEnabled();
      expect(screen.queryByText(/Caster requires Player|Select the Caster directory/)).not.toBeInTheDocument();
      expect(screen.getByText(VM_APP_WARNING)).toBeInTheDocument();
    });

    /**
     * Verifies: there is no VM UI warning once an application of the MSEL opens the VM UI, or once the MSEL is deployed.
     * Interacts with: casterVmAppWarning, the template's Deployed check.
     * Data: ManageMsels; a MSEL using Player and Caster with directory dir-1, pending with a {vmUrl} application, or deployed with only Mail.
     */
    it.each([
      { label: 'an application opens the VM UI', status: MselItemStatus.Pending, url: '{vmUrl}/views/{playerViewId}' },
      { label: 'the MSEL is deployed', status: MselItemStatus.Deployed, url: 'https://mail.example.com' },
    ])('gives no VM UI warning when $label', async ({ status, url }) => {
      await renderInfo({
        permissions: [SystemPermission.ManageMsels],
        mselExtra: { status, usePlayer: true, useCaster: true, casterDirectoryId: 'dir-1' },
        apps: [{ id: 'app-1', mselId: 'msel-1', name: 'App', url }],
      });

      expect(casterBox()).toBeInTheDocument();
      expect(screen.queryByText(VM_APP_WARNING)).not.toBeInTheDocument();
    });

    /**
     * Verifies: a MSEL deployed only to Caster offers Remove Integrations instead of Push, enabled with ManageMsels or as the owner.
     * Interacts with: real PermissionDataService (stubbed grants), MselInfoComponent.canManageMsel.
     * Data: ManageMsels with no role; or the Owner role. A deployed MSEL using only Caster, with directory dir-1 and workspace ws-1.
     */
    it.each([
      { label: 'with ManageMsels', permissions: [SystemPermission.ManageMsels], myRoles: [] },
      { label: 'as the MSEL owner', permissions: [], myRoles: [MselRole.Owner] },
    ])('lets a Caster deployment be removed $label', async ({ permissions, myRoles }) => {
      await renderInfo({
        permissions,
        myRoles,
        mselExtra: { status: MselItemStatus.Deployed, useCaster: true, casterDirectoryId: 'dir-1', casterWorkspaceId: 'ws-1' },
      });

      expect(screen.getByTitle('Remove Integrations')).toBeEnabled();
      expect(screen.queryByTitle('Push Integrations')).not.toBeInTheDocument();
    });

    /**
     * Verifies: without ManageMsels and not the owner, Remove Integrations of a Caster deployment is disabled, even with EditMsels as an Editor.
     * Interacts with: real PermissionDataService (stubbed grants), MselInfoComponent.canManageMsel.
     * Data: every permission but ManageMsels (near miss: EditMsels); MSEL roles Editor and Approver. A deployed MSEL using only Caster, with workspace ws-1.
     */
    it('disables removing a Caster deployment without ManageMsels or ownership', async () => {
      await renderInfo({
        permissions: allBut(SystemPermission.ManageMsels),
        myRoles: [MselRole.Editor, MselRole.Approver],
        mselExtra: { status: MselItemStatus.Deployed, useCaster: true, casterDirectoryId: 'dir-1', casterWorkspaceId: 'ws-1' },
      });

      expect(screen.getByTitle('Remove Integrations')).toBeDisabled();
    });
  });
});
