// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  CrucibleDialogActionsDirective,
  CrucibleDialogComponent,
  CrucibleDialogContentDirective,
} from '@cmusei/crucible-common';
import { TechniqueRelease } from 'src/app/generated/blueprint.api';
import { isWebAddress } from '../admin/admin-technique-release-notice-dialog/admin-technique-release-notice-dialog.component';

/**
 * The copyright, trademark and terms of a technique framework release, read only. Everything shown is what the release
 * carries: its source, its notice with the line breaks it was given, and the links it names.
 */
@Component({
  selector: 'app-technique-notice-dialog',
  templateUrl: './technique-notice-dialog.component.html',
  styleUrls: ['./technique-notice-dialog.component.scss'],
  imports: [
    CrucibleDialogComponent,
    CrucibleDialogContentDirective,
    CrucibleDialogActionsDirective,
    MatButton,
  ],
})
export class TechniqueNoticeDialogComponent {
  private dialogRef =
    inject<MatDialogRef<TechniqueNoticeDialogComponent>>(MatDialogRef);
  data = inject<{ release: TechniqueRelease }>(MAT_DIALOG_DATA);

  get release(): TechniqueRelease {
    return this.data.release;
  }

  /** The notice, or nothing when the release has none. */
  get notice(): string {
    return (this.release.notice || '').trim();
  }

  /** A link only when it is an http or https address, the only kind a page can safely open. */
  get termsUrl(): string | null {
    return this.safeUrl(this.release.termsUrl);
  }

  get sourceUrl(): string | null {
    return this.safeUrl(this.release.sourceUrl);
  }

  get termsLabel(): string {
    return this.release.source
      ? `${this.release.source} Terms of Use`
      : 'Terms of Use';
  }

  close() {
    this.dialogRef.close();
  }

  private safeUrl(url: string | null | undefined): string | null {
    const value = (url || '').trim();
    return value && isWebAddress(value) ? value : null;
  }
}
