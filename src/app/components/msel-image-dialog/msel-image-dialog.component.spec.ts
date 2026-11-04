// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { MselImageDataService } from 'src/app/data/msel/msel-image-data.service';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { MselImageDialogComponent, MselImageDialogResult } from './msel-image-dialog.component';

const NEW = 'data:image/jpeg;base64,/9j/AA==';

describe('MselImageDialogComponent', () => {
  async function renderDialog(url: string | null, canGenerate = true, images: Partial<Record<keyof MselImageDataService, unknown>> = {}) {
    const ref = dialogRefStub<MselImageDialogComponent, MselImageDialogResult>(undefined);
    const service = {
      previewImage: vi.fn(() => of({ image: NEW })),
      saveImage: vi.fn(() => of({ id: 'msel-1' })),
      ...images,
    };
    await render(MselImageDialogComponent, {
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { mselId: 'msel-1', url, name: 'Exercise Alpha', canGenerate } },
        { provide: MatDialogRef, useValue: ref.dialogRef },
        { provide: MselImageDataService, useValue: service },
      ],
    });
    return { ...ref, service };
  }

  /**
   * Verifies: the dialog shows the image at full size under the MSEL's name, and Close closes it with nothing.
   * Interacts with: MAT_DIALOG_DATA, MatDialogRef.close.
   * Data: a blob URL and the name "Exercise Alpha".
   */
  it('shows the image and closes', async () => {
    const { close } = await renderDialog('blob:card');

    expect(screen.getByAltText('Card image for Exercise Alpha')).toHaveAttribute('src', 'blob:card');
    expect(screen.getByText('Exercise Alpha')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Close' }));
    expect(close).toHaveBeenCalledWith();
  });

  /**
   * Verifies: Regenerate makes a new picture with the planner's words and shows it beside the current one, saving nothing
   * and keeping the dialog open; Use this saves it and closes.
   * Interacts with: MselImageDataService.previewImage and saveImage, MatDialogRef.close.
   * Data: "the control room at night"; the model's picture is a JPEG data URI.
   */
  it('shows the new picture beside the current one and saves it only on Use this', async () => {
    const { close, service } = await renderDialog('blob:card');
    const user = userEvent.setup();

    await user.type(screen.getByRole('textbox', { name: 'What should the picture show or change?' }), 'the control room at night');
    await user.click(screen.getByRole('button', { name: 'Regenerate' }));

    expect(service.previewImage).toHaveBeenCalledWith('msel-1', 'the control room at night');
    expect(screen.getByAltText('New card image for Exercise Alpha')).toHaveAttribute('src', NEW);
    expect(screen.getByAltText('Card image for Exercise Alpha')).toBeInTheDocument();
    expect(service.saveImage).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Use this' }));
    expect(service.saveImage).toHaveBeenCalledWith('msel-1', NEW);
    expect(close).toHaveBeenCalledWith({ saved: true });
  });

  /**
   * Verifies: Discard goes back to the current picture without saving, and Try again makes another.
   * Interacts with: previewImage, saveImage.
   * Data: two previews.
   */
  it('discards a new picture or makes another', async () => {
    const { service } = await renderDialog('blob:card');
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Regenerate' }));
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(service.previewImage).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.queryByAltText('New card image for Exercise Alpha')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Regenerate' })).toBeInTheDocument();
    expect(service.saveImage).not.toHaveBeenCalled();
  });

  /**
   * Verifies: a picture that cannot be made says why, in the API's words, and the dialog stays as it was.
   * Interacts with: previewImage failing with a 400.
   * Data: "This server has no image model…".
   */
  it('says why a picture could not be made', async () => {
    await renderDialog('blob:card', true, {
      previewImage: vi.fn(() => throwError(() => ({ status: 400, error: { title: 'This server has no image model, so it cannot make a picture.' } }))),
    });

    await userEvent.setup().click(screen.getByRole('button', { name: 'Regenerate' }));

    expect(screen.getByRole('alert')).toHaveTextContent('This server has no image model');
    expect(screen.queryByRole('button', { name: 'Use this' })).not.toBeInTheDocument();
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
   * Verifies: a planner who may not change the picture sees it with no box or button to ask for another.
   * Interacts with: MAT_DIALOG_DATA canGenerate false.
   * Data: a picture.
   */
  it('offers nothing to change to a viewer', async () => {
    await renderDialog('blob:card', false);

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Regenerate' })).not.toBeInTheDocument();
  });
});
