// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { TechniqueRelease } from 'src/app/generated/blueprint.api';

/** What a release calls its groups of techniques: tactics unless it says otherwise. */
export function groupLabel(release: TechniqueRelease | null | undefined): string {
  return release?.groupLabel || 'Tactics';
}

/** Releases newest first, then by name. */
export function compareReleases(a: TechniqueRelease, b: TechniqueRelease): number {
  const time = (r: TechniqueRelease) => (r.releaseDate ? new Date(r.releaseDate).getTime() : 0);
  return time(b) - time(a) || (a.name || '').localeCompare(b.name || '') || (b.version || '').localeCompare(a.version || '', undefined, { numeric: true });
}
