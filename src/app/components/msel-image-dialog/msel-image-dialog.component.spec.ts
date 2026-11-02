// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MselImageDialogComponent } from './msel-image-dialog.component';

describe('MselImageDialogComponent', () => {
  /**
   * Verifies: the dialog shows the image at full size under the MSEL's name, and Close closes it.
   * Interacts with: MAT_DIALOG_DATA, MatDialogRef.close.
   * Data: a blob URL and the name "Exercise Alpha".
   */
  it('shows the image and closes', async () => {
    const ref = dialogRefStub<MselImageDialogComponent, void>(undefined);
    await render(MselImageDialogComponent, {
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { url: 'blob:card', name: 'Exercise Alpha' } },
        { provide: MatDialogRef, useValue: ref.dialogRef },
      ],
    });

    expect(screen.getByAltText('Card image for Exercise Alpha')).toHaveAttribute('src', 'blob:card');
    expect(screen.getByText('Exercise Alpha')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Close' }));
    expect(ref.close).toHaveBeenCalled();
  });
});
