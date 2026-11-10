// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Msel } from 'src/app/generated/blueprint.api';

// The background for an event card with no image of its own: a pattern
// generated from the MSEL id, so the same event always looks the same.
export function cardImage(msel: Msel): string {
  let hash = 0;
  for (const c of msel.id ?? msel.name ?? '') {
    hash = (hash * 31 + c.charCodeAt(0)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  const angle = 30 + (Math.abs(hash >> 8) % 4) * 30;
  return `repeating-linear-gradient(${angle}deg, rgba(255, 255, 255, 0.08) 0 12px, transparent 12px 24px), ` +
    `linear-gradient(135deg, hsl(${hue}, 55%, 42%), hsl(${(hue + 40) % 360}, 60%, 30%))`;
}
