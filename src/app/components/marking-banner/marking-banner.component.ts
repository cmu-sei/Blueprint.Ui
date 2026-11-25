// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MarkingBanner } from 'src/app/utilities/msel-marking';

/** A MSEL's marking as a bar, the same banner Blueprint puts on the MSEL's Gallery articles; nothing for none. */
@Component({
  selector: 'app-marking-banner',
  templateUrl: './marking-banner.component.html',
  styleUrls: ['./marking-banner.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarkingBannerComponent {
  readonly banner = input<MarkingBanner | null>(null);
}
