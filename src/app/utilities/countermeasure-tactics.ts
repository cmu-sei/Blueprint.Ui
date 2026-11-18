// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { TechniqueCountermeasure } from 'src/app/generated/blueprint.api';

/** One tactic's share of a technique's mappings, strongest first. */
export interface CountermeasureTacticGroup {
  tactic: string;
  countermeasures: TechniqueCountermeasure[];
}

/**
 * Groups mappings by tactic in the order the release's framework gives (a tactic it does not list goes after,
 * alphabetically) and ranks each group by weight, then by id.
 */
export function groupByTactic(countermeasures: TechniqueCountermeasure[] | null | undefined, tacticOrder: string[] = []): CountermeasureTacticGroup[] {
  const order = tacticOrder || [];
  const tacticRank = (tactic: string): number => {
    const index = order.indexOf(tactic);
    return index < 0 ? order.length : index;
  };
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

