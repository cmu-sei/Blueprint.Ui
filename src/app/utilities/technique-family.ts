// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

/** The domain the API gives a MITRE D3FEND release; every other domain (enterprise-attack, ATLAS, ...) is an attack framework. */
export const D3FEND_DOMAIN = 'd3fend';

/** The two halves of a MSEL's technique pool, each pinned to a release of its own. */
export type TechniqueFamily = 'attack' | 'defensive';

/** Which family a release, or a technique of it, belongs to by the release's domain. */
export function techniqueFamily(domain: string | null | undefined): TechniqueFamily {
  return domain === D3FEND_DOMAIN ? 'defensive' : 'attack';
}
