// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { NameDialogComponent } from './name-dialog.component';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';

async function renderNameDialog(nameValue = 'Analysts') {
  const ref = dialogRefStub<NameDialogComponent>();
  const rendered = await renderComponent(NameDialogComponent, {
    imports: [...CRUCIBLE_DIALOG_IMPORTS, MatFormFieldModule, MatInputModule],
    declarations: [NameDialogComponent],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: { nameValue } },
      { provide: MatDialogRef, useValue: ref.dialogRef },
    ],
    // The opener sets the title on the instance after the dialog opens.
    componentProperties: { title: 'Rename Analysts' },
  });
  return { ...rendered, close: ref.close };
}

describe('NameDialogComponent', () => {
  /**
   * Verifies: the component mounts with the default test providers, prefilled, with Save disabled until the name changes.
   * Interacts with: getDefaultProviders (placeholders and stubs only), crucible-dialog form mode.
   * Data: name Analysts.
   */
  it('renders with the default test providers', async () => {
    const { fixture } = await renderNameDialog();

    expect(fixture.componentInstance).toBeInstanceOf(NameDialogComponent);
    expect(screen.getByRole('heading', { name: 'Rename Analysts' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Analysts');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  /**
   * Verifies: Save closes the dialog with the new name.
   * Interacts with: the name form, crucible-dialog submit, MatDialogRef.close (stub).
   * Data: the name changed to Senior Analysts.
   */
  it('closes with the new name', async () => {
    const { close } = await renderNameDialog();
    const user = userEvent.setup();

    await user.clear(screen.getByRole('textbox', { name: 'Name' }));
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Senior Analysts');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(close).toHaveBeenCalledWith(expect.objectContaining({ nameValue: 'Senior Analysts', removeArtifacts: false }));
  });
});
