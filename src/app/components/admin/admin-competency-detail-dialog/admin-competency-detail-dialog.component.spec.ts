// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { AdminCompetencyDetailDialogComponent } from './admin-competency-detail-dialog.component';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';

async function renderDetail() {
  const ref = dialogRefStub<AdminCompetencyDetailDialogComponent>();
  const rendered = await renderComponent(AdminCompetencyDetailDialogComponent, {
    imports: [...CRUCIBLE_DIALOG_IMPORTS, MatButtonModule],
    declarations: [AdminCompetencyDetailDialogComponent],
    providers: [
      {
        provide: MAT_DIALOG_DATA,
        useValue: {
          competency: { id: 'c-1', idNumber: 'K0001', shortName: 'Networking', description: 'Knowledge of networks' },
          competencyTypeMap: new Map([['c-1', 'Knowledge']]),
        },
      },
      { provide: MatDialogRef, useValue: ref.dialogRef },
    ],
  });
  return { ...rendered, close: ref.close };
}

describe('AdminCompetencyDetailDialogComponent', () => {
  /**
   * Verifies: the component mounts with the default test providers and shows the competency's ID, name, type and description.
   * Interacts with: getDefaultProviders (placeholders and stubs only), crucible-dialog.
   * Data: K0001 Networking, a Knowledge competency.
   */
  it('renders with the default test providers', async () => {
    const { fixture } = await renderDetail();

    expect(fixture.componentInstance).toBeInstanceOf(AdminCompetencyDetailDialogComponent);
    expect(screen.getByRole('heading', { name: 'Competency Detail' })).toBeInTheDocument();
    for (const text of ['K0001', 'Networking', 'Knowledge', 'Knowledge of networks']) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });

  /**
   * Verifies: Close closes the dialog.
   * Interacts with: MatDialogRef.close (stub).
   * Data: K0001.
   */
  it('closes from the Close button', async () => {
    const { close } = await renderDetail();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(close).toHaveBeenCalledTimes(1);
  });
});
