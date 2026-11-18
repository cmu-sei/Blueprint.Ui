// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { TechniqueCountermeasure } from 'src/app/generated/blueprint.api';

/** The defensive tactics in the order the matrix shows them, which the "Countered by" groups follow. */
export const D3FEND_TACTIC_ORDER = ['Model', 'Harden', 'Detect', 'Isolate', 'Deceive', 'Evict', 'Restore'];

/** One defensive tactic's share of a technique's countermeasures, strongest first. */
export interface CountermeasureTacticGroup {
  tactic: string;
  countermeasures: TechniqueCountermeasure[];
}

/**
 * Groups countermeasures by defensive tactic in the matrix's order (an unnamed tactic goes last) and ranks
 * each group by weight, then by id.
 */
export function groupByTactic(countermeasures: TechniqueCountermeasure[] | null | undefined): CountermeasureTacticGroup[] {
  const groups = new Map<string, TechniqueCountermeasure[]>();
  for (const c of countermeasures || []) {
    const tactic = c.defensiveTactic || 'Other';
    if (!groups.has(tactic)) {
      groups.set(tactic, []);
    }
    groups.get(tactic).push(c);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => tacticRank(a) - tacticRank(b) || a.localeCompare(b))
    .map(([tactic, items]) => ({
      tactic,
      countermeasures: [...items].sort((a, b) =>
        (b.weight || 0) - (a.weight || 0) ||
        (a.defensiveTechnique?.externalId || '').localeCompare(b.defensiveTechnique?.externalId || '', undefined, { numeric: true })),
    }));
}

function tacticRank(tactic: string): number {
  const index = D3FEND_TACTIC_ORDER.indexOf(tactic);
  return index < 0 ? D3FEND_TACTIC_ORDER.length : index;
}
