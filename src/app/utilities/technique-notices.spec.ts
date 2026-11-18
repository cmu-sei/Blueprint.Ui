// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { describe, it, expect } from 'vitest';
import { TechniqueRelease } from 'src/app/generated/blueprint.api';
import { compareReleases, groupLabel, relationLabel, weaknessLink } from './technique-notices';

function release(over: Partial<TechniqueRelease>): TechniqueRelease {
  return { id: 'x', domain: 'd', version: '1', name: 'R', ...over };
}

describe('groupLabel', () => {
  it('is Tactics unless the release says otherwise', () => {
    expect(groupLabel(release({}))).toBe('Tactics');
    expect(groupLabel(null)).toBe('Tactics');
    expect(groupLabel(release({ groupLabel: 'Categories' }))).toBe('Categories');
  });
});

describe('compareReleases', () => {
  it('orders newest first, then by name, without naming a domain', () => {
    const older = release({ id: 'a', name: 'B', releaseDate: new Date('2025-01-01') });
    const newer = release({ id: 'b', name: 'C', releaseDate: new Date('2026-01-01') });
    const undated = release({ id: 'c', name: 'A' });

    expect([undated, older, newer].sort(compareReleases).map(r => r.id)).toEqual(['b', 'a', 'c']);
  });
});

describe('weaknessLink', () => {
  /**
   * Verifies: the weakness page comes from the framework's template, with {id} the number after the id's prefix
   * and {fullId} the whole id; without a template there is no link.
   * Interacts with: weaknessLink.
   * Data: a template of each kind, and none.
   */
  it('fills the framework\'s template, and gives no link without one', () => {
    expect(weaknessLink('https://weaknesses.example/{id}.html', 'CWE-89')).toBe('https://weaknesses.example/89.html');
    expect(weaknessLink('https://weaknesses.example/{fullId}', 'CWE-89')).toBe('https://weaknesses.example/CWE-89');
    expect(weaknessLink(null, 'CWE-89')).toBeNull();
    expect(weaknessLink('https://weaknesses.example/{id}', '')).toBeNull();
  });
});

describe('relationLabel', () => {
  it('capitalises the framework\'s relation, and says Mapped to without one', () => {
    expect(relationLabel('countered by')).toBe('Countered by');
    expect(relationLabel(null)).toBe('Mapped to');
  });
});
