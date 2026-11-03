// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, Inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';
import { prepareImages } from 'src/app/utilities/svg-to-png';
import { ClipFormat, insertMedia, makeMedia, MediaClip } from 'src/app/utilities/media-clip';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatOption, MatSelect } from '@angular/material/select';
import {
  CrucibleDialogActionsDirective,
  CrucibleDialogComponent,
  CrucibleDialogContentDirective,
} from '@cmusei/crucible-common';
import { FitWidthDirective } from './fit-width.directive';
import { MselDataService } from 'src/app/data/msel/msel-data.service';
import {
  AudioDraftAvailability,
  AudioDraftKind,
  AudioDraftResult,
  DataField,
  DataFieldType,
  DataValueDraftAction,
  DataValueDraftResult,
} from 'src/app/generated/blueprint.api';

export interface DataValueDraftDialogData {
  mselId: string;
  scenarioEventId?: string;
  deltaSeconds: number;
  dataField: DataField;
  // the inject's values as the edit dialog holds them, unsaved edits included
  values: { [dataFieldId: string]: string };
  gallerySourceTypes: string[];
  // the inject's Gallery source type, which decides the audio and video it may have
  sourceType?: string;
}

interface WhatToDo {
  value: string;
  label: string;
  needsValue: boolean;
  // a clip the browser makes from voiced lines, rather than text
  audio?: AudioDraftKind;
}

// a clip voiced, made into media, and put into the field
interface AudioDraft {
  result: AudioDraftResult;
  clip: MediaClip;
  value: string;
  notes: string[];
}

const AUDIO = 'audio:';

// Writing saves nothing. Closing with a string hands the accepted value back
// to the edit dialog, where the planner can still edit it or cancel the inject.
@Component({
  selector: 'app-data-value-draft-dialog',
  templateUrl: './data-value-draft-dialog.component.html',
  styleUrls: ['./data-value-draft-dialog.component.scss'],
  imports: [
    CrucibleDialogComponent,
    CrucibleDialogContentDirective,
    CrucibleDialogActionsDirective,
    FitWidthDirective,
    FormsModule,
    MatButton,
    MatFormField,
    MatHint,
    MatLabel,
    MatIcon,
    MatInput,
    MatOption,
    MatSelect,
    MatProgressSpinner,
  ],
})
export class DataValueDraftDialogComponent {
  actions: WhatToDo[] = [
    { value: DataValueDraftAction.Draft, label: 'Draft from this inject', needsValue: false },
    { value: DataValueDraftAction.Rewrite, label: 'Rewrite as...', needsValue: true },
    { value: DataValueDraftAction.Consistent, label: 'Make consistent with the scenario', needsValue: true },
    { value: DataValueDraftAction.Shorten, label: 'Shorten', needsValue: true },
    { value: DataValueDraftAction.Expand, label: 'Expand', needsValue: true },
  ];
  readonly formats: { value: ClipFormat; label: string }[] = [
    { value: 'audio', label: 'Audio only' },
    { value: 'still', label: 'Still card video' },
    { value: 'waveform', label: 'Waveform video' },
  ];
  action: string;
  format: ClipFormat = 'waveform';
  style = '';
  instruction = '';
  isWriting = false;
  progress = '';
  errorMessage = '';
  result: DataValueDraftResult;
  audio: AudioDraft;
  copied = false;
  readonly currentValue: string;
  readonly hasValue: boolean;

  constructor(
    public dialogRef: MatDialogRef<DataValueDraftDialogComponent, string>,
    @Inject(MAT_DIALOG_DATA) public data: DataValueDraftDialogData,
    private mselDataService: MselDataService
  ) {
    dialogRef.disableClose = true;
    this.currentValue = data.values[data.dataField.id] ?? '';
    this.hasValue = this.currentValue.replace(/<[^>]*>/g, '').trim().length > 0;
    this.action = this.hasValue ? DataValueDraftAction.Rewrite : DataValueDraftAction.Draft;
    this.style = data.gallerySourceTypes?.[0] ?? '';
    if (data.dataField.dataType === DataFieldType.Html) {
      this.mselDataService
        .getAudioDraftAvailability(data.mselId)
        .pipe(take(1))
        .subscribe({
          next: (availability) => this.addAudioActions(availability),
          // without it the dialog writes text, as it always has
          error: () => undefined,
        });
    }
  }

  // the audio and video an inject of its source type may have, where the server has a speech provider
  private addAudioActions(availability: AudioDraftAvailability) {
    if (!availability?.available) {
      return;
    }
    const type = (this.data.sourceType ?? '').toLowerCase();
    const add = (kind: AudioDraftKind, label: string, needsValue: boolean) => this.actions.push({ value: AUDIO + kind, label, needsValue, audio: kind });
    add(AudioDraftKind.Listen, "Add 'Listen to this article'", true);
    if (availability.scripts) {
      if (type === 'phone') {
        add(AudioDraftKind.Voicemail, 'Make a voicemail', false);
      }
      if (type === 'intel') {
        add(AudioDraftKind.Call, 'Make an intercepted call', false);
      }
      if (type === 'news') {
        add(AudioDraftKind.Broadcast, 'Make a news broadcast clip', false);
      }
      if (type === 'news' || type === 'social') {
        add(AudioDraftKind.Reel, 'Make a news reel', false);
      }
    }
    this.actions = [...this.actions];
  }

  get isRewrite(): boolean {
    return this.action === DataValueDraftAction.Rewrite;
  }

  get audioKind(): AudioDraftKind | undefined {
    return this.actions.find((a) => a.value === this.action)?.audio;
  }

  // a voicemail, call or broadcast can be audio or a video; Listen is audio and a reel is video
  get hasFormat(): boolean {
    const kind = this.audioKind;
    return kind === AudioDraftKind.Voicemail || kind === AudioDraftKind.Call || kind === AudioDraftKind.Broadcast;
  }

  get isReel(): boolean {
    return this.audio?.result.kind === AudioDraftKind.Reel;
  }

  get canWrite(): boolean {
    const action = this.actions.find((a) => a.value === this.action);
    return !this.isWriting && (this.hasValue || !action?.needsValue);
  }

  write() {
    if (this.audioKind) {
      this.writeAudio(this.audioKind);
      return;
    }
    this.isWriting = true;
    this.errorMessage = '';
    this.mselDataService
      .draftDataValue(this.data.mselId, {
        scenarioEventId: this.data.scenarioEventId,
        dataFieldId: this.data.dataField.id,
        deltaSeconds: this.data.deltaSeconds,
        values: this.data.values,
        action: this.action as DataValueDraftAction,
        style: this.isRewrite ? this.style : null,
        instruction: this.instruction,
      })
      .pipe(take(1))
      .subscribe({
        next: (result) => {
          this.result = result;
          this.isWriting = false;
        },
        error: (err) => {
          this.errorMessage = this.getErrorMessage(err);
          this.isWriting = false;
        },
      });
  }

  // the API writes and voices the lines; the browser makes them into audio or video and puts it into the field
  async writeAudio(kind: AudioDraftKind) {
    this.isWriting = true;
    this.errorMessage = '';
    this.progress = kind === AudioDraftKind.Listen ? 'Reading the article aloud.' : 'Writing and voicing the script. This can take a minute.';
    try {
      const result = await firstValueFrom(
        this.mselDataService.draftAudio(this.data.mselId, {
          scenarioEventId: this.data.scenarioEventId,
          dataFieldId: this.data.dataField.id,
          deltaSeconds: this.data.deltaSeconds,
          values: this.data.values,
          kind,
          instruction: this.instruction,
        })
      );
      this.progress = kind === AudioDraftKind.Listen ? 'Adding the player.' : 'Making the clip in your browser.';
      const clip = await this.makeMedia(result, this.hasFormat ? this.format : 'audio');
      this.audio = {
        result,
        clip,
        value: insertMedia(this.currentValue, clip.html, clip.position),
        notes: [...(result.notes ?? []), ...clip.notes],
      };
    } catch (err) {
      this.errorMessage = this.getErrorMessage(err);
    } finally {
      this.isWriting = false;
      this.progress = '';
    }
  }

  // the clip's length and what it was made as, for the planner to check before using it
  get audioSummary(): string {
    const clip = this.audio?.clip;
    if (!clip) {
      return '';
    }
    const made = { audio: 'Audio', still: 'Still card video', waveform: 'Waveform video', reel: 'Vertical news reel' }[clip.format];
    const seconds = Math.round(clip.seconds);
    return `${made}, ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}, ${clip.codec.toUpperCase()} audio`;
  }

  // a reel is a Social inject's; on a News inject it is copied to paste into one
  async copyHtml() {
    await navigator.clipboard?.writeText(this.audio.clip.html);
    this.copied = true;
  }

  // back to the options, keeping them so the planner can adjust and write again
  tryAgain() {
    this.result = undefined;
    this.audio = undefined;
    this.copied = false;
  }

  // drawn on a canvas in the browser; tests give their own
  toPng = prepareImages;

  // encoded in the browser; tests give their own
  makeMedia = (result: AudioDraftResult, format: ClipFormat) => makeMedia(result, format);

  // an article's SVG graphics become PNG, which Blueprint's own views show
  async use() {
    this.dialogRef.close(await this.toPng(this.audio ? this.audio.value : this.result.value));
  }

  close() {
    this.dialogRef.close();
  }

  private getErrorMessage(err: any): string {
    if (!(err instanceof HttpErrorResponse) && err instanceof Error) {
      return err.message || 'Making the clip failed.';
    }
    if (err instanceof HttpErrorResponse && err.status === 0) {
      return 'The API could not be reached.';
    }
    const title = err?.error?.title;
    const detail = err?.error?.detail;
    // a server error carries the reason in detail outside development, and a stack trace inside it
    if (err?.status === 500 && detail && !detail.includes('\n')) {
      return detail;
    }
    return title || err?.message || 'Writing failed.';
  }
}
