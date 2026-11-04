// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { CrucibleDialogActionsDirective, CrucibleDialogComponent, CrucibleDialogContentDirective } from '@cmusei/crucible-common';
import { MselImageDataService } from 'src/app/data/msel/msel-image-data.service';

export interface MselImageDialogData {
  mselId: string;
  /** The current picture, or null for a MSEL without one */
  url: string | null;
  name: string;
  /** Whether the planner may ask for a new picture */
  canGenerate: boolean;
}

/** What the dialog answers: whether a new picture was kept */
export interface MselImageDialogResult {
  saved: boolean;
}

/**
 * The MSEL's card image at full size, since its preview on the Info tab is small, with a box for what the next picture
 * should show or change. A new picture is shown beside the current one, and saved only when the planner keeps it.
 */
@Component({
  selector: 'app-msel-image-dialog',
  templateUrl: './msel-image-dialog.component.html',
  styleUrls: ['./msel-image-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CrucibleDialogComponent,
    CrucibleDialogContentDirective,
    CrucibleDialogActionsDirective,
    MatButton,
    MatFormField,
    MatLabel,
    MatHint,
    MatInput,
    MatProgressSpinner,
    FormsModule,
  ],
})
export class MselImageDialogComponent {
  readonly data = inject<MselImageDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<MselImageDialogComponent, MselImageDialogResult>);
  private readonly images = inject(MselImageDataService);
  prompt = '';
  /** The new picture, as a data URI, until it is kept or discarded */
  readonly proposed = signal<string | null>(null);
  readonly busy = signal<'making' | 'saving' | null>(null);
  readonly error = signal('');

  // makes a new picture and shows it; nothing is saved yet
  generate() {
    this.busy.set('making');
    this.error.set('');
    this.images.previewImage(this.data.mselId, this.prompt.trim()).subscribe({
      next: (preview) => {
        this.busy.set(null);
        if (preview?.image) {
          this.proposed.set(preview.image);
        } else {
          this.error.set('The image model returned no picture. Try again.');
        }
      },
      error: (err) => {
        this.busy.set(null);
        this.error.set(errorText(err, 'The picture could not be made.'));
      },
    });
  }

  // keeps the new picture: saves it in place of the current one
  use() {
    const image = this.proposed();
    if (!image) {
      return;
    }
    this.busy.set('saving');
    this.error.set('');
    this.images.saveImage(this.data.mselId, image).subscribe({
      next: () => this.dialogRef.close({ saved: true }),
      error: (err) => {
        this.busy.set(null);
        this.error.set(errorText(err, 'The picture could not be saved.'));
      },
    });
  }

  // back to the current picture, keeping what was asked for so it can be changed and made again
  discard() {
    this.proposed.set(null);
    this.error.set('');
  }

  close() {
    this.dialogRef.close();
  }
}

function errorText(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse && err.status === 0) {
    return 'The API could not be reached.';
  }
  const title = (err as { error?: { title?: string } })?.error?.title;
  return title || fallback;
}
