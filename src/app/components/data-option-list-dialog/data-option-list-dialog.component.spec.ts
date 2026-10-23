// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { DataOption } from 'src/app/generated/blueprint.api';
import { DataOptionListDialogComponent } from './data-option-list-dialog.component';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';

const OPTIONS: DataOption[] = [
  { id: 'opt-1', optionName: 'HIGH', optionValue: 'High priority', displayOrder: 1 },
  { id: 'opt-2', optionName: 'LOW', optionValue: 'Low priority', displayOrder: 2 },
];

async function renderOptionList(overrides: { canEdit?: boolean; canImport?: boolean } = {}) {
  const { canEdit = true, canImport } = overrides;
  const data = {
    dataOptions: OPTIONS,
    canEdit,
    canImport,
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onAdd: vi.fn(),
    onImport: vi.fn(),
  };
  const ref = dialogRefStub<DataOptionListDialogComponent>();
  const rendered = await renderComponent(DataOptionListDialogComponent, {
    imports: [
      ...CRUCIBLE_DIALOG_IMPORTS,
      MatButtonModule,
      MatFormFieldModule,
      MatIconModule,
      MatInputModule,
      MatSortModule,
      MatTableModule,
      MatTooltipModule,
    ],
    declarations: [DataOptionListDialogComponent],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: ref.dialogRef },
    ],
  });
  return { ...rendered, data, close: ref.close };
}

const table = () => screen.getByRole('table');
const importButton = () => screen.queryByRole('button', { description: 'Import options from file' });

describe('DataOptionListDialogComponent', () => {
  /**
   * Verifies: with canEdit the dialog offers Add, Import and per-option Edit and Delete, each calling its callback.
   * Interacts with: the data callbacks (spies), crucible-dialog.
   * Data: canEdit true; options HIGH and LOW.
   */
  it('offers option actions with canEdit', async () => {
    const { data } = await renderOptionList({ canEdit: true });
    const user = userEvent.setup();

    expect(screen.getByRole('heading', { name: 'Manage Options (2)' })).toBeInTheDocument();
    await user.click(screen.getByTitle('Add new option'));
    await user.click(importButton() as HTMLElement);
    const high = within(table()).getByText('HIGH').closest('mat-row') as HTMLElement;
    await user.click(within(high).getByTitle('Edit this option'));
    await user.click(within(high).getByTitle('Delete this option'));

    expect(data.onAdd).toHaveBeenCalledTimes(1);
    expect(data.onImport).toHaveBeenCalledTimes(1);
    expect(data.onEdit).toHaveBeenCalledWith(OPTIONS[0]);
    expect(data.onDelete).toHaveBeenCalledWith(OPTIONS[0]);
  });

  /**
   * Verifies: without canEdit the options are listed read-only: no Add, Import, Edit or Delete.
   * Interacts with: DataOptionListDialogComponent.displayedColumns, template.
   * Data: canEdit false; options HIGH and LOW.
   */
  it('lists options read-only without canEdit', async () => {
    await renderOptionList({ canEdit: false });

    expect(within(table()).getByText('High priority')).toBeInTheDocument();
    expect(screen.queryByTitle('Add new option')).not.toBeInTheDocument();
    expect(importButton()).not.toBeInTheDocument();
    expect(within(table()).queryByTitle('Edit this option')).not.toBeInTheDocument();
    expect(within(table()).queryByTitle('Delete this option')).not.toBeInTheDocument();
  });

  /**
   * Verifies: with canEdit but canImport false the Import button is disabled.
   * Interacts with: DataOptionListDialogComponent template.
   * Data: canEdit true; canImport false.
   */
  it('disables Import when canImport is false', async () => {
    await renderOptionList({ canEdit: true, canImport: false });

    expect(importButton()).toBeDisabled();
    expect(screen.getByTitle('Add new option')).toBeEnabled();
  });

  /**
   * Verifies: Close closes the dialog.
   * Interacts with: MatDialogRef.close (stub).
   * Data: canEdit false.
   */
  it('closes from the Close button', async () => {
    const { close } = await renderOptionList({ canEdit: false });
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(close).toHaveBeenCalledTimes(1);
  });
});
