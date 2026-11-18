// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, inject, output } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { CrucibleDialogComponent, CrucibleDialogContentDirective } from '@cmusei/crucible-common';
import { MatFormField, MatLabel, MatInput, MatHint } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MatSelect, MatOption } from '@angular/material/select';
import { TechniqueFramework, TechniqueRelease, TechniqueReleaseNotice } from 'src/app/generated/blueprint.api';

/** Whether a link is blank or an http or https address, the only kind the API accepts. */
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
 * Edits a release's framework, source, source URL, notice and terms URL. A release with nothing from its file
 * starts with the notice fields empty.
 */
@Component({
  selector: 'app-admin-technique-release-notice-dialog',
  templateUrl: './admin-technique-release-notice-dialog.component.html',
  styleUrls: ['./admin-technique-release-notice-dialog.component.scss'],
  imports: [CrucibleDialogComponent, CrucibleDialogContentDirective, MatFormField, MatLabel, MatInput, MatHint, MatSelect, MatOption, FormsModule]
})
export class AdminTechniqueReleaseNoticeDialogComponent {
  data = inject<{ release: TechniqueRelease; notice: TechniqueReleaseNotice; frameworks?: TechniqueFramework[] }>(MAT_DIALOG_DATA);

  readonly editComplete = output<{ saveChanges: boolean; notice: TechniqueReleaseNotice | null }>();

  get release(): TechniqueRelease {
    return this.data.release;
  }

  /** The frameworks the release may belong to: those of its domain and family. */
  get frameworks(): TechniqueFramework[] {
    return (this.data.frameworks || []).filter(f => f.domain === this.release.domain && !!f.isDefensive === !!this.release.isDefensive);
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
