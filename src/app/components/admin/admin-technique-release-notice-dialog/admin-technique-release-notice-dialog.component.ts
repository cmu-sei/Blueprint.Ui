// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, inject, output } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { CrucibleDialogComponent, CrucibleDialogContentDirective } from '@cmusei/crucible-common';
import { MatFormField, MatLabel, MatInput, MatHint } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { TechniqueRelease, TechniqueReleaseNotice } from 'src/app/generated/blueprint.api';

/** Whether a link is blank or an http or https address, the only kind the API accepts and a page can safely link to. */
export function isWebAddress(url: string | null | undefined): boolean {
  const value = (url || '').trim();
  if (!value) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Edits the publisher and notice fields of a technique framework release: where it comes from, the notice its
 * publisher asks to be shown with its content, and the publisher's terms of use. A custom release starts with all four
 * empty and shows no notice until it is given one. Nothing else about a release can be edited.
 */
@Component({
  selector: 'app-admin-technique-release-notice-dialog',
  templateUrl: './admin-technique-release-notice-dialog.component.html',
  styleUrls: ['./admin-technique-release-notice-dialog.component.scss'],
  imports: [CrucibleDialogComponent, CrucibleDialogContentDirective, MatFormField, MatLabel, MatInput, MatHint, FormsModule]
})
export class AdminTechniqueReleaseNoticeDialogComponent {
  data = inject<{ release: TechniqueRelease; notice: TechniqueReleaseNotice }>(MAT_DIALOG_DATA);

  readonly editComplete = output<{ saveChanges: boolean; notice: TechniqueReleaseNotice | null }>();

  get release(): TechniqueRelease {
    return this.data.release;
  }

  get sourceUrlError(): boolean {
    return !isWebAddress(this.data.notice.sourceUrl);
  }

  get termsUrlError(): boolean {
    return !isWebAddress(this.data.notice.termsUrl);
  }

  errorFree(): boolean {
    return !this.sourceUrlError && !this.termsUrlError;
  }

  handleEditComplete(saveChanges: boolean): void {
    if (!saveChanges) {
      this.editComplete.emit({ saveChanges: false, notice: null });
    } else if (this.errorFree()) {
      this.editComplete.emit({ saveChanges: true, notice: this.data.notice });
    }
  }
}
