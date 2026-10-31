// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { techniqueFamily } from './technique-family';

describe('techniqueFamily', () => {
  /**
   * Verifies: only the d3fend domain is the defensive family; ATT&CK's domains, ATLAS and an unknown domain are attack.
   * Interacts with: techniqueFamily.
   * Data: d3fend, enterprise-attack, ATLAS, undefined.
   */
  it.each([
    { domain: 'd3fend', family: 'defensive' },
    { domain: 'enterprise-attack', family: 'attack' },
    { domain: 'ATLAS', family: 'attack' },
    { domain: undefined as string, family: 'attack' },
  ])('puts $domain in the $family family', ({ domain, family }) => {
    expect(techniqueFamily(domain)).toBe(family);
  });
});
