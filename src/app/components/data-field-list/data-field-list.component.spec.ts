// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, Subject } from 'rxjs';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import {
  DataField,
  DataFieldService,
  DataFieldType,
  Msel,
  MselRole,
  SystemPermission,
  SystemPermissionsService,
} from 'src/app/generated/blueprint.api';
import { DataFieldStore } from 'src/app/data/data-field/data-field.store';
import { MselStore } from 'src/app/data/msel/msel.store';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { DataFieldListComponent } from './data-field-list.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { permissionApiStubs } from 'src/app/test-utils/mock-permission-data.service';
import { unstubbed } from 'src/app/test-utils/unstubbed';

const ME = 'user-me';
const ALL = Object.values(SystemPermission);
const allBut = (missing: SystemPermission) => ALL.filter((p) => p !== missing);

const TEMPLATE: DataField = { id: 'df-t', name: 'Template Field', dataType: DataFieldType.String, displayOrder: 1, isTemplate: true, dataOptions: [] };
const MSEL_FIELD: DataField = {
  id: 'df-1',
  mselId: 'msel-1',
  name: 'Priority',
  dataType: DataFieldType.String,
  displayOrder: 1,
  dataOptions: [{ id: 'do-1', dataFieldId: 'df-1', optionName: 'High', optionValue: 'High', displayOrder: 1 }],
};
const TYPE_FIELD: DataField = { id: 'df-2', injectTypeId: 'it-email', name: 'Subject', dataType: DataFieldType.String, displayOrder: 1, dataOptions: [] };

const COMPETENCY_FIELD: DataField = {
  id: 'df-3',
  mselId: 'msel-1',
  name: 'Skill',
  dataType: DataFieldType.Competency,
  displayOrder: 2,
  dataOptions: [{ id: 'do-3', dataFieldId: 'df-3', optionName: 'K0001', optionValue: 'K0001', displayOrder: 1 }],
};

function msel(roles: MselRole[] = [], createdBy = 'someone-else'): Msel {
  return {
    id: 'msel-1',
    name: 'Exercise Alpha',
    createdBy,
    userMselRoles: roles.map((role, i) => ({ id: `umr-${i}`, userId: ME, mselId: 'msel-1', role })),
  };
}

async function renderDataFields(
  overrides: {
    permissions?: SystemPermission[];
    showTemplates?: boolean;
    injectTypeId?: string;
    roles?: MselRole[];
    createdBy?: string;
    fields?: DataField[];
  } = {},
) {
  const { permissions = [], showTemplates = false, injectTypeId, roles = [], createdBy, fields = [MSEL_FIELD] } = overrides;
  // The templates answer after the component has initialized, as HTTP does:
  // the component picks them up only once its showTemplates input is set.
  const templates$ = new Subject<DataField[]>();
  const dataFieldApi = {
    getDataFieldTemplates: vi.fn(() => templates$),
    getDataFieldsByInjectType: vi.fn(() => of(structuredClone([TYPE_FIELD]))),
    updateDataField: vi.fn((_id: string, df: DataField) => of(df)),
  } satisfies ApiStub<DataFieldService>;
  // DataFieldListComponent loads the permissions itself in ngOnInit, so the
  // real service is provided over the stubbed endpoint, without priming it.
  const permissionApis = permissionApiStubs({ system: permissions });
  // A dialog opened here closes without saving, as Escape or a click outside does.
  const dialog = {
    open: vi.fn((_component: unknown, _config?: { data?: unknown }) => ({ afterClosed: () => of(undefined) })),
  };
  const rendered = await renderComponent(DataFieldListComponent, {
    imports: [
      DragDropModule,
      MatButtonModule,
      MatCheckboxModule,
      MatFormFieldModule,
      MatIconModule,
      MatInputModule,
      MatMenuModule,
      MatPaginatorModule,
      MatSelectModule,
      MatSortModule,
      MatTableModule,
    ],
    declarations: [DataFieldListComponent],
    providers: [
      { provide: SystemPermissionsService, useValue: permissionApis.systemPermissions },
      PermissionDataService,
      { provide: DataFieldService, useValue: dataFieldApi },
      unstubbed(CrucibleDialogService),
      { provide: MatDialog, useValue: dialog },
      // The MSEL page loads the MSEL and its data fields; the stores are seeded instead.
      {
        provide: MselStore,
        useFactory: () => {
          const store = new MselStore();
          store.set([msel(roles, createdBy)]);
          store.setActive('msel-1');
          return store;
        },
      },
      {
        provide: DataFieldStore,
        useFactory: () => {
          const store = new DataFieldStore();
          store.set(structuredClone(fields));
          return store;
        },
      },
    ],
    inputs: { showTemplates, injectTypeId, loggedInUserId: ME },
  });
  templates$.next(structuredClone([TEMPLATE]));
  rendered.fixture.detectChanges();
  // ngModel applies [disabled] to the checkboxes in a microtask.
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();
  return { ...rendered, dataFieldApi, permissionApis, dialog };
}

const table = () => screen.getByRole('table');
// Each action button and the icon inside it share a title; the button is the one that is clicked.
// A title query over the table is much faster than a role query with a name.
const queryButton = (name: string) => within(table()).queryAllByTitle(name).find((el) => el.tagName === 'BUTTON') ?? null;
const optionsCell = (name: string) =>
  within(within(table()).getByText(name).closest('mat-row') as HTMLElement).getByTitle('Click to manage options');
// A system row's name also appears as its data type, so its row is found by name among the System Defined rows.
const systemRowEventsListBox = (name: string) =>
  (Array.from(table().querySelectorAll('mat-row')) as HTMLElement[])
    .find((row) => row.textContent?.includes('*System Defined*') && within(row).queryAllByText(name).length > 0)
    ?.querySelector('[title="Display on Scenario Events list"] input') as HTMLInputElement;
const eventsListBox = (name: string) =>
  within(within(table()).getByText(name).closest('mat-row') as HTMLElement).getByTitle('Display on Scenario Events list').querySelector('input') as HTMLInputElement;

describe('DataFieldListComponent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('templates (admin)', () => {
    /**
     * Verifies: with ManageDataFields the template list offers add, upload, download, edit and delete.
     * Interacts with: real PermissionDataService over SystemPermissionsService (stub), DataFieldService.getDataFieldTemplates (stub).
     * Data: showTemplates true; ManageDataFields.
     */
    it('offers template actions with ManageDataFields', async () => {
      const { dataFieldApi, permissionApis } = await renderDataFields({
        showTemplates: true,
        permissions: [SystemPermission.ManageDataFields],
      });

      expect(permissionApis.systemPermissions.getMySystemPermissions).toHaveBeenCalledTimes(1);
      expect(dataFieldApi.getDataFieldTemplates).toHaveBeenCalledTimes(1);
      for (const title of ['Add a template data Field', 'Upload Data Field templates from JSON', 'Download Data Field templates as JSON', 'Edit Template Field', 'Delete Template Field']) {
        expect(queryButton(title)).toBeInTheDocument();
      }
    });

    /**
     * Verifies: without ManageDataFields the template list is read-only, even with EditMsels.
     * Interacts with: real PermissionDataService (stubbed grants), DataFieldListComponent.canEdit.
     * Data: showTemplates true; every permission but ManageDataFields (near miss).
     */
    it('hides template actions without ManageDataFields', async () => {
      await renderDataFields({ showTemplates: true, permissions: allBut(SystemPermission.ManageDataFields) });

      expect(within(table()).getByText('Template Field')).toBeInTheDocument();
      for (const title of ['Add a template data Field', 'Upload Data Field templates from JSON', 'Edit Template Field', 'Delete Template Field']) {
        expect(queryButton(title)).not.toBeInTheDocument();
      }
    });
  });

  describe('MSEL data fields', () => {
    /**
     * Verifies: with EditMsels, as an MSEL Editor or Owner, or as the MSEL's creator, the MSEL's data fields can be added, edited,
     * deleted and reordered, and their display flags changed.
     * Interacts with: real PermissionDataService (stubbed grants), MselPlus.hasRole, real MselQuery and DataFieldQuery.
     * Data: EditMsels with no MSEL role; the Editor or Owner role with no system permission; or createdBy the user with no role.
     */
    it.each([
      { label: 'with EditMsels', permissions: [SystemPermission.EditMsels], roles: [], createdBy: undefined },
      { label: 'as an MSEL Editor', permissions: [], roles: [MselRole.Editor], createdBy: undefined },
      { label: 'as an MSEL Owner', permissions: [], roles: [MselRole.Owner], createdBy: undefined },
      { label: 'as the MSEL creator', permissions: [], roles: [], createdBy: ME },
    ])('offers data field actions $label', async ({ permissions, roles, createdBy }) => {
      await renderDataFields({ permissions, roles, createdBy });

      for (const title of ['Add data Field', 'Edit Priority', 'Delete Priority']) {
        expect(queryButton(title)).toBeInTheDocument();
      }
      expect(eventsListBox('Priority')).toBeEnabled();
      expect(table().querySelector('.mdi-drag-vertical')).not.toBeNull();
    });

    /**
     * Verifies: Make a template is offered only with ManageDataFields as well, because a template is a field of no MSEL,
     * which the API creates only with that permission.
     * Interacts with: DataFieldListComponent.canMakeTemplate.
     * Data: the Editor role, with and without ManageDataFields.
     */
    it.each([
      { permissions: [SystemPermission.ManageDataFields], offered: true },
      { permissions: [], offered: false },
    ])('offers Make a template to an Editor only with ManageDataFields: $offered', async ({ permissions, offered }) => {
      await renderDataFields({ permissions, roles: [MselRole.Editor] });

      expect(queryButton('Make Priority a template') !== null).toBe(offered);
    });

    /**
     * Verifies: the system rows are MSEL settings, saved by updating the MSEL, so they follow its rule (EditMsels or Owner):
     * an Editor can change the Priority field but not the Move row.
     * Interacts with: DataFieldListComponent.canEditRow.
     * Data: the Editor role, or the Owner role, with no system permission.
     */
    it.each([
      { role: MselRole.Editor, systemRowEditable: false },
      { role: MselRole.Owner, systemRowEditable: true },
    ])('lets $role change the system rows: $systemRowEditable', async ({ role, systemRowEditable }) => {
      await renderDataFields({ roles: [role] });

      expect(eventsListBox('Priority')).toBeEnabled();
      expect(systemRowEventsListBox('Move').disabled).toBe(!systemRowEditable);
    });

    /**
     * Verifies: closing the competency dialog without saving sends no update, for an editor who only looked
     * and for a read-only user alike.
     * Interacts with: MatDialog.open (stub, closes with nothing), DataFieldService.updateDataField (stub).
     * Data: a Competency field with one option; the Editor role, or the Approver role.
     */
    it.each([MselRole.Editor, MselRole.Approver])('saves nothing when the competency dialog closes unsaved, as %s', async (role) => {
      const { dataFieldApi } = await renderDataFields({ roles: [role], fields: [MSEL_FIELD, COMPETENCY_FIELD] });
      const user = userEvent.setup();

      await user.click(optionsCell('Skill'));

      expect(dataFieldApi.updateDataField).not.toHaveBeenCalled();
    });

    /**
     * Verifies: without EditMsels, the Editor role or ownership the list is read-only, even with ManageDataFields; an Approver
     * edits events but not the fields, as the API refuses them.
     * Interacts with: real PermissionDataService (stubbed grants), MselPlus.hasRole.
     * Data: every permission but EditMsels (near miss: ManageDataFields, ManageMsels); MSEL roles Viewer and Evaluator, or Approver.
     */
    it.each([
      { label: 'a Viewer and Evaluator', roles: [MselRole.Viewer, MselRole.Evaluator] },
      { label: 'an Approver', roles: [MselRole.Approver] },
    ])('lists data fields read-only for $label without EditMsels', async ({ roles }) => {
      await renderDataFields({ permissions: allBut(SystemPermission.EditMsels), roles });

      expect(within(table()).getByText('Priority')).toBeInTheDocument();
      for (const title of ['Add data Field', 'Edit Priority', 'Delete Priority', 'Make Priority a template']) {
        expect(queryButton(title)).not.toBeInTheDocument();
      }
      expect(eventsListBox('Priority')).toBeDisabled();
      expect(table().querySelector('.mdi-drag-vertical')).toBeNull();
    });

    /**
     * Verifies: with EditMsels, as an MSEL Editor, or as the MSEL owner, the option list dialog opens with canEdit true for a String field.
     * Interacts with: DataFieldListComponent.viewDataOptions, MatDialog.open (stub), real PermissionDataService (stubbed grants), MselPlus.hasRole.
     * Data: Priority (String) with one option; EditMsels with no role, the Editor role, or the Owner role with no system permission.
     */
    it.each([
      { label: 'with EditMsels', permissions: [SystemPermission.EditMsels], roles: [] },
      { label: 'as an MSEL Editor', permissions: [], roles: [MselRole.Editor] },
      { label: 'as the MSEL owner', permissions: [], roles: [MselRole.Owner] },
    ])('lets the option list edit options $label', async ({ permissions, roles }) => {
      const { dialog } = await renderDataFields({ permissions, roles });
      const user = userEvent.setup();

      await user.click(optionsCell('Priority'));

      expect(dialog.open).toHaveBeenCalledTimes(1);
      expect(dialog.open.mock.calls[0][1]?.data).toEqual(expect.objectContaining({ canEdit: true }));
    });

    /**
     * Verifies: without EditMsels, an Editor role or ownership, the option list dialog opens with canEdit false.
     * Interacts with: DataFieldListComponent.viewDataOptions, MatDialog.open (stub), real PermissionDataService (stubbed grants).
     * Data: every permission but EditMsels (near miss: ManageDataFields, ManageMsels); MSEL roles Viewer and Evaluator, or Approver.
     */
    it.each([
      { label: 'a Viewer and Evaluator', roles: [MselRole.Viewer, MselRole.Evaluator] },
      { label: 'an Approver', roles: [MselRole.Approver] },
    ])('opens the option list read-only for $label without EditMsels', async ({ roles }) => {
      const { dialog } = await renderDataFields({ permissions: allBut(SystemPermission.EditMsels), roles });
      const user = userEvent.setup();

      await user.click(optionsCell('Priority'));

      expect(dialog.open).toHaveBeenCalledTimes(1);
      expect(dialog.open.mock.calls[0][1]?.data).toEqual(expect.objectContaining({ canEdit: false }));
    });
  });

  describe('inject type data fields (admin)', () => {
    /**
     * Verifies: an inject type's data fields belong to no MSEL, so, as the API does, they are editable with ManageDataFields and
     * read-only with EditMsels alone.
     * Interacts with: DataFieldService.getDataFieldsByInjectType (stub), DataFieldListComponent.canEdit.
     * Data: injectTypeId it-email; ManageDataFields only, or EditMsels only.
     */
    it.each([
      { permission: SystemPermission.ManageDataFields, editable: true },
      { permission: SystemPermission.EditMsels, editable: false },
    ])('gates inject type data fields on ManageDataFields: $permission edits $editable', async ({ permission, editable }) => {
      const { dataFieldApi } = await renderDataFields({ injectTypeId: 'it-email', permissions: [permission] });

      expect(dataFieldApi.getDataFieldsByInjectType).toHaveBeenCalledWith('it-email');
      expect(within(table()).getByText('Subject')).toBeInTheDocument();
      expect(queryButton('Edit Subject') !== null).toBe(editable);
      expect(queryButton('Make Subject a template')).toBeNull();
    });
  });
});
