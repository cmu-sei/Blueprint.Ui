// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { MselPlus } from 'src/app/data/msel/msel-data.service';

// The API's rule for updating a MSEL itself (MselService.UpdateAsync, and the MSEL image): EditMsels,
// or the MSEL's Owner, which includes its creator. The MSEL's settings, its card image and the
// system rows of its Data Fields tab are all saved this way.
export function canUpdateMsel(msel: MselPlus | undefined, userId: string, hasEditMsels: boolean): boolean {
  return hasEditMsels || !!msel?.hasRole(userId, '').owner;
}
