// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { Subject } from 'rxjs';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { MselImportResult, MselService } from 'src/app/generated/blueprint.api';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { MselImportDialogComponent } from './msel-import-dialog.component';

async function renderMselImport() {
  const result = new Subject<MselImportResult>();
  const file = new File(['{}'], 'exercise.json', { type: 'application/json' });
  const api = { importJsonMsel: vi.fn(() => result) } satisfies ApiStub<MselService>;
  const { dialogRef, close } = dialogRefStub<MselImportDialogComponent, string>();
  const rendered = await renderComponent(MselImportDialogComponent, {
    imports: [...CRUCIBLE_DIALOG_IMPORTS, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
    providers: [
      { provide: MselService, useValue: api },
      { provide: MAT_DIALOG_DATA, useValue: { file } },
      { provide: MatDialogRef, useValue: dialogRef },
    ],
  });
  return { ...rendered, result, api, file, dialogRef, close };
}

describe('MselImportDialogComponent', () => {
  /**
   * Verifies: the component mounts with the default test providers.
   * Interacts with: real MselDataService over the generated MselService endpoint, dialogRefStub.
   * Data: exercise.json; the import result stays pending while the component mounts.
   */
  it('renders with the default test providers', async () => {
    const { fixture } = await renderMselImport();

    expect(fixture.componentInstance).toBeInstanceOf(MselImportDialogComponent);
    expect(fixture.nativeElement).toBeInTheDocument();
  });

  /**
   * Verifies: importing disables dismissal and Close while displaying the selected filename.
   * Interacts with: real MselDataService, MselService.importJsonMsel, dialogRefStub.
   * Data: exercise.json; the API response is pending.
   */
  it('prevents closing while the selected file is importing', async () => {
    const { api, file, dialogRef } = await renderMselImport();

    expect(api.importJsonMsel).toHaveBeenCalledExactlyOnceWith(file);
    expect(screen.getByText('Importing exercise.json...')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled();
    expect(dialogRef.disableClose).toBe(true);
    expect(screen.queryByRole('button', { name: 'Open MSEL' })).not.toBeInTheDocument();
  });

  /**
   * Verifies: the completed report stores the imported MSEL, renders all counts, changes and failed steps and permits dismissal.
   * Interacts with: real MselDataService and MselQuery, API response subject, dialogRefStub.
   * Data: six distinct counts, one changed field and one failed CITE step.
   */
  it('renders the import report and permits closing after completion', async () => {
    const { fixture, result, dialogRef } = await renderMselImport();
    expect(dialogRef.disableClose).toBe(true);

    result.next({
      msel: { id: 'imported-1', name: 'Imported Exercise' },
      imported: { moves: 1, scenarioEvents: 2, cards: 3, teams: 4, dataFields: 5, pages: 6 },
      changes: [{ field: 'name', message: 'The exercise name was adjusted.' }],
      failures: [{ step: 'citeScoringModel', message: 'CITE could not be reached.' }],
    });
    fixture.detectChanges();
    expect(TestBed.inject(MselQuery).getById('imported-1')).toMatchObject({
      id: 'imported-1', name: 'Imported Exercise',
    });

    expect(screen.getByText('Imported Exercise')).toBeInTheDocument();
    const imported = within(screen.getByRole('heading', { name: 'Imported' }).closest('section'));
    const countRows = imported.getAllByRole('listitem');
    expect(countRows).toHaveLength(6);
    const expectedCounts = [
      ['1', 'Moves'], ['2', 'Scenario Events'], ['3', 'Cards'],
      ['4', 'Teams'], ['5', 'Data Fields'], ['6', 'Pages'],
    ];
    countRows.forEach((item, index) => {
      const [count, label] = expectedCounts[index];
      expect(within(item).getByText(count)).toBeInTheDocument();
      expect(within(item).getByText(label)).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: 'Changed' })).toBeInTheDocument();
    expect(screen.getByText('The exercise name was adjusted.')).toBeInTheDocument();
    const failed = within(screen.getByRole('heading', { name: 'Failed' }).closest('section'));
    expect(failed.getByRole('listitem')).toHaveTextContent('citeScoringModel: CITE could not be reached.');
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Open MSEL' })).toBeEnabled();
    expect(dialogRef.disableClose).toBe(false);
  });

  /**
   * Verifies: a report without counts or optional sections omits their rows and headings.
   * Interacts with: API response subject, rendered report.
   * Data: an imported MSEL with no imported counts, changes or failures.
   */
  it('omits count rows and optional sections when absent from the report', async () => {
    const { fixture, result } = await renderMselImport();

    result.next({ msel: { id: 'imported-1', name: 'Imported Exercise' } });
    fixture.detectChanges();

    expect(screen.getByText('Imported Exercise')).toBeInTheDocument();
    expect(screen.queryAllByRole('listitem')).toEqual([]);
    expect(screen.queryByRole('heading', { name: 'Changed' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Failed' })).not.toBeInTheDocument();
  });

  /**
   * Verifies: Open MSEL returns the imported id, while Close returns no value.
   * Interacts with: rendered actions, MatDialogRef.close.
   * Data: imported MSEL id imported-1; one action per case.
   */
  it.each([
    { action: 'Open MSEL', args: ['imported-1'] },
    { action: 'Close', args: [] },
  ])('$action closes the report with $args', async ({ action, args }) => {
    const { fixture, result, close } = await renderMselImport();
    result.next({ msel: { id: 'imported-1', name: 'Imported Exercise' } });
    fixture.detectChanges();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: action }));

    expect(close.mock.calls).toEqual([args]);
  });

  /**
   * Verifies: import errors map to the displayed alert, clear progress and permit closing without a result.
   * Interacts with: real MselDataService, API error subject, MatDialogRef.close.
   * Data: network status 0, problem title/detail, title alone, message, and missing-message fallbacks.
   */
  it.each([
    { label: 'status 0', error: new HttpErrorResponse({ status: 0, error: { title: 'Ignored title' } }), message: 'The API could not be reached.' },
    { label: 'title and detail', error: new HttpErrorResponse({ status: 400, error: { title: 'Invalid file.', detail: 'No MSEL was found.' } }), message: 'Invalid file. No MSEL was found.' },
    { label: 'title alone', error: { error: { title: 'Invalid file.' } }, message: 'Invalid file.' },
    { label: 'message fallback', error: new Error('Request rejected.'), message: 'Request rejected.' },
    { label: 'empty error fallback', error: {}, message: 'The import failed.' },
    { label: 'detail without title fallback', error: { error: { detail: 'No MSEL was found.' } }, message: 'The import failed.' },
  ])('shows the $label import error and permits closing', async ({ error, message }) => {
    const { fixture, result, dialogRef, close } = await renderMselImport();
    expect(dialogRef.disableClose).toBe(true);

    result.error(error);
    fixture.detectChanges();

    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open MSEL' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeEnabled();
    expect(dialogRef.disableClose).toBe(false);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(close.mock.calls).toEqual([[]]);
  });
});
