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
  AudioDraftAvailability,
  AudioDraftKind,
  AudioDraftResult,
  DataFieldType,
  DataValueDraftAction,
  DataValueDraftResult,
  MselService,
} from 'src/app/generated/blueprint.api';
import { MediaClip } from 'src/app/utilities/media-clip';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { DataValueDraftDialogComponent, DataValueDraftDialogData } from './data-value-draft-dialog.component';

const BODY = { id: 'df-body', name: 'Description', dataType: DataFieldType.Html, displayOrder: 2 };

function dialogData(body: string | undefined, sourceType?: string): DataValueDraftDialogData {
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
    sourceType,
  };
}

const NO_AUDIO: AudioDraftAvailability = { available: false, scripts: false, photos: false };

async function renderDraftDialog(
  body: string | undefined,
  draft = vi.fn(() => of<DataValueDraftResult>({ value: '<p>Landfall at noon.</p>', notes: ['Check the time zone.'] })),
  audio: { availability?: AudioDraftAvailability; sourceType?: string; draftAudio?: any } = {}
) {
  const getAudioDraftAvailability = vi.fn(() => of(audio.availability ?? NO_AUDIO));
  const draftAudio = audio.draftAudio ?? vi.fn(() => of<AudioDraftResult>({ kind: AudioDraftKind.Listen, lines: [] }));
  const mselApi = { draftDataValue: draft, getAudioDraftAvailability, draftAudio } satisfies ApiStub<MselService>;
  const ref = dialogRefStub<DataValueDraftDialogComponent, string>();
  const data = dialogData(body, audio.sourceType);
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
  return { ...rendered, draft, close: ref.close, data, draftAudio, getAudioDraftAvailability };
}

const VOICED: AudioDraftResult = {
  kind: AudioDraftKind.Broadcast,
  title: 'WPN News',
  notes: ['Assumed the mayor is named Ito.'],
  lines: [{ speaker: 'Anchor', voice: 'Matthew', text: 'Good evening.', audio: 'data:audio/mpeg;base64,QUFB', durationMs: 1200, marks: [], words: [] }],
};

const CLIP: MediaClip = {
  html: '<video controls src="data:video/mp4;base64,BAUG"></video>',
  position: 'body',
  format: 'waveform',
  codec: 'aac',
  seconds: 42,
  notes: ['Made in this browser.'],
};

async function chooseAction(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByRole('combobox', { name: 'What to do' }));
  await user.click(screen.getByRole('option', { name: label }));
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

  /**
   * Verifies: Use this turns the written article's SVG graphics into PNG before handing the value back.
   * Interacts with: the component's PNG conversion (replaced, as jsdom cannot draw), dialogRef.close.
   * Data: the model writes an article with one SVG logo.
   */
  it('hands back an article with its graphics as PNG', async () => {
    const { close, fixture } = await renderDraftDialog(undefined, vi.fn(() => of<DataValueDraftResult>({ value: '<img src="data:image/svg+xml;base64,LOGO" alt="Logo">', notes: [] })));
    fixture.componentInstance.toPng = async (html: string) => html.replace('image/svg+xml', 'image/png');
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Write' }));
    await user.click(screen.getByRole('button', { name: 'Use this' }));

    await vi.waitFor(() => expect(close).toHaveBeenCalledWith('<img src="data:image/png;base64,LOGO" alt="Logo">'));
  });

  /**
   * Verifies: without a speech provider the dialog offers only the text actions.
   * Interacts with: MselService.getAudioDraftAvailability, the What to do select.
   * Data: a News article; the server has no speech provider.
   */
  it('offers no audio without a speech provider', async () => {
    const { getAudioDraftAvailability } = await renderDraftDialog('<p>NWS expects landfall.</p>', undefined, { sourceType: 'News' });
    const user = userEvent.setup();

    await user.click(screen.getByRole('combobox', { name: 'What to do' }));

    expect(getAudioDraftAvailability).toHaveBeenCalledWith('msel-1');
    expect(screen.getAllByRole('option').map((o) => o.textContent.trim())).toEqual([
      'Draft from this inject',
      'Rewrite as...',
      'Make consistent with the scenario',
      'Shorten',
      'Expand',
    ]);
  });

  /**
   * Verifies: each source type is offered its own clips: News a broadcast and a reel, Phone a voicemail, Intel an intercepted
   * call, Social a reel; Listen on any article; and only Listen when there is no text model to write scripts.
   * Interacts with: MselService.getAudioDraftAvailability, the What to do options.
   * Data: the same article as each source type.
   */
  it.each([
    ['News', true, ["Add 'Listen to this article'", 'Make a news broadcast clip', 'Make a news reel']],
    ['Phone', true, ["Add 'Listen to this article'", 'Make a voicemail']],
    ['Intel', true, ["Add 'Listen to this article'", 'Make an intercepted call']],
    ['Social', true, ["Add 'Listen to this article'", 'Make a news reel']],
    ['News', false, ["Add 'Listen to this article'"]],
  ])('offers a %s inject its clips (scripts: %s)', async (sourceType, scripts, expected) => {
    const { fixture } = await renderDraftDialog('<p>Text.</p>', undefined, { sourceType, availability: { available: true, scripts } });

    expect(fixture.componentInstance.actions.filter((a) => a.audio).map((a) => a.label)).toEqual(expected);
  });

  /**
   * Verifies: a broadcast clip asks for the format, sends the inject's values and the kind, previews the article with the clip
   * in it and the notes, and Use this hands back the article with the clip where its body starts.
   * Interacts with: MselService.draftAudio, the component's media maker (replaced, as jsdom has no encoders), dialogRef.close.
   * Data: a News article with a marking; the model writes a one-line broadcast; the browser makes a waveform video.
   */
  it('makes a broadcast clip, previews it and hands back the article with it', async () => {
    const draftAudio = vi.fn(() => of(VOICED));
    const article = '<table title="Marking"><tr><td>EXERCISE</td></tr></table><h1>Storm</h1><p>NWS expects landfall.</p>';
    const { fixture, close, data } = await renderDraftDialog(article, undefined, {
      sourceType: 'News',
      availability: { available: true, scripts: true },
      draftAudio,
    });
    const makeMedia = vi.fn(async () => CLIP);
    fixture.componentInstance.makeMedia = makeMedia;
    const user = userEvent.setup();

    await chooseAction(user, 'Make a news broadcast clip');
    await user.click(screen.getByRole('combobox', { name: 'Format' }));
    await user.click(screen.getByRole('option', { name: 'Still card video' }));
    await user.type(screen.getByRole('textbox', { name: 'Instructions (optional)' }), 'Quote the mayor');
    await user.click(screen.getByRole('button', { name: 'Write' }));

    expect(draftAudio).toHaveBeenCalledWith('msel-1', {
      scenarioEventId: 'se-1',
      dataFieldId: 'df-body',
      deltaSeconds: 600,
      values: data.values,
      kind: AudioDraftKind.Broadcast,
      instruction: 'Quote the mayor',
    });
    expect(makeMedia).toHaveBeenCalledWith(VOICED, 'still');
    await vi.waitFor(() => expect(screen.getByText(/Waveform video, 0:42, AAC audio/)).toBeInTheDocument());
    expect(screen.getByText('Assumed the mayor is named Ito.')).toBeInTheDocument();
    expect(screen.getByText('Made in this browser.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy HTML' })).not.toBeInTheDocument();
    fixture.componentInstance.toPng = async (html: string) => html;
    await user.click(screen.getByRole('button', { name: 'Use this' }));

    await vi.waitFor(() =>
      expect(close).toHaveBeenCalledWith('<table title="Marking"><tr><td>EXERCISE</td></tr></table><h1>Storm</h1>' + CLIP.html + '<p>NWS expects landfall.</p>')
    );
  });

  /**
   * Verifies: Listen has no format choice, needs article text, and puts the player at the top, under the marking.
   * Interacts with: MselService.draftAudio, the media maker, dialogRef.close.
   * Data: a News article; Listen's bar comes back for the top.
   */
  it('adds Listen to this article at the top', async () => {
    const draftAudio = vi.fn(() => of<AudioDraftResult>({ ...VOICED, kind: AudioDraftKind.Listen }));
    const article = '<table title="Marking"><tr><td>EXERCISE</td></tr></table><p>NWS expects landfall.</p>';
    const { fixture, close } = await renderDraftDialog(article, undefined, { sourceType: 'News', availability: { available: true }, draftAudio });
    fixture.componentInstance.makeMedia = vi.fn(async () => ({ ...CLIP, html: '<table><tr><td>Listen</td></tr></table>', position: 'top' as const }));
    fixture.componentInstance.toPng = async (html: string) => html;
    const user = userEvent.setup();

    await chooseAction(user, "Add 'Listen to this article'");
    expect(screen.queryByRole('combobox', { name: 'Format' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Write' }));
    expect(fixture.componentInstance.makeMedia).toHaveBeenCalledWith(expect.anything(), 'audio');
    await user.click(await screen.findByRole('button', { name: 'Use this' }));

    await vi.waitFor(() =>
      expect(close).toHaveBeenCalledWith('<table title="Marking"><tr><td>EXERCISE</td></tr></table><table><tr><td>Listen</td></tr></table><p>NWS expects landfall.</p>')
    );
  });

  /**
   * Verifies: a reel made on a News inject says it belongs on a Social inject and offers its HTML to copy.
   * Interacts with: MselService.draftAudio, the media maker, navigator.clipboard.
   * Data: a News article; a reel comes back.
   */
  it('offers a reel made on a News inject to copy', async () => {
    const draftAudio = vi.fn(() => of<AudioDraftResult>({ ...VOICED, kind: AudioDraftKind.Reel }));
    const { fixture } = await renderDraftDialog('<p>Storm.</p>', undefined, { sourceType: 'News', availability: { available: true, scripts: true }, draftAudio });
    fixture.componentInstance.makeMedia = vi.fn(async () => ({ ...CLIP, format: 'reel' as const }));
    const user = userEvent.setup();
    // user-event puts its own clipboard on the navigator
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');

    await chooseAction(user, 'Make a news reel');
    expect(screen.queryByRole('combobox', { name: 'Format' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Write' }));
    await user.click(await screen.findByRole('button', { name: 'Copy HTML' }));

    expect(writeText).toHaveBeenCalledWith(CLIP.html);
    expect(screen.getByText(/A reel belongs on a Social inject/)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  /**
   * Verifies: the server's refusal, such as no speech provider, shows and leaves the options to try again.
   * Interacts with: MselService.draftAudio, getErrorMessage.
   * Data: a 400 whose title says to set Ai:Speech.
   */
  it('shows why a clip could not be made', async () => {
    const draftAudio = vi.fn(() => throwError(() => new HttpErrorResponse({ status: 400, error: { title: 'No speech provider is configured on this server.' } })));
    await renderDraftDialog('<p>Storm.</p>', undefined, { sourceType: 'Phone', availability: { available: true, scripts: true }, draftAudio });
    const user = userEvent.setup();

    await chooseAction(user, 'Make a voicemail');
    await user.click(screen.getByRole('button', { name: 'Write' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No speech provider is configured on this server.');
    expect(screen.getByRole('button', { name: 'Write' })).toBeEnabled();
  });
});
