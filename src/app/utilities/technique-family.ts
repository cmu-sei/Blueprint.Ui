// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

/** The two halves of a MSEL's technique pool, each pinned to a release of its own. */
export type TechniqueFamily = 'attack' | 'defensive';

/** Anything the API flags as defensive or not: a release, or a technique carrying its release's flag. */
export interface HasFamily {
  isDefensive?: boolean | null;
}

/** Which family a release, or a technique of it, belongs to: defensive (MITRE D3FEND) when the API flags it so, else attack. */
export function techniqueFamily(item: HasFamily | null | undefined): TechniqueFamily {
  return item?.isDefensive ? 'defensive' : 'attack';
}
