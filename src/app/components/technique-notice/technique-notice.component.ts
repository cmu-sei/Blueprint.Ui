// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, computed, input } from '@angular/core';
import { TechniqueRelease } from 'src/app/generated/blueprint.api';
import { techniqueNotices } from 'src/app/utilities/technique-notices';

/**
 * The copyright and trademark notice, and the terms of use links, of the technique framework releases whose content
 * is on screen. Everything shown is what the releases themselves carry, so a release with no notice adds nothing and
 * nothing is shown when none of them has one.
 */
@Component({
  selector: 'app-technique-notice',
  template: `
    @let n = notices();
    @if (n.lines.length > 0 || n.terms.length > 0) {
    <div class="attribution">
      @for (line of n.lines; track line) {
      <span class="notice-line">{{ line }}</span>
      }
      @for (link of n.terms; track link.url) {
      <a [href]="link.url" target="_blank" rel="noopener">{{ link.label }}</a>
      }
    </div>
    }
  `,
  styles: [`
    .attribution {
      padding: 8px 16px;
      font-size: 12px;
      color: var(--mat-sys-on-surface-variant);
    }
    .notice-line {
      margin-right: 6px;
    }
    a {
      margin-left: 8px;
    }
  `]
})
export class TechniqueNoticeComponent {
  readonly releases = input<TechniqueRelease[]>([]);
  readonly notices = computed(() => techniqueNotices(this.releases()));
}
