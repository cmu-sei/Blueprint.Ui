// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { TechniqueCountermeasure } from 'src/app/generated/blueprint.api';
import { groupByTactic } from './countermeasure-tactics';

// a framework's tactic order, as its definition gives it (test data)
const ORDER = [
  'Model',
  'Harden',
  'Detect',
  'Isolate',
  'Deceive',
  'Evict',
  'Restore',
];

const cm = (
  externalId: string,
  tactic: string,
  weight: number,
): TechniqueCountermeasure => ({
  id: `cm-${externalId}`,
  defensiveTactic: tactic,
  weight,
  defensiveTechnique: { id: `at-${externalId}`, externalId, name: externalId },
});

describe('groupByTactic', () => {
  /**
   * Verifies: the groups follow the tactic order the framework gives, whatever order the mappings arrive in, and
   * a tactic the order does not name goes last.
   * Interacts with: groupByTactic.
   * Data: one mapping per tactic, in reverse order, plus one of an unknown tactic.
   */
  it("orders the groups as the framework's tactic order does", () => {
    const reversed = [...ORDER].reverse().map((t, i) => cm(`D3-${i}`, t, 1));

    const groups = groupByTactic(
      [cm('D3-X', 'Analyze', 1), ...reversed],
      ORDER,
    );

    expect(groups.map((g) => g.tactic)).toEqual([...ORDER, 'Analyze']);
  });

  /**
   * Verifies: with no order from the framework the groups are alphabetical; the code knows no tactic names.
   * Interacts with: groupByTactic.
   * Data: three tactics, out of order, and no tactic order.
   */
  it('orders the groups alphabetically when the framework gives no order', () => {
    const groups = groupByTactic([
      cm('A', 'Model', 1),
      cm('B', 'Detect', 1),
      cm('C', 'Harden', 1),
    ]);

    expect(groups.map((g) => g.tactic)).toEqual(['Detect', 'Harden', 'Model']);
  });

  /**
   * Verifies: within a tactic the strongest countermeasure comes first, and equal weights fall back to the id so
   * the order is stable.
   * Interacts with: groupByTactic.
   * Data: three Harden countermeasures with weights 1, 3 and 1.
   */
  it('ranks a group by weight, then id', () => {
    const groups = groupByTactic([
      cm('D3-TB', 'Harden', 1),
      cm('D3-CH', 'Harden', 3),
      cm('D3-CBAN', 'Harden', 1),
    ]);

    expect(groups).toHaveLength(1);
    expect(
      groups[0].countermeasures.map((c) => c.defensiveTechnique.externalId),
    ).toEqual(['D3-CH', 'D3-CBAN', 'D3-TB']);
  });

  /**
   * Verifies: nothing to group gives no groups, and a countermeasure without a tactic is filed under Other.
   * Interacts with: groupByTactic.
   * Data: undefined; one countermeasure with no tactic.
   */
  it('copes with nothing and with a missing tactic', () => {
    expect(groupByTactic(undefined)).toEqual([]);
    expect(
      groupByTactic([cm('D3-CH', undefined, 1)]).map((g) => g.tactic),
    ).toEqual(['Other']);
  });
});
