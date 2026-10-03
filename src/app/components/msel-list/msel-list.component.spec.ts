// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatSelectHarness } from '@angular/material/select/testing';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { ComnSettingsService, CrucibleDialogService } from '@cmusei/crucible-common';
import {
  Msel,
  MselItemStatus,
  MselRole,
  MselService,
  SystemPermission,
  SystemPermissionsService,
  User,
  UserService,
} from 'src/app/generated/blueprint.api';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { CurrentUserStore } from 'src/app/data/user/user.store';
import { SignalRService } from 'src/app/services/signalr.service';
import { MselListComponent } from './msel-list.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { permissionApiStubs } from 'src/app/test-utils/mock-permission-data.service';

const ME = 'user-me';

function msel(overrides: Partial<Msel> = {}): Msel {
  return {
    id: 'msel-1',
    name: 'Exercise Alpha',
    description: 'Alpha',
    status: MselItemStatus.Pending,
    createdBy: 'someone-else',
    isTemplate: false,
    userMselRoles: [],
    dateCreated: '2026-01-01T00:00:00Z' as unknown as Date,
    dateModified: '2026-01-02T00:00:00Z' as unknown as Date,
    ...overrides,
  };
}

// Near misses for the denied cases: every MSEL system permission except the
// one the gate needs.
const ALL_MSEL_PERMISSIONS = [
  SystemPermission.CreateMsels,
  SystemPermission.ViewMsels,
  SystemPermission.EditMsels,
  SystemPermission.ManageMsels,
];
const allBut = (missing: SystemPermission) => ALL_MSEL_PERMISSIONS.filter((p) => p !== missing);

function role(mselRole: MselRole) {
  return [{ id: `umr-${mselRole}`, userId: ME, mselId: 'msel-1', role: mselRole }];
}

async function renderMselList(
  overrides: { permissions?: SystemPermission[]; msels?: Msel[] } = {},
) {
  const { permissions = [], msels = [msel()] } = overrides;
  // A fresh copy per call, as HTTP would give: Akita deep-freezes what it
  // stores, and the data service writes parsed dates onto each response.
  const mselApi = {
    getMsels: vi.fn(() => of(structuredClone(msels))),
    getMyMsels: vi.fn(() => of(structuredClone(msels))),
    copyMsel: vi.fn(() => of(msel({ id: 'msel-copy', name: 'Exercise Alpha - Copy' }))),
    deleteMsel: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<MselService>;
  const userApi = {
    getUsers: vi.fn(() => of<User[]>([])),
  } satisfies ApiStub<UserService>;
  // The user confirms every dialog.
  const confirm = vi.fn(() => dialogRefStub<unknown, boolean>(true).dialogRef);
  const dialog = { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>;
  // MselListComponent loads the permissions itself in ngOnInit, so the real
  // service is provided over the stubbed endpoint, without priming it.
  const permissionApis = permissionApiStubs({ system: permissions });
  const selectMsel = vi.fn();
  const signalR: Pick<SignalRService, 'selectMsel'> = { selectMsel };

  const rendered = await renderComponent(MselListComponent, {
    imports: [
      MatButtonModule,
      MatCardModule,
      MatCheckboxModule,
      MatFormFieldModule,
      MatIconModule,
      MatInputModule,
      MatMenuModule,
      MatPaginatorModule,
      MatProgressSpinnerModule,
      MatSelectModule,
      MatSortModule,
      MatTableModule,
    ],
    declarations: [MselListComponent],
    providers: [
      { provide: SystemPermissionsService, useValue: permissionApis.systemPermissions },
      PermissionDataService,
      { provide: MselService, useValue: mselApi },
      { provide: UserService, useValue: userApi },
      { provide: CrucibleDialogService, useValue: dialog },
      { provide: SignalRService, useValue: signalR },
      {
        provide: ComnSettingsService,
        useValue: {
          settings: { AppTopBarImage: '/assets/img/pencil-ruler-white.png', DefaultDataFields: [] },
        } satisfies Pick<ComnSettingsService, 'settings'>,
      },
      {
        provide: CurrentUserStore,
        useFactory: () => {
          const store = new CurrentUserStore();
          store.update({ name: 'Me', id: ME });
          return store;
        },
      },
    ],
    inputs: { loggedInUserId: ME },
  });
  return { ...rendered, mselApi, confirm, selectMsel, permissionApis };
}

// Role queries are scoped to one region of the list: unscoped, a `getByRole`
// computes the role of every element in the document (0.7 s per query under
// coverage).
const region = (selector: string) => {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) {
    throw new Error(`No element matches '${selector}'`);
  }
  return el;
};
const toolbar = () => region('.buttons-container');
const headerRow = () => region('mat-header-row');
const table = () => region('mat-table');

const getRole = (scope: HTMLElement, role: string, name?: string | RegExp) =>
  within(scope).getByRole(role, { name });
const queryRole = (scope: HTMLElement, role: string, name?: string | RegExp) =>
  within(scope).queryByRole(role, { name });
const button = (scope: HTMLElement, name: string | RegExp) => getRole(scope, 'button', name);

function row(name: string) {
  const cell = within(table()).getByText(name, { selector: 'a, mat-cell, mat-cell *' });
  return cell.closest('mat-row') as HTMLElement;
}

describe('MselListComponent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('loading', () => {
    /**
     * Verifies: the component loads the caller's permissions, then with ViewMsels every MSEL ("All MSELs"); without it, only the caller's MSELs ("My MSELs").
     * Interacts with: real PermissionDataService over SystemPermissionsService.getMySystemPermissions (stub), MselService.getMsels / getMyMsels (stubs), real MselDataService and MselQuery.
     * Data: one MSEL; ViewMsels, or every other MSEL permission (near miss).
     */
    it.each([
      { label: 'with ViewMsels', permissions: [SystemPermission.ViewMsels], loads: 'getMsels', skips: 'getMyMsels', title: 'All MSELs' },
      { label: 'without ViewMsels', permissions: allBut(SystemPermission.ViewMsels), loads: 'getMyMsels', skips: 'getMsels', title: 'My MSELs' },
    ] as const)('loads $title $label', async ({ permissions, loads, skips, title }) => {
      const { mselApi, permissionApis } = await renderMselList({ permissions: [...permissions] });

      expect(permissionApis.systemPermissions.getMySystemPermissions).toHaveBeenCalledTimes(1);
      expect(mselApi[loads]).toHaveBeenCalledTimes(1);
      expect(mselApi[skips]).not.toHaveBeenCalled();
      expect(within(toolbar()).getByText(title)).toBeInTheDocument();
    });

    /**
     * Verifies: with ViewMsels the show-all toggle switches from all MSELs to my MSELs.
     * Interacts with: real PermissionDataService (stubbed grants), MselService.getMyMsels (stub), user-event clicks.
     * Data: ViewMsels granted; toggle clicked once.
     */
    it('switches to my MSELs with the toggle under ViewMsels', async () => {
      const { mselApi } = await renderMselList({ permissions: [SystemPermission.ViewMsels] });
      const user = userEvent.setup();

      await user.click(button(toolbar(), 'Show only MSELs I own or have access to'));

      expect(mselApi.getMyMsels).toHaveBeenCalledTimes(1);
      expect(within(toolbar()).getByText('My MSELs')).toBeInTheDocument();
      expect(button(toolbar(), 'Show all MSELs from all users')).toBeInTheDocument();
    });

    /**
     * Verifies: without ViewMsels the show-all toggle is absent.
     * Interacts with: real PermissionDataService (stubbed grants).
     * Data: every MSEL permission except ViewMsels (near miss).
     */
    it('hides the all/mine toggle without ViewMsels', async () => {
      await renderMselList({ permissions: allBut(SystemPermission.ViewMsels) });

      expect(queryRole(toolbar(), 'button', /Show all MSELs|Show only MSELs/)).not.toBeInTheDocument();
    });
  });

  describe('create gate', () => {
    /**
     * Verifies: the Add and Upload buttons are enabled only with CreateMsels.
     * Interacts with: real PermissionDataService (stubbed grants), MselListComponent.canCreateMsels.
     * Data: CreateMsels, or every other MSEL permission (near miss).
     */
    it.each([
      { label: 'disables', permissions: allBut(SystemPermission.CreateMsels), enabled: false },
      { label: 'enables', permissions: [SystemPermission.CreateMsels], enabled: true },
    ])('$label Add and Upload with permissions $permissions', async ({ permissions, enabled }) => {
      await renderMselList({ permissions });

      for (const name of ['Add blank MSEL', 'Upload a new MSEL from a file']) {
        if (enabled) {
          expect(button(headerRow(), name)).toBeEnabled();
        } else {
          expect(button(headerRow(), name)).toBeDisabled();
        }
      }
    });

    /**
     * Verifies: Copy is disabled without CreateMsels.
     * Interacts with: real PermissionDataService (stubbed grants), MselListComponent.canCreateMsels.
     * Data: Exercise Alpha; every MSEL permission except CreateMsels (near miss).
     */
    it('disables Copy without CreateMsels', async () => {
      await renderMselList({ permissions: allBut(SystemPermission.CreateMsels) });

      expect(button(row('Exercise Alpha'), 'Copy Exercise Alpha')).toBeDisabled();
    });

    /**
     * Verifies: with CreateMsels, confirming the dialog copies the MSEL into the list.
     * Interacts with: real PermissionDataService (grants: CreateMsels), CrucibleDialogService.confirm (stub confirming), MselService.copyMsel (stub).
     * Data: Exercise Alpha; copy returns "Exercise Alpha - Copy".
     */
    it('copies an MSEL with CreateMsels', async () => {
      const { confirm, mselApi } = await renderMselList({ permissions: [SystemPermission.CreateMsels] });
      const user = userEvent.setup();

      await user.click(button(row('Exercise Alpha'), 'Copy Exercise Alpha'));

      expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Copy MSEL' }));
      expect(mselApi.copyMsel).toHaveBeenCalledWith('msel-1');
      expect(await within(table()).findByText('Exercise Alpha - Copy')).toBeInTheDocument();
    });
  });

  describe('delete gate', () => {
    /**
     * Verifies: delete is allowed for ManageMsels or the MSEL's owner (creator or Owner role), and refused, with the reason as its label, otherwise.
     * Interacts with: real PermissionDataService (stubbed grants), MselPlus.hasRole, MselListComponent.getDeleteTooltip.
     * Data: every MSEL permission except ManageMsels (near miss); MSELs owned by someone else, created by ME, and with an Owner role for ME; an Editor-only MSEL (near-miss role).
     */
    it('allows delete for owners and ManageMsels only', async () => {
      await renderMselList({
        permissions: allBut(SystemPermission.ManageMsels),
        msels: [
          msel({ id: 'm-other', name: 'Other' }),
          msel({ id: 'm-created', name: 'Created By Me', createdBy: ME }),
          msel({ id: 'm-owner', name: 'Owner Role', userMselRoles: role(MselRole.Owner) }),
          msel({ id: 'm-editor', name: 'Editor Role', userMselRoles: role(MselRole.Editor) }),
        ],
      });

      expect(button(row('Other'), 'You do not have permission to delete this MSEL')).toBeDisabled();
      expect(button(row('Editor Role'), 'You do not have permission to delete this MSEL')).toBeDisabled();
      expect(button(row('Created By Me'), 'Delete Created By Me')).toBeEnabled();
      expect(button(row('Owner Role'), 'Delete Owner Role')).toBeEnabled();
    });

    /**
     * Verifies: ManageMsels allows deleting any MSEL, but deployed MSELs and templates stay undeletable.
     * Interacts with: real PermissionDataService (grants: ManageMsels), MselListComponent.getDeleteTooltip.
     * Data: a pending MSEL, a deployed MSEL and a template, none owned by ME.
     */
    it('blocks deleting deployed MSELs and templates even with ManageMsels', async () => {
      await renderMselList({
        permissions: [SystemPermission.ManageMsels],
        msels: [
          msel({ id: 'm-1', name: 'Pending One' }),
          msel({ id: 'm-2', name: 'Live One', status: MselItemStatus.Deployed }),
          msel({ id: 'm-3', name: 'Template One', isTemplate: true }),
        ],
      });

      expect(button(row('Pending One'), 'Delete Pending One')).toBeEnabled();
      expect(button(row('Live One'), 'Cannot delete deployed MSEL')).toBeDisabled();
      expect(button(row('Template One'), 'Cannot delete template MSELs')).toBeDisabled();
    });

    /**
     * Verifies: confirming a delete removes the MSEL from the list.
     * Interacts with: CrucibleDialogService.confirm (stub confirming), MselService.deleteMsel (stub), real MselQuery.
     * Data: an MSEL created by ME.
     */
    it('deletes after confirmation', async () => {
      const { confirm, mselApi } = await renderMselList({
        msels: [msel({ name: 'Mine', createdBy: ME })],
      });
      const user = userEvent.setup();

      await user.click(button(row('Mine'), 'Delete Mine'));

      expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delete MSEL' }));
      expect(mselApi.deleteMsel).toHaveBeenCalledWith('msel-1');
      expect(await screen.findByText('No results found')).toBeInTheDocument();
    });
  });

  describe('view gate', () => {
    /**
     * Verifies: without ViewMsels the MSEL name links to /build (and download is enabled) only for an MSEL Editor; a Viewer-role or no-role MSEL is plain text with download disabled.
     * Interacts with: real PermissionDataService (stubbed grants), MselPlus.hasRole, MselListComponent.canViewMsel.
     * Data: every MSEL permission except ViewMsels (near miss); Editor-role, Viewer-role (near-miss role) and no-role MSELs, none of them templates.
     */
    it('links the MSEL to the editor only for an editor role without ViewMsels', async () => {
      await renderMselList({
        permissions: allBut(SystemPermission.ViewMsels),
        msels: [
          msel({ id: 'm-ed', name: 'As Editor', userMselRoles: role(MselRole.Editor) }),
          msel({ id: 'm-vw', name: 'As Viewer', userMselRoles: role(MselRole.Viewer) }),
          msel({ id: 'm-no', name: 'No Role' }),
        ],
      });

      expect(getRole(row('As Editor'), 'link', 'As Editor')).toHaveAttribute(
        'href',
        '/build?msel=m-ed',
      );
      expect(button(row('As Editor'), 'Download As Editor')).toBeEnabled();
      expect(queryRole(row('No Role'), 'link')).not.toBeInTheDocument();
      expect(button(row('No Role'), 'Download No Role')).toBeDisabled();
      // The link opens /build, the MSEL editor, so canViewMsel requires an
      // Editor role; viewers reach their MSELs through msel/:mselid/view.
      expect(queryRole(row('As Viewer'), 'link')).not.toBeInTheDocument();
      expect(button(row('As Viewer'), 'Download As Viewer')).toBeDisabled();
    });

    /**
     * Verifies: with ViewMsels every MSEL name links to the editor, even without an MSEL role.
     * Interacts with: real PermissionDataService (grants: ViewMsels), MselListComponent.canViewMsel.
     * Data: a no-role MSEL.
     */
    it('links every MSEL with ViewMsels', async () => {
      await renderMselList({
        permissions: [SystemPermission.ViewMsels],
        msels: [msel({ id: 'm-no', name: 'No Role' })],
      });

      expect(getRole(row('No Role'), 'link', 'No Role')).toHaveAttribute(
        'href',
        '/build?msel=m-no',
      );
    });

    /**
     * Verifies: without ViewMsels a template MSEL links to the editor (and can be downloaded) with CreateMsels, and not with a near-miss permission.
     * Interacts with: real PermissionDataService (stubbed grants), MselListComponent.canViewMsel (template branch).
     * Data: a no-role template; CreateMsels, or EditMsels and ManageMsels.
     */
    it.each([
      { label: 'links', permissions: [SystemPermission.CreateMsels], linked: true },
      { label: 'does not link', permissions: [SystemPermission.EditMsels, SystemPermission.ManageMsels], linked: false },
    ])('$label a template with permissions $permissions', async ({ permissions, linked }) => {
      await renderMselList({
        permissions,
        msels: [msel({ id: 'm-tmpl', name: 'Template One', isTemplate: true })],
      });

      if (linked) {
        expect(getRole(row('Template One'), 'link', 'Template One')).toHaveAttribute('href', '/build?msel=m-tmpl');
        expect(button(row('Template One'), 'Download Template One')).toBeEnabled();
      } else {
        expect(queryRole(row('Template One'), 'link')).not.toBeInTheDocument();
        expect(button(row('Template One'), 'Download Template One')).toBeDisabled();
      }
    });

    /**
     * Verifies: opening an MSEL from its link joins its SignalR group.
     * Interacts with: SignalRService.selectMsel (stub), routerLink → Router.navigateByUrl (spy).
     * Data: an Editor-role MSEL.
     */
    it('joins the MSEL group when the MSEL is opened', async () => {
      const { selectMsel } = await renderMselList({
        msels: [msel({ id: 'm-ed', name: 'As Editor', userMselRoles: role(MselRole.Editor) })],
      });
      // The test router has no /build route; stop the navigation it would reject.
      const router = TestBed.inject(Router);
      const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
      const user = userEvent.setup();

      await user.click(getRole(row('As Editor'), 'link', 'As Editor'));

      expect(selectMsel).toHaveBeenCalledWith('m-ed');
      const [target] = navigateByUrl.mock.calls[0];
      expect(router.serializeUrl(target as UrlTree)).toBe('/build?msel=m-ed');
    });
  });

  describe('filters', () => {
    /**
     * Verifies: the type and status filters narrow the list, and the search box filters by text.
     * Interacts with: MatSelectHarness (type/status selects), the Search input, MatTableDataSource filtering.
     * Data: a pending template, an approved MSEL and a complete MSEL.
     */
    it('filters by type, status and search text', async () => {
      const { fixture } = await renderMselList({
        msels: [
          msel({ id: 'm-t', name: 'Template Pending', isTemplate: true }),
          msel({ id: 'm-a', name: 'Approved Exercise', status: MselItemStatus.Approved }),
          msel({ id: 'm-c', name: 'Finished Exercise', status: MselItemStatus.Complete }),
        ],
      });
      const loader = TestbedHarnessEnvironment.loader(fixture);
      const [typeSelect, statusSelect] = await loader.getAllHarnesses(MatSelectHarness);
      const visible = () =>
        within(table())
          .queryAllByRole('row')
          .map((r) => r.textContent)
          .join('|');

      await typeSelect.clickOptions({ text: 'Templates' });
      expect(visible()).toContain('Template Pending');
      expect(visible()).not.toContain('Approved Exercise');

      await typeSelect.clickOptions({ text: 'Not Templates' });
      await statusSelect.clickOptions({ text: 'Approved' });
      expect(visible()).toContain('Approved Exercise');
      expect(visible()).not.toContain('Finished Exercise');

      await statusSelect.clickOptions({ text: 'Completed' });
      expect(screen.getByText('No results found')).toBeInTheDocument();

      await statusSelect.clickOptions({ text: 'All Statuses' });
      await typeSelect.clickOptions({ text: 'All Types' });
      const user = userEvent.setup();
      await user.type(getRole(toolbar(), 'textbox', 'Search'), 'finished');
      expect(visible()).toContain('Finished Exercise');
      expect(visible()).not.toContain('Approved Exercise');
    });
  });
});
