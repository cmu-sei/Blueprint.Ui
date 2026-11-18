// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, computed, inject, input } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { TechniqueRelease } from 'src/app/generated/blueprint.api';
import { TechniqueNoticeDialogComponent } from './technique-notice-dialog.component';

/** Whether a release has anything to show in its Copyright & terms dialog: a notice, a terms link or a source link. */
export function hasTechniqueNotice(release: TechniqueRelease | null | undefined): boolean {
  return !!(release && (release.notice?.trim() || release.termsUrl?.trim() || release.sourceUrl?.trim()));
}

/**
 * A "Copyright & terms" link under a technique framework release. It opens the release's own notice, terms and source
 * in a dialog, built from what the release carries and nothing else, so a release with none shows no link.
 */
@Component({
  selector: 'app-technique-notice',
  template: `
    @if (visible()) {
    <button type="button" class="notice-link" (click)="open()">Copyright &amp; terms</button>
    }
  `,
  styles: [`
    .notice-link {
      background: none;
      border: 0;
      padding: 4px 0;
      font: inherit;
      font-size: 12px;
      color: var(--mat-sys-primary);
      text-decoration: underline;
      cursor: pointer;
    }
  `]
})
export class TechniqueNoticeComponent {
  private dialog = inject(MatDialog);
  readonly release = input<TechniqueRelease | null | undefined>(null);
  readonly visible = computed(() => hasTechniqueNotice(this.release()));

  open() {
    this.dialog.open(TechniqueNoticeDialogComponent, {
      minWidth: '400px',
      maxWidth: '90vw',
      width: '640px',
      data: { release: this.release() },
    });
  }
}
