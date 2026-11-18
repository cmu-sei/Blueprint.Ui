// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { describe, it, expect } from 'vitest';
import { TechniqueRelease } from 'src/app/generated/blueprint.api';
import { compareReleases, groupLabel } from './technique-notices';

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
