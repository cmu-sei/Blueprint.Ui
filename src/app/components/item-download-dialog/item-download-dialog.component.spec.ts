// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { ItemDownloadDialogComponent } from './item-download-dialog.component';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';

async function renderItemDownload(items = [{ id: 'it-1', label: 'Email' }, { id: 'it-2', label: 'Phone' }]) {
  const ref = dialogRefStub<ItemDownloadDialogComponent, string[]>();
  const rendered = await renderComponent(ItemDownloadDialogComponent, {
    imports: [...CRUCIBLE_DIALOG_IMPORTS, MatCheckboxModule],
    declarations: [ItemDownloadDialogComponent],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: { title: 'Select Inject Types to download', items } },
      { provide: MatDialogRef, useValue: ref.dialogRef },
    ],
  });
  return { ...rendered, close: ref.close };
}

describe('ItemDownloadDialogComponent', () => {
  /**
   * Verifies: the component mounts with the default test providers with every item selected.
   * Interacts with: getDefaultProviders (placeholders and stubs only), crucible-dialog.
   * Data: items Email and Phone.
   */
  it('renders with the default test providers', async () => {
    const { fixture } = await renderItemDownload();

    expect(fixture.componentInstance).toBeInstanceOf(ItemDownloadDialogComponent);
    expect(screen.getByRole('heading', { name: 'Select Inject Types to download' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Select all (2/2)' })).toBeChecked();
  });

  /**
   * Verifies: Download closes the dialog with the items still selected.
   * Interacts with: mat-checkbox change, crucible-dialog submit, MatDialogRef.close (stub).
   * Data: Phone unticked.
   */
  it('downloads the selected items', async () => {
    const { close } = await renderItemDownload();
    const user = userEvent.setup();

    await user.click(screen.getByRole('checkbox', { name: 'Phone' }));
    await user.click(screen.getByRole('button', { name: 'Download' }));

    expect(close).toHaveBeenCalledWith(['it-1']);
  });

  /**
   * Verifies: with nothing selected Download is disabled.
   * Interacts with: the Select all checkbox, crucible-dialog submitDisabled.
   * Data: Select all unticked.
   */
  it('disables Download with nothing selected', async () => {
    await renderItemDownload();
    const user = userEvent.setup();

    await user.click(screen.getByRole('checkbox', { name: 'Select all (2/2)' }));

    expect(screen.getByRole('button', { name: 'Download' })).toBeDisabled();
  });
});
