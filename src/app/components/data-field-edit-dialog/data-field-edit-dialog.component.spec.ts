// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { DataField, DataFieldType } from 'src/app/generated/blueprint.api';
import { DataFieldEditDialogComponent } from './data-field-edit-dialog.component';
import { DataOptionListDialogComponent } from '../data-option-list-dialog/data-option-list-dialog.component';
import { renderComponent } from 'src/app/test-utils/render-component';

function dataField(overrides: Partial<DataField> = {}): DataField {
  return {
    id: 'df-1',
    mselId: 'msel-1',
    name: 'Priority',
    dataType: DataFieldType.String,
    displayOrder: 3,
    isChosenFromList: true,
    dataOptions: [{ id: 'opt-1', optionName: 'HIGH', optionValue: 'High', displayOrder: 1 }],
    ...overrides,
  };
}

async function renderDataFieldEdit(flags: { canEdit?: boolean; isOwner?: boolean } = {}, field = dataField()) {
  const { canEdit = false, isOwner = false } = flags;
  const open = vi.fn();
  const rendered = await renderComponent(DataFieldEditDialogComponent, {
    imports: [...CRUCIBLE_DIALOG_IMPORTS, MatCheckboxModule, MatFormFieldModule, MatInputModule, MatSelectModule],
    declarations: [DataFieldEditDialogComponent],
    providers: [
      {
        provide: MAT_DIALOG_DATA,
        useValue: { title: 'Edit Data Field', dataField: field, canEdit, isOwner, dataFieldTypes: DataFieldType, useGallery: false },
      },
      { provide: MatDialog, useValue: { open } satisfies Pick<MatDialog, 'open'> },
    ],
  });
  // ngModel applies [disabled] in a microtask.
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();
  return { ...rendered, open };
}

// Queries go by label, and buttons are looked up in the dialog actions: the
// form is large enough that whole-dialog role queries time out under coverage.
const actions = () => within(document.querySelector('mat-dialog-actions') as HTMLElement);
const nameInput = () => screen.getByLabelText('Name');
const orderInput = () => screen.getByLabelText('Display Order');
const dataTypeSelect = () => screen.getByLabelText('Data Type');

describe('DataFieldEditDialogComponent', () => {
  /**
   * Verifies: with canEdit, or as the MSEL owner without it, the data field's settings are editable and the metadata fields are shown.
   * Interacts with: DataFieldEditDialogComponent template.
   * Data: canEdit true; or canEdit false and isOwner true.
   */
  it.each([
    { label: 'with canEdit', flags: { canEdit: true } },
    { label: 'as the MSEL owner', flags: { isOwner: true } },
  ])('edits the data field $label', async ({ flags }) => {
    await renderDataFieldEdit(flags);

    expect(nameInput()).toBeEnabled();
    expect(orderInput()).toBeEnabled();
    expect(dataTypeSelect()).toHaveAttribute('aria-disabled', 'false');
    expect(screen.getByLabelText('Display on the Events list')).toBeEnabled();
    expect(screen.getByLabelText('Column Metadata (Width)')).toBeInTheDocument();
  });

  /**
   * Verifies: without canEdit and not the owner every setting is disabled and the metadata fields are not rendered.
   * Interacts with: DataFieldEditDialogComponent template.
   * Data: canEdit false; isOwner false.
   */
  it('disables the data field settings without canEdit', async () => {
    await renderDataFieldEdit({ canEdit: false, isOwner: false });

    expect(nameInput()).toBeDisabled();
    expect(orderInput()).toBeDisabled();
    expect(dataTypeSelect()).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByLabelText('Display on the Events list')).toBeDisabled();
    expect(screen.getByLabelText('Use Option List')).toBeDisabled();
    expect(screen.queryByLabelText('Column Metadata (Width)')).not.toBeInTheDocument();
  });

  /**
   * Verifies: the options link opens the option list with canEdit and canImport following canEdit or ownership.
   * Interacts with: viewAllOptions, MatDialog.open (spy).
   * Data: a String field chosen from a list with one option; canEdit true, owner only, or neither.
   */
  it.each([
    { flags: { canEdit: true }, canAddOptions: true },
    { flags: { isOwner: true }, canAddOptions: true },
    { flags: {}, canAddOptions: false },
  ])('opens the option list with canEdit $canAddOptions', async ({ flags, canAddOptions }) => {
    const { open } = await renderDataFieldEdit(flags);
    const user = userEvent.setup();

    await user.click(screen.getByTitle('Click to manage options'));

    expect(open).toHaveBeenCalledWith(DataOptionListDialogComponent, expect.anything());
    const data = open.mock.calls[0][1].data;
    expect(data.canEdit).toBe(canAddOptions);
    expect(data.canImport).toBe(canAddOptions);
  });

  /**
   * Verifies: Save emits the data field, and is disabled without a display order.
   * Interacts with: errorFree, crucible-dialog submit, editComplete output.
   * Data: canEdit true; display order 3, then 0.
   */
  it('saves the field and requires a display order', async () => {
    const { fixture } = await renderDataFieldEdit({ canEdit: true });
    const results: unknown[] = [];
    fixture.componentInstance.editComplete.subscribe((r) => results.push(r));
    const user = userEvent.setup();

    await user.click(actions().getByRole('button', { name: 'Save' }));
    expect(results).toEqual([{ saveChanges: true, dataField: fixture.componentInstance.data.dataField }]);

    await user.clear(orderInput());
    await user.type(orderInput(), '0');
    expect(actions().getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  /**
   * Verifies: handleEditComplete(true) emits the save for a data field with no display order (current behavior).
   * Interacts with: handleEditComplete, editComplete output.
   * Data: canEdit true; display order 0.
   */
  it('saves an incomplete data field when handleEditComplete is called', async () => {
    const { fixture } = await renderDataFieldEdit({ canEdit: true }, dataField({ displayOrder: 0 }));
    const results: unknown[] = [];
    fixture.componentInstance.editComplete.subscribe((r) => results.push(r));

    fixture.componentInstance.handleEditComplete(true);

    // Current behavior; see agent-docs/ui-test-bugs/blueprint.ui.md.
    expect(results).toEqual([{ saveChanges: true, dataField: fixture.componentInstance.data.dataField }]);
  });

});
