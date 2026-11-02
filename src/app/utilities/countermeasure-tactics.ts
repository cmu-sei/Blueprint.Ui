// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { AttackTechniqueCountermeasure } from 'src/app/generated/blueprint.api';

/** MITRE D3FEND's tactics in the order its matrix shows them, which the "Countered by" groups follow. */
export const D3FEND_TACTIC_ORDER = ['Model', 'Harden', 'Detect', 'Isolate', 'Deceive', 'Evict', 'Restore'];

/** One D3FEND tactic's share of a technique's countermeasures, strongest first. */
export interface CountermeasureTacticGroup {
  tactic: string;
  countermeasures: AttackTechniqueCountermeasure[];
}

/**
 * Groups countermeasures by their D3FEND tactic in the matrix's order (a tactic the matrix does not name goes
 * last, alphabetically) and ranks each group by weight, then by id so equals keep a stable order.
 */
export function groupByTactic(countermeasures: AttackTechniqueCountermeasure[] | null | undefined): CountermeasureTacticGroup[] {
  const groups = new Map<string, AttackTechniqueCountermeasure[]>();
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
