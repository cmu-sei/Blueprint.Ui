// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { TechniqueDetailDialogComponent } from './technique-detail-dialog.component';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';

const LONG_DESCRIPTION = 'Adversaries may steal data. '.repeat(60).trim();

async function renderDetail(technique = {}) {
  const ref = dialogRefStub<TechniqueDetailDialogComponent>();
  const rendered = await renderComponent(TechniqueDetailDialogComponent, {
    imports: [...CRUCIBLE_DIALOG_IMPORTS, MatButtonModule],
    declarations: [TechniqueDetailDialogComponent],
    providers: [
      {
        provide: MAT_DIALOG_DATA,
        useValue: {
          technique: {
            id: 't-1',
            externalId: 'T1011',
            name: 'Exfiltration Over Other Network Medium',
            description: LONG_DESCRIPTION,
            url: 'https://attack.mitre.org/techniques/T1011',
            platforms: ['Linux', 'Windows'],
            ...technique,
          },
          groupsLabel: 'Tactics',
          groupNames: 'Exfiltration',
        },
      },
      { provide: MatDialogRef, useValue: ref.dialogRef },
    ],
  });
  return { ...rendered, close: ref.close };
}

describe('TechniqueDetailDialogComponent', () => {
  /**
   * Verifies: the dialog titles itself with the technique's ID and name and shows its whole description, groups, platforms and link.
   * Interacts with: crucible-dialog, MAT_DIALOG_DATA.
   * Data: T1011 with a description far longer than a tooltip shows.
   */
  it('shows the full description with the technique details', async () => {
    await renderDetail();

    expect(
      screen.getByRole('heading', {
        name: 'T1011 Exfiltration Over Other Network Medium',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(LONG_DESCRIPTION)).toBeInTheDocument();
    expect(screen.getByText('Tactics')).toBeInTheDocument();
    expect(screen.getByText('Exfiltration')).toBeInTheDocument();
    expect(screen.getByText('Linux, Windows')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Open T1011 in the framework' }),
    ).toHaveAttribute('href', 'https://attack.mitre.org/techniques/T1011');
  });

  /**
   * Verifies: a technique with no description says so, and without a URL shows no link.
   * Interacts with: crucible-dialog.
   * Data: description and url cleared.
   */
  it('says when there is no description', async () => {
    await renderDetail({ description: null, url: null });

    expect(screen.getByText('No description.')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  /**
   * Verifies: Close closes the dialog.
   * Interacts with: the Close button, MatDialogRef.close (stub).
   * Data: default technique.
   */
  it('closes from the Close button', async () => {
    const { close } = await renderDetail();

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Close' }));

    expect(close).toHaveBeenCalled();
  });
});
