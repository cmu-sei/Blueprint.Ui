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

/**
 * A weakness's page from a framework's template: {fullId} is the weakness id as given and {id} the part after a
 * leading letters-and-hyphen prefix. Null when there is no template or no weakness.
 */
export function weaknessLink(template: string | null | undefined, weakness: string | null | undefined): string | null {
  const full = (weakness || '').trim();
  if (!template || !full) {
    return null;
  }
  const id = full.replace(/^[A-Za-z]+-/, '');
  return template.split('{fullId}').join(encodeURIComponent(full)).split('{id}').join(encodeURIComponent(id));
}

/** A framework's mapping relation as a heading: capitalised, "Mapped to" when it gives none. */
export function relationLabel(relation: string | null | undefined): string {
  const text = (relation || '').trim() || 'mapped to';
  return text.charAt(0).toUpperCase() + text.slice(1);
}
