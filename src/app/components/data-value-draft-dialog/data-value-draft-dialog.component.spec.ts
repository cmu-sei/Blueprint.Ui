// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, throwError } from 'rxjs';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import {
  DataFieldType,
  DataValueDraftAction,
  DataValueDraftResult,
  MselService,
} from 'src/app/generated/blueprint.api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { DataValueDraftDialogComponent, DataValueDraftDialogData } from './data-value-draft-dialog.component';

const BODY = { id: 'df-body', name: 'Description', dataType: DataFieldType.Html, displayOrder: 2 };

function dialogData(body: string | undefined): DataValueDraftDialogData {
  const values: { [id: string]: string } = { 'df-title': 'Storm warning issued' };
  if (body !== undefined) {
    values['df-body'] = body;
  }
  return {
    mselId: 'msel-1',
    scenarioEventId: 'se-1',
    deltaSeconds: 600,
    dataField: BODY,
    values,
    gallerySourceTypes: ['News', 'Email'],
  };
}

async function renderDraftDialog(body: string | undefined, draft = vi.fn(() => of<DataValueDraftResult>({ value: '<p>Landfall at noon.</p>', notes: ['Check the time zone.'] }))) {
  const mselApi = { draftDataValue: draft } satisfies ApiStub<MselService>;
  const ref = dialogRefStub<DataValueDraftDialogComponent, string>();
  const data = dialogData(body);
  const rendered = await renderComponent(DataValueDraftDialogComponent, {
    imports: [...CRUCIBLE_DIALOG_IMPORTS, MatFormFieldModule, MatInputModule, MatSelectModule, MatProgressSpinnerModule, MatIconModule],
    declarations: [DataValueDraftDialogComponent],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: ref.dialogRef },
      { provide: MselService, useValue: mselApi },
    ],
  });
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();
  return { ...rendered, draft, close: ref.close, data };
}

describe('DataValueDraftDialogComponent', () => {
  /**
   * Verifies: an empty field opens on Draft, sends the inject's values, and Use this closes with the proposed value.
   * Interacts with: MselService.draftDataValue, the result preview and notes, dialogRef.close.
   * Data: Description empty; Title "Storm warning issued"; the model proposes "<p>Landfall at noon.</p>".
   */
  it('drafts an empty field and hands the value back', async () => {
    const { draft, close, data } = await renderDraftDialog(undefined);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Write' }));

    expect(draft).toHaveBeenCalledWith('msel-1', {
      scenarioEventId: 'se-1',
      dataFieldId: 'df-body',
      deltaSeconds: 600,
      values: data.values,
      action: DataValueDraftAction.Draft,
      style: null,
      instruction: '',
    });
    expect(screen.getByText('Landfall at noon.')).toBeInTheDocument();
    expect(screen.getByText('Check the time zone.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Use this' }));
    expect(close).toHaveBeenCalledWith('<p>Landfall at noon.</p>');
  });

  /**
   * Verifies: a field with a value opens on Rewrite with the first Gallery source type, and shows the current value beside the proposal.
   * Interacts with: action and style selects, MselService.draftDataValue.
   * Data: Description "<p>NWS expects landfall.</p>"; source types News and Email.
   */
  it('rewrites a filled field in the chosen style', async () => {
    const { draft } = await renderDraftDialog('<p>NWS expects landfall.</p>');
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Write' }));

    expect(draft).toHaveBeenCalledWith('msel-1', expect.objectContaining({ action: DataValueDraftAction.Rewrite, style: 'News' }));
    expect(screen.getByText('NWS expects landfall.')).toBeInTheDocument();
  });

  /**
   * Verifies: Discard closes with nothing, so the edit dialog keeps its value.
   * Interacts with: dialogRef.close.
   * Data: Description empty; a proposal returned.
   */
  it('closes with nothing on Discard', async () => {
    const { close } = await renderDraftDialog(undefined);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Write' }));
    await user.click(screen.getByRole('button', { name: 'Discard' }));

    expect(close).toHaveBeenCalledWith();
  });

  /**
   * Verifies: a server error shows its detail and leaves the options in place to try again.
   * Interacts with: getErrorMessage, the error alert.
   * Data: a 500 whose detail is "AI drafting is not enabled on this server.".
   */
  it('shows the reason a write failed', async () => {
    const draft = vi.fn(() =>
      throwError(() => new HttpErrorResponse({ status: 500, error: { title: 'A server error occurred.', detail: 'AI drafting is not enabled on this server.' } }))
    );
    await renderDraftDialog(undefined, draft);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Write' }));

    expect(screen.getByRole('alert')).toHaveTextContent('AI drafting is not enabled on this server.');
    expect(screen.getByRole('button', { name: 'Write' })).toBeEnabled();
  });
});
