// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { DataOptionImportPreview, DataOptionService } from 'src/app/generated/blueprint.api';
import { DataOptionImportDialogComponent } from './data-option-import-dialog.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';

const PREVIEW: DataOptionImportPreview = {
  items: [
    { optionName: 'HIGH', optionValue: 'High priority', exists: true },
    { optionName: 'LOW', optionValue: 'Low priority', exists: false },
  ],
};

async function renderImport() {
  const optionApi = {
    previewDataOptionImport: vi.fn(() => of(structuredClone(PREVIEW))),
  } satisfies ApiStub<DataOptionService>;
  const ref = dialogRefStub<DataOptionImportDialogComponent>();
  const rendered = await renderComponent(DataOptionImportDialogComponent, {
    imports: [
      ...CRUCIBLE_DIALOG_IMPORTS,
      MatButtonModule,
      MatCheckboxModule,
      MatFormFieldModule,
      MatIconModule,
      MatProgressSpinnerModule,
      MatTooltipModule,
    ],
    declarations: [DataOptionImportDialogComponent],
    providers: [
      { provide: DataOptionService, useValue: optionApi },
      {
        provide: MAT_DIALOG_DATA,
        useValue: { dataFieldId: 'df-1', existingOptions: [{ id: 'opt-1', optionName: 'HIGH', optionValue: 'High priority' }] },
      },
      { provide: MatDialogRef, useValue: ref.dialogRef },
    ],
  });
  return { ...rendered, optionApi, close: ref.close };
}

async function chooseFile(container: Element) {
  const user = userEvent.setup();
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  await user.upload(input, new File(['ID,Name\nLOW,Low priority'], 'options.csv', { type: 'text/csv' }));
  return user;
}

describe('DataOptionImportDialogComponent', () => {
  /**
   * Verifies: the component mounts with the default test providers with nothing to import yet.
   * Interacts with: getDefaultProviders (placeholders and stubs only), crucible-dialog.
   * Data: data field df-1 with one existing option.
   */
  it('renders with the default test providers', async () => {
    const { fixture } = await renderImport();

    expect(fixture.componentInstance).toBeInstanceOf(DataOptionImportDialogComponent);
    expect(screen.getByRole('heading', { name: 'Import Options' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import 0 Options' })).toBeDisabled();
  });

  /**
   * Verifies: a chosen file is previewed by the API, existing options are skipped, and Import closes with the new options numbered after the existing ones.
   * Interacts with: the file input, DataOptionService.previewDataOptionImport (stub), MatDialogRef.close (stub).
   * Data: options.csv previewing HIGH (exists) and LOW (new).
   */
  it('imports the new options from a previewed file', async () => {
    const { container, optionApi, close } = await renderImport();

    const user = await chooseFile(container);
    expect(optionApi.previewDataOptionImport).toHaveBeenCalledWith('df-1', expect.any(File));
    expect(screen.getByRole('heading', { name: 'Preview (1 to import, 1 to skip)' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Import 1 Option' }));

    expect(close).toHaveBeenCalledWith([
      expect.objectContaining({ dataFieldId: 'df-1', optionName: 'LOW', optionValue: 'Low priority', displayOrder: 2 }),
    ]);
  });

  /**
   * Verifies: Cancel closes the dialog with nothing.
   * Interacts with: MatDialogRef.close (stub).
   * Data: no file chosen.
   */
  it('closes with nothing on Cancel', async () => {
    const { close } = await renderImport();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(close).toHaveBeenCalledWith();
  });
});
