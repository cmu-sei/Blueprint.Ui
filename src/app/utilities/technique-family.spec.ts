// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { techniqueFamily } from './technique-family';

describe('techniqueFamily', () => {
  /**
   * Verifies: the API's flag decides the family, not the domain: a defensive release of any domain is defensive,
   * and an unflagged one, or nothing at all, is attack.
   * Interacts with: techniqueFamily.
   * Data: d3fend flagged, another domain flagged, enterprise-attack unflagged, undefined.
   */
  it.each([
    { name: 'a flagged d3fend release', item: { domain: 'd3fend', isDefensive: true }, family: 'defensive' },
    { name: 'a flagged release of another domain', item: { domain: 'other-defend', isDefensive: true }, family: 'defensive' },
    { name: 'an unflagged ATT&CK release', item: { domain: 'enterprise-attack', isDefensive: false }, family: 'attack' },
    { name: 'a release without the flag', item: { domain: 'ATLAS' }, family: 'attack' },
    { name: 'nothing', item: undefined as { isDefensive?: boolean }, family: 'attack' },
  ])('puts $name in the $family family', ({ item, family }) => {
    expect(techniqueFamily(item)).toBe(family);
  });
});
