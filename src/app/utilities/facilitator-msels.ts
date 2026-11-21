// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  Msel,
  MselItemStatus,
  MselRole,
} from 'src/app/generated/blueprint.api';
import { holdsRole } from './assessable-msels';

// The MSEL roles that run a deployed MSEL on the Facilitator View: start moves and groups, run,
// rerun and cancel its automation tasks, and pause its automation.
export const FACILITATE_ROLES: MselRole[] = [
  MselRole.Owner,
  MselRole.Facilitator,
];

// The MSEL roles that can open the Facilitator View and read its runs, read-only unless they can
// also facilitate. Evaluators have the Assessor View instead.
export const VIEW_FACILITATOR_ROLES: MselRole[] = [
  MselRole.Owner,
  MselRole.Facilitator,
  MselRole.Editor,
  MselRole.Approver,
];

// Whether the user can act on this MSEL's Facilitator View: anyone with the system EditMsels
// permission can, anyone else needs one of the FACILITATE_ROLES on it. A template is never run.
export function canFacilitate(
  msel: Msel,
  userId: string,
  canEditAllMsels: boolean,
): boolean {
  if (!msel || msel.isTemplate) {
    return false;
  }
  return canEditAllMsels || holdsRole(msel, userId, FACILITATE_ROLES);
}

// Whether the user can open this MSEL's Facilitator View and read its runs: anyone with the
// system ViewMsels permission can, anyone else needs one of the VIEW_FACILITATOR_ROLES on it.
export function canViewFacilitator(
  msel: Msel,
  userId: string,
  canViewAllMsels: boolean,
): boolean {
  return (
    !!msel &&
    (canViewAllMsels || holdsRole(msel, userId, VIEW_FACILITATOR_ROLES))
  );
}

// The MSELs to offer on the Facilitate list: those running now whose Facilitator View the user
// can open.
export function facilitatableMsels(
  msels: Msel[],
  userId: string,
  canViewAllMsels: boolean,
): Msel[] {
  return (msels ?? []).filter(
    (m) =>
      m.status === MselItemStatus.Deployed &&
      canViewFacilitator(m, userId, canViewAllMsels),
  );
}
