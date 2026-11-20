// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

/** The two halves of a MSEL's technique pool. */
export type TechniqueFamily = 'attack' | 'defensive';

/** Anything the API flags as defensive or not: a release, or a technique with its release's flag. */
export interface HasFamily {
  isDefensive?: boolean | null;
}

/** The family of a release or technique: defensive when flagged so, else attack. */
export function techniqueFamily(
  item: HasFamily | null | undefined,
): TechniqueFamily {
  return item?.isDefensive ? 'defensive' : 'attack';
}
