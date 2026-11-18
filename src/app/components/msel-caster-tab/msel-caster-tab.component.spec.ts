// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ComponentFixture } from '@angular/core/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { NEVER, Observable, of, throwError } from 'rxjs';
import {
  ComnSettingsService,
  CrucibleDialogService,
} from '@cmusei/crucible-common';
import {
  CasterDirectory,
  CasterService,
  Msel,
  MselCasterExport,
  MselCasterExportService,
  MselCasterImportResult,
  MselItemStatus,
  MselRole,
  MselService,
  SystemPermission,
  SystemPermissionsService,
} from 'src/app/generated/blueprint.api';
import { MselStore } from 'src/app/data/msel/msel.store';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { permissionApiStubs } from 'src/app/test-utils/mock-permission-data.service';
import { renderComponent } from 'src/app/test-utils/render-component';
import { MselCasterTabComponent } from './msel-caster-tab.component';

const ME = 'user-me';
const BASE: CasterDirectory = {
  id: 'dir-1',
  name: 'Base',
  projectId: 'proj-1',
  projectName: 'Range',
};
const EXTENDED: CasterDirectory = {
  id: 'dir-2',
  name: 'Extended',
  projectId: 'proj-1',
  projectName: 'Range',
};
// a copy of Topology's directory Range, below its root directory Root
const COPY: MselCasterExport = {
  mselId: 'msel-1',
  projectName: 'Topology',
  sourceDirectoryId: 'src-dir',
  dateExported: new Date('2026-11-01T12:00:00Z'),
  exportedByName: 'Pat Planner',
  directories: [
    {
      level: 0,
      name: 'Root',
      files: [{ name: 'providers.tf', content: 'terraform {}' }],
    },
    { level: 1, name: 'Range', files: [] },
  ],
  entries: [
    { path: 'main.tf', workspace: null, content: 'variable "blue" {}' },
    {
      path: '__Workspaces__/topology/topology.auto.tfvars',
      workspace: 'topology',
      content: 'blue = "x"',
    },
  ],
  warnings: [],
  contentsIncluded: true,
};

function msel(myRoles: MselRole[] = [], extra: Partial<Msel> = {}): Msel {
  return {
    id: 'msel-1',
    name: 'Exercise Alpha',
    status: MselItemStatus.Pending,
    usePlayer: true,
    useCaster: true,
    createdBy: 'user-creator',
    teams: [],
    units: [],
    userMselRoles: myRoles.map((role, i) => ({
      id: `umr-${i}`,
      userId: ME,
      mselId: 'msel-1',
      role,
    })),
    ...extra,
  };
}

async function renderTab(
  overrides: {
    permissions?: SystemPermission[];
    myRoles?: MselRole[];
    mselExtra?: Partial<Msel>;
    copy?: MselCasterExport | null;
    copyAnswer?: () => Observable<MselCasterExport | null>;
    directories?: CasterDirectory[];
  } = {},
) {
  const {
    permissions = [],
    myRoles = [MselRole.Owner],
    mselExtra = {},
    copy = null,
    copyAnswer = () => of(structuredClone(copy)),
    directories = [BASE, EXTENDED],
  } = overrides;
  const casterApi = {
    getCasterDirectories: vi.fn(() => of(structuredClone(directories))),
  } satisfies ApiStub<CasterService>;
  const copyApi = {
    getMselCasterExport: vi.fn(() => copyAnswer()),
    captureMselCasterExport: vi.fn(() =>
      of<MselCasterExport>({
        ...structuredClone(COPY),
        projectName: 'Range Project',
      }),
    ),
    deleteMselCasterExport: vi.fn(() => of<unknown>(null)),
    // the API links the MSEL to the directory the import made
    importMselCasterExport: vi.fn(() =>
      of<MselCasterImportResult>({
        casterDirectoryId: 'dir-new',
        lockedFiles: [],
        msel: { ...msel(myRoles, mselExtra), casterDirectoryId: 'dir-new' },
      }),
    ),
  } satisfies ApiStub<MselCasterExportService>;
  const mselApi = {
    updateMsel: vi.fn((_id: string, body: Msel) => of(structuredClone(body))),
  } satisfies ApiStub<MselService>;
  // The user confirms every dialog.
  const confirm = vi.fn(() => dialogRefStub<unknown, boolean>(true).dialogRef);
  const permissionApis = permissionApiStubs({ system: permissions });
  const rendered = await renderComponent(MselCasterTabComponent, {
    providers: [
      {
        provide: SystemPermissionsService,
        useValue: permissionApis.systemPermissions,
      },
      PermissionDataService,
      { provide: CasterService, useValue: casterApi },
      { provide: MselCasterExportService, useValue: copyApi },
      { provide: MselService, useValue: mselApi },
      {
        provide: CrucibleDialogService,
        useValue: { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>,
      },
      {
        provide: ComnSettingsService,
        useValue: {
          settings: { CasterUrl: 'http://caster.example' },
        } satisfies Pick<ComnSettingsService, 'settings'>,
      },
      {
        provide: MselStore,
        useFactory: () => {
          const store = new MselStore();
          store.set([msel(myRoles, mselExtra)]);
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
  return { ...rendered, casterApi, copyApi, mselApi, confirm };
}

const directorySelects = (fixture: ComponentFixture<unknown>) =>
  TestbedHarnessEnvironment.loader(fixture).getAllHarnesses(
    MatSelectHarness.with({ ancestor: '.link-select' }),
  );
const button = (name: string) => screen.getByRole('button', { name });
const storedDirectoryId = () =>
  TestBed.inject(MselStore).getValue().entities['msel-1'].casterDirectoryId;

describe('MselCasterTabComponent', () => {
  /**
   * Verifies: the owner chooses the directory from those Caster lists, held until Save Changes, which saves it as one of the MSEL's settings.
   * Interacts with: CasterService.getCasterDirectories (stub), the Caster Directory select (MatSelectHarness), Save Changes, MselService.updateMsel (stub), MselStore.
   * Data: MSEL role Owner; a pending MSEL using Player and Caster with no directory; Range / Base and Range / Extended.
   */
  it('saves the chosen Caster directory', async () => {
    const { fixture, mselApi } = await renderTab();
    const [select] = await directorySelects(fixture);

    await select.open();
    expect(
      await Promise.all((await select.getOptions()).map((o) => o.getText())),
    ).toEqual(['-- None --', 'Range / Base', 'Range / Extended']);
    await select.clickOptions({ text: 'Range / Extended' });
    fixture.detectChanges();
    expect(
      screen.getByText('Changes have not been saved!'),
    ).toBeInTheDocument();
    expect(fixture.componentInstance.hasPendingChanges()).toBe(true);
    await userEvent.setup().click(button('Save Changes'));
    fixture.detectChanges();

    expect(mselApi.updateMsel).toHaveBeenCalledExactlyOnceWith(
      'msel-1',
      expect.objectContaining({ casterDirectoryId: 'dir-2' }),
    );
    expect(storedDirectoryId()).toBe('dir-2');
    expect(fixture.componentInstance.hasPendingChanges()).toBe(false);
  });

  /**
   * Verifies: linking another directory while a copy is stored asks first, since the API deletes the copy of the old one, and the tab drops it once saved.
   * Interacts with: the Caster Directory select, Save Changes, CrucibleDialogService.confirm (stub, confirms), MselService.updateMsel (stub).
   * Data: MSEL role Owner; a pending MSEL linked to dir-1 with a copy; Range / Extended chosen.
   */
  it('asks before linking another directory replaces the copy', async () => {
    const { fixture, mselApi, confirm } = await renderTab({
      copy: COPY,
      mselExtra: { casterDirectoryId: 'dir-1' },
    });
    const [select] = await directorySelects(fixture);

    await select.clickOptions({ text: 'Range / Extended' });
    fixture.detectChanges();
    await userEvent.setup().click(button('Save Changes'));
    fixture.detectChanges();

    expect(confirm).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        title: 'Link Another Directory',
        confirmText: 'Link',
      }),
    );
    expect(mselApi.updateMsel).toHaveBeenCalledExactlyOnceWith(
      'msel-1',
      expect.objectContaining({ casterDirectoryId: 'dir-2' }),
    );
    expect(screen.getByText('No copy is stored.')).toBeInTheDocument();
  });

  /**
   * Verifies: a copy that could not be loaded is reported, not shown as absent, and linking another directory still asks first, since the API deletes any stored copy.
   * Interacts with: copyError, Save Changes, CrucibleDialogService.confirm (stub, confirms), MselService.updateMsel (stub).
   * Data: MSEL role Owner; a pending MSEL linked to dir-1 whose copy fails to load with a 502; Range / Extended chosen.
   */
  it('reports a copy it could not load and still asks before linking another directory', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { fixture, confirm, mselApi } = await renderTab({
      mselExtra: { casterDirectoryId: 'dir-1' },
      copyAnswer: () => throwError(() => ({ status: 502 })),
    });

    expect(
      screen.getByText('The stored copy could not be loaded.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('No copy is stored.')).not.toBeInTheDocument();

    const [select] = await directorySelects(fixture);
    await select.clickOptions({ text: 'Range / Extended' });
    fixture.detectChanges();
    await userEvent.setup().click(button('Save Changes'));

    expect(confirm).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ title: 'Link Another Directory' }),
    );
    expect(mselApi.updateMsel).toHaveBeenCalledTimes(1);
  });

  /**
   * Verifies: until the copy has loaded, a chosen directory cannot be saved, so the deletion question is never skipped.
   * Interacts with: copyLoaded, Save Changes.
   * Data: MSEL role Owner; a pending MSEL whose copy request never answers; Range / Extended chosen.
   */
  it('holds Save Changes until the copy has loaded', async () => {
    const { fixture } = await renderTab({ copyAnswer: () => NEVER });

    const [select] = await directorySelects(fixture);
    await select.clickOptions({ text: 'Range / Extended' });
    fixture.detectChanges();

    expect(button('Save Changes')).toBeDisabled();
  });

  /**
   * Verifies: a linked directory Caster no longer lists can still be cleared, so the copy can then be imported.
   * Interacts with: unlistedDirectoryId, the Caster Directory select, Save Changes, MselService.updateMsel (stub).
   * Data: MSEL role Owner; a pending MSEL linked to dir-gone with no copy; Caster lists no directories.
   */
  it('lets a directory Caster no longer lists be cleared', async () => {
    const { fixture, mselApi } = await renderTab({
      mselExtra: { casterDirectoryId: 'dir-gone' },
      directories: [],
    });
    const [select] = await directorySelects(fixture);

    expect(await select.getValueText()).toBe('dir-gone (not listed by Caster)');
    await select.clickOptions({ text: '-- None --' });
    fixture.detectChanges();
    await userEvent.setup().click(button('Save Changes'));

    expect(mselApi.updateMsel).toHaveBeenCalledExactlyOnceWith(
      'msel-1',
      expect.objectContaining({ casterDirectoryId: null }),
    );
  });

  /**
   * Verifies: a template with only a copy says it must be imported before it can be launched, since a launch never imports a copy.
   * Interacts with: pushPlan.
   * Data: MSEL role Owner; a template with no directory and a copy.
   */
  it('tells a template with only a copy to import it before launch', async () => {
    await renderTab({ copy: COPY, mselExtra: { isTemplate: true } });

    expect(
      screen.getByText(
        /Import the copy into Caster before this template can be launched/,
      ),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: Cancel Changes puts the saved directory back, and nothing is saved.
   * Interacts with: the Caster Directory select, Cancel Changes, MselService.updateMsel (stub).
   * Data: MSEL role Owner; a pending MSEL linked to dir-1; Range / Extended chosen.
   */
  it('cancels a chosen directory', async () => {
    const { fixture, mselApi } = await renderTab({
      mselExtra: { casterDirectoryId: 'dir-1' },
    });
    const [select] = await directorySelects(fixture);

    await select.clickOptions({ text: 'Range / Extended' });
    fixture.detectChanges();
    await userEvent.setup().click(button('Cancel Changes'));
    fixture.detectChanges();

    expect(await select.getValueText()).toBe('Range / Base');
    expect(mselApi.updateMsel).not.toHaveBeenCalled();
  });

  /**
   * Verifies: an Editor may not change the directory, a MSEL setting only its owner or EditMsels saves, but may manage the copy, as the API allows.
   * Interacts with: canUpdateMsel, canEditCasterCopy, real PermissionDataService (stubbed grants).
   * Data: MSEL role Editor, no permission; a pending MSEL linked to dir-1 (Range / Base) with no copy.
   */
  it('shows the directory read-only to an Editor, who may still copy it', async () => {
    const { fixture } = await renderTab({
      myRoles: [MselRole.Editor],
      mselExtra: { casterDirectoryId: 'dir-1' },
    });

    expect(await directorySelects(fixture)).toEqual([]);
    expect(
      screen.queryByRole('button', { name: 'Save Changes' }),
    ).not.toBeInTheDocument();
    expect(screen.getByTitle('dir-1')).toHaveTextContent('dir-1');
    expect(screen.getByText('Range / Base')).toBeInTheDocument();
    expect(screen.getByTitle('Open directory in Caster')).toHaveAttribute(
      'href',
      'http://caster.example/projects/proj-1?directory=dir-1',
    );
    expect(button('Store a Copy Now')).toBeEnabled();
  });

  /**
   * Verifies: a Viewer sees the copy but none of the actions on it.
   * Interacts with: canEditCasterCopy.
   * Data: MSEL role Viewer; a pending MSEL with a copy.
   */
  it('offers a Viewer no actions on the copy', async () => {
    await renderTab({ myRoles: [MselRole.Viewer], copy: COPY });

    expect(screen.getByText('Topology')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Store a Copy Now' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Delete the Copy' }),
    ).not.toBeInTheDocument();
  });

  /**
   * Verifies: the copy shows its project, the chain down to the directory, when and by whom it was taken, and its files from the root down, each file's content when opened.
   * Interacts with: MselCasterExportService.getMselCasterExport (stub), copyPath, copyFiles, the file expansion panels.
   * Data: MSEL role Owner; a pending MSEL with no directory and the copy of Topology / Root / Range.
   */
  it('shows the stored copy and its files', async () => {
    const { copyApi } = await renderTab({ copy: COPY });

    expect(copyApi.getMselCasterExport).toHaveBeenCalledWith('msel-1');
    expect(screen.getByText('Topology')).toBeInTheDocument();
    expect(screen.getByText('Root / Range')).toBeInTheDocument();
    expect(screen.getByText(/by Pat Planner/)).toBeInTheDocument();
    expect(
      screen.getByText(
        /the push imports the copy into Caster as a new project/,
      ),
    ).toBeInTheDocument();
    expect(
      screen
        .getAllByRole('button', { expanded: false })
        .map((b) => b.textContent.trim()),
    ).toEqual([
      'Root/providers.tfshared from above',
      'Range/main.tf',
      'Range/__Workspaces__/topology/topology.auto.tfvarsworkspace topology',
    ]);

    await userEvent.setup().click(screen.getByText('Range/main.tf'));

    expect(screen.getByText('variable "blue" {}')).toBeInTheDocument();
  });

  /**
   * Verifies: without the file contents, which the API keeps for owners and editors, the files are listed but cannot be opened, and the tab says who sees them.
   * Interacts with: contentsIncluded, the file expansion panels.
   * Data: MSEL role Viewer; a pending MSEL with a copy answered without contents.
   */
  it('lists the files without their contents for a contributor who may not change the copy', async () => {
    await renderTab({
      myRoles: [MselRole.Viewer],
      copy: { ...COPY, contentsIncluded: false },
    });

    expect(
      screen.getByText(
        /File contents are shown only to the MSEL's owners and editors/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^Range\/main\.tf/ }),
    ).toHaveAttribute('aria-disabled', 'true');
  });

  /**
   * Verifies: Store a Copy Now needs a linked directory to copy.
   * Interacts with: Store a Copy Now.
   * Data: MSEL role Owner; a pending MSEL with a copy and no directory.
   */
  it('offers no new copy without a linked directory', async () => {
    await renderTab({ copy: COPY });

    expect(button('Store a Copy Now')).toBeDisabled();
  });

  /**
   * Verifies: Store a Copy Now replaces the copy after asking, showing the new one.
   * Interacts with: Store a Copy Now, CrucibleDialogService.confirm (stub, confirms), MselCasterExportService.captureMselCasterExport (stub).
   * Data: MSEL role Owner; a pending MSEL linked to dir-1 with a copy.
   */
  it('stores a new copy of the linked directory', async () => {
    const { fixture, copyApi, confirm } = await renderTab({
      copy: COPY,
      mselExtra: { casterDirectoryId: 'dir-1' },
    });
    await userEvent.setup().click(button('Store a Copy Now'));
    fixture.detectChanges();

    expect(confirm).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        title: 'Store a New Copy',
        confirmText: 'Replace',
      }),
    );
    expect(copyApi.captureMselCasterExport).toHaveBeenCalledExactlyOnceWith(
      'msel-1',
    );
    expect(screen.getByText('Range Project')).toBeInTheDocument();
  });

  /**
   * Verifies: Import into Caster is offered only with a copy and no directory, and links the MSEL to the directory the import made.
   * Interacts with: Import into Caster, CrucibleDialogService.confirm (stub, confirms), MselCasterExportService.importMselCasterExport (stub), MselStore.
   * Data: MSEL role Owner; a pending MSEL with no directory and a copy.
   */
  it('imports the copy into Caster and links the MSEL to it', async () => {
    const { fixture, copyApi, casterApi } = await renderTab({ copy: COPY });

    await userEvent.setup().click(button('Import into Caster'));
    fixture.detectChanges();

    expect(copyApi.importMselCasterExport).toHaveBeenCalledExactlyOnceWith(
      'msel-1',
    );
    expect(storedDirectoryId()).toBe('dir-new');
    expect(casterApi.getCasterDirectories).toHaveBeenCalledTimes(2);
    expect(button('Import into Caster')).toBeDisabled();
  });

  /**
   * Verifies: Delete the Copy asks first, then deletes it.
   * Interacts with: Delete the Copy, CrucibleDialogService.confirm (stub, confirms), MselCasterExportService.deleteMselCasterExport (stub).
   * Data: MSEL role Owner; a pending MSEL linked to dir-1 with a copy.
   */
  it('deletes the copy', async () => {
    const { fixture, copyApi, confirm } = await renderTab({
      copy: COPY,
      mselExtra: { casterDirectoryId: 'dir-1' },
    });

    await userEvent.setup().click(button('Delete the Copy'));
    fixture.detectChanges();

    expect(confirm).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ title: 'Delete the Copy' }),
    );
    expect(copyApi.deleteMselCasterExport).toHaveBeenCalledExactlyOnceWith(
      'msel-1',
    );
    expect(screen.getByText('No copy is stored.')).toBeInTheDocument();
  });

  /**
   * Verifies: while the integrations are deployed the directory and the copy are locked, even with EditMsels.
   * Interacts with: integrationsLocked.
   * Data: EditMsels; a deployed MSEL linked to dir-1, with workspace ws-1 and a copy.
   */
  it('locks the directory and the copy while deployed', async () => {
    const { fixture } = await renderTab({
      permissions: [SystemPermission.EditMsels],
      copy: COPY,
      mselExtra: {
        status: MselItemStatus.Deployed,
        casterDirectoryId: 'dir-1',
        casterWorkspaceId: 'ws-1',
      },
    });

    expect(await directorySelects(fixture)).toEqual([]);
    expect(
      screen.getByText(/locked while the integrations are deployed/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Store a Copy Now' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Save Changes' }),
    ).not.toBeInTheDocument();
  });
});
