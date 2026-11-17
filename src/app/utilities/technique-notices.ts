// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { TechniqueRelease } from 'src/app/generated/blueprint.api';

/** A link to a publisher's terms of use, labelled with the publisher it belongs to. */
export interface TechniqueTermsLink {
  label: string;
  url: string;
}

/** What to show under technique content: the notice lines of its releases and the terms links they carry. */
export interface TechniqueNotices {
  lines: string[];
  terms: TechniqueTermsLink[];
}

/**
 * The notice the given releases ask to be shown, built from the releases' own fields and nothing else. A release
 * carries its notice as lines (a copyright line, then a trademark line); a line that several releases share is shown
 * once, and each distinct terms address is listed once. A release without a notice or terms adds nothing, so
 * content that is not MITRE's never shows MITRE's notice.
 */
export function techniqueNotices(releases: (TechniqueRelease | null | undefined)[]): TechniqueNotices {
  const lines: string[] = [];
  const terms: TechniqueTermsLink[] = [];
  for (const release of releases) {
    if (!release) continue;
    for (const line of (release.notice || '').split('\n').map(l => l.trim()).filter(l => l)) {
      if (!lines.includes(line)) lines.push(line);
    }
    const url = (release.termsUrl || '').trim();
    if (url && !terms.some(t => t.url === url)) {
      terms.push({ label: release.source ? `${release.source} Terms of Use` : 'Terms of Use', url });
    }
  }
  return { lines, terms };
}

/** What a release calls the groups its techniques sit in: tactics unless it says otherwise. */
export function groupLabel(release: TechniqueRelease | null | undefined): string {
  return release?.groupLabel || 'Tactics';
}

/** Releases newest first, then by name: a neutral order for a release picker that names no domain. */
export function compareReleases(a: TechniqueRelease, b: TechniqueRelease): number {
  const time = (r: TechniqueRelease) => (r.releaseDate ? new Date(r.releaseDate).getTime() : 0);
  return time(b) - time(a) || (a.name || '').localeCompare(b.name || '') || (b.version || '').localeCompare(a.version || '', undefined, { numeric: true });
}
