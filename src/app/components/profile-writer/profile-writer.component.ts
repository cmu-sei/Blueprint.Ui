// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, inject, input, output } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { take } from 'rxjs/operators';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MselDataService } from 'src/app/data/msel/msel-data.service';
import { ProfileDraftResult } from 'src/app/generated/blueprint.api';
import { svgImagesToPng } from 'src/app/utilities/svg-to-png';

/**
 * Write with AI for a team's or organization's description: the planner adds an instruction if they want one, reviews
 * the profile as it will look, and uses it or not. Nothing is saved here; the dialog saves what is used.
 */
@Component({
  selector: 'app-profile-writer',
  templateUrl: './profile-writer.component.html',
  styleUrls: ['./profile-writer.component.scss'],
  imports: [FormsModule, MatButton, MatIconButton, MatFormField, MatLabel, MatIcon, MatInput, MatProgressSpinner],
})
export class ProfileWriterComponent {
  private mselDataService = inject(MselDataService);

  readonly kind = input.required<'team' | 'organization'>();
  readonly mselId = input.required<string>();
  readonly shortName = input<string>('');
  readonly name = input<string>('');
  readonly summary = input<string>('');
  readonly description = input<string>('');
  /** The profile the planner chose to use, with its logo as PNG */
  readonly useProfile = output<string>();

  isOpen = false;
  isWriting = false;
  instruction = '';
  result: ProfileDraftResult;
  errorMessage = '';
  // drawn on a canvas in the browser; tests give their own
  toPng = svgImagesToPng;

  open() {
    this.isOpen = true;
    this.result = undefined;
    this.errorMessage = '';
  }

  write() {
    this.isWriting = true;
    this.errorMessage = '';
    this.mselDataService
      .draftProfile({
        mselId: this.mselId(),
        kind: this.kind(),
        shortName: this.shortName(),
        name: this.name(),
        summary: this.summary(),
        description: this.description(),
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

  async use() {
    this.useProfile.emit(await this.toPng(this.result.html));
    this.close();
  }

  close() {
    this.isOpen = false;
    this.result = undefined;
  }

  private getErrorMessage(err: any): string {
    if (err instanceof HttpErrorResponse && err.status === 0) {
      return 'The API could not be reached.';
    }
    const title = err?.error?.title;
    const detail = err?.error?.detail;
    if (title) {
      return detail ? `${title} ${detail}` : title;
    }
    return err?.message || 'The profile could not be written.';
  }
}
