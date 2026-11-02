// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { MselImageDialogComponent, MselImageDialogResult } from './msel-image-dialog.component';

describe('MselImageDialogComponent', () => {
  async function renderDialog(url: string | null, canGenerate = true) {
    const ref = dialogRefStub<MselImageDialogComponent, MselImageDialogResult>(undefined);
    await render(MselImageDialogComponent, {
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { url, name: 'Exercise Alpha', canGenerate } },
        { provide: MatDialogRef, useValue: ref.dialogRef },
      ],
    });
    return ref;
  }

  /**
   * Verifies: the dialog shows the image at full size under the MSEL's name, and Close closes it with nothing.
   * Interacts with: MAT_DIALOG_DATA, MatDialogRef.close.
   * Data: a blob URL and the name "Exercise Alpha".
   */
  it('shows the image and closes', async () => {
    const ref = await renderDialog('blob:card');

    expect(screen.getByAltText('Card image for Exercise Alpha')).toHaveAttribute('src', 'blob:card');
    expect(screen.getByText('Exercise Alpha')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Close' }));
    expect(ref.close).toHaveBeenCalledWith();
  });

  /**
   * Verifies: Regenerate answers what the planner typed, so the next picture is asked for with it.
   * Interacts with: the prompt box, MatDialogRef.close.
   * Data: "the control room at night".
   */
  it('asks for a new picture with the planner words', async () => {
    const ref = await renderDialog('blob:card');
    const user = userEvent.setup();

    await user.type(screen.getByRole('textbox', { name: 'What should the picture show or change?' }), 'the control room at night');
    await user.click(screen.getByRole('button', { name: 'Regenerate' }));
    expect(ref.close).toHaveBeenCalledWith({ prompt: 'the control room at night' });
  });

  /**
   * Verifies: a MSEL without a picture says so and offers Generate instead of Regenerate.
   * Interacts with: MAT_DIALOG_DATA url null.
   * Data: no image.
   */
  it('offers Generate to a MSEL without a picture', async () => {
    await renderDialog(null);

    expect(screen.getByText(/No image yet/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate' })).toBeInTheDocument();
  });

  /**
   * Verifies: a viewer who may not change the image sees it without the prompt box or a Generate button.
   * Interacts with: canGenerate.
   * Data: a blob URL; canGenerate false.
   */
  it('shows only the image to a viewer', async () => {
    await renderDialog('blob:card', false);

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /generate/i })).not.toBeInTheDocument();
  });
});
