// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { MselDataService } from 'src/app/data/msel/msel-data.service';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { MselPageDraftDialogComponent, MselPageDraftDialogData } from './msel-page-draft-dialog.component';

describe('MselPageDraftDialogComponent', () => {
  async function renderDialog(content: string, draftPage = vi.fn(() => of({ html: '<p>New read-in</p>', notes: ['Assumed one shift'] }))) {
    const ref = dialogRefStub<MselPageDraftDialogComponent, string>(undefined);
    const data: MselPageDraftDialogData = { mselId: 'msel-1', pageId: 'page-1', name: 'Read-In', content };
    await render(MselPageDraftDialogComponent, {
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: ref.dialogRef },
        { provide: MselDataService, useValue: { draftPage } },
      ],
    });
    return { ref, draftPage, user: userEvent.setup() };
  }

  /**
   * Verifies: a page with content needs an instruction; Write sends the unsaved page with it, the current and proposed pages are
   * compared with the notes, and Use this hands the proposed page back.
   * Interacts with: MselDataService.draftPage (stub), MatDialogRef.close.
   * Data: the read-in "<p>Old read-in</p>"; instruction "Add the rules of play".
   */
  it('changes a page as asked and hands it back', async () => {
    const { ref, draftPage, user } = await renderDialog('<p>Old read-in</p>');

    expect(screen.getByRole('button', { name: 'Write' })).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'What should change?' }), 'Add the rules of play');
    await user.click(screen.getByRole('button', { name: 'Write' }));

    expect(draftPage).toHaveBeenCalledWith('msel-1', { pageId: 'page-1', name: 'Read-In', content: '<p>Old read-in</p>', instruction: 'Add the rules of play' });
    expect(screen.getByText('Old read-in')).toBeInTheDocument();
    expect(screen.getByText('New read-in')).toBeInTheDocument();
    expect(screen.getByText('Assumed one shift')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Use this' }));
    expect(ref.close).toHaveBeenCalledWith('<p>New read-in</p>');
  });

  /**
   * Verifies: an empty page can be written for its name without an instruction, and a failure says why and lets the planner retry.
   * Interacts with: MselDataService.draftPage (stub, fails).
   * Data: an empty page; the API answers 400 "Name the page".
   */
  it('writes an empty page and says why it failed', async () => {
    const draftPage = vi.fn(() => throwError(() => ({ status: 400, error: { title: 'Name the page, or say what to write.' } })));
    const { user } = await renderDialog('', draftPage);

    expect(screen.getByRole('textbox', { name: 'Instructions (optional)' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Write' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Name the page, or say what to write.');
    expect(screen.getByRole('button', { name: 'Write' })).toBeEnabled();
  });
});
