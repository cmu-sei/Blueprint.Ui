// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { AttackTechniqueCountermeasure } from 'src/app/generated/blueprint.api';
import { D3FEND_TACTIC_ORDER, groupByTactic } from './countermeasure-tactics';

const cm = (externalId: string, tactic: string, weight: number): AttackTechniqueCountermeasure => ({
  id: `cm-${externalId}`,
  defensiveTactic: tactic,
  weight,
  defensiveTechnique: { id: `at-${externalId}`, externalId, name: externalId },
});

describe('groupByTactic', () => {
  /**
   * Verifies: the groups follow D3FEND's matrix order (Model, Harden, Detect, Isolate, Deceive, Evict, Restore)
   * whatever order the countermeasures arrive in, and a tactic the matrix does not name goes last.
   * Interacts with: groupByTactic, D3FEND_TACTIC_ORDER.
   * Data: one countermeasure per tactic, in reverse order, plus one of an unknown tactic.
   */
  it('orders the groups as the D3FEND matrix does', () => {
    const reversed = [...D3FEND_TACTIC_ORDER].reverse().map((t, i) => cm(`D3-${i}`, t, 1));

    const groups = groupByTactic([cm('D3-X', 'Analyze', 1), ...reversed]);

    expect(groups.map(g => g.tactic)).toEqual([...D3FEND_TACTIC_ORDER, 'Analyze']);
  });

  /**
   * Verifies: within a tactic the strongest countermeasure comes first, and equal weights fall back to the id so
   * the order is stable.
   * Interacts with: groupByTactic.
   * Data: three Harden countermeasures with weights 1, 3 and 1.
   */
  it('ranks a group by weight, then id', () => {
    const groups = groupByTactic([cm('D3-TB', 'Harden', 1), cm('D3-CH', 'Harden', 3), cm('D3-CBAN', 'Harden', 1)]);

    expect(groups).toHaveLength(1);
    expect(groups[0].countermeasures.map(c => c.defensiveTechnique.externalId)).toEqual(['D3-CH', 'D3-CBAN', 'D3-TB']);
  });

  /**
   * Verifies: nothing to group gives no groups, and a countermeasure without a tactic is filed under Other.
   * Interacts with: groupByTactic.
   * Data: undefined; one countermeasure with no tactic.
   */
  it('copes with nothing and with a missing tactic', () => {
    expect(groupByTactic(undefined)).toEqual([]);
    expect(groupByTactic([cm('D3-CH', undefined, 1)]).map(g => g.tactic)).toEqual(['Other']);
  });
});
