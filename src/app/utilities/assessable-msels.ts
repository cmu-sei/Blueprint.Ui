// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Msel, MselItemStatus, MselRole } from 'src/app/generated/blueprint.api';

// The MSEL roles that can rate on the assessor view. Other roles can open it
// read-only, but the Assess list is for the events a user can actually assess.
export const ASSESS_ROLES: MselRole[] = [MselRole.Owner, MselRole.Evaluator];

// Whether the user can assess this MSEL: a system admin always can, anyone
// else needs one of the ASSESS_ROLES on it. A user can hold several roles on
// one MSEL, so every role is checked, not only the first.
export function canAssess(msel: Msel, userId: string, isSystemAdmin: boolean): boolean {
  if (msel.isTemplate) {
    return false;
  }
  if (isSystemAdmin) {
    return true;
  }
  return !!userId && (msel.userMselRoles ?? []).some(
    (r) => r.userId === userId && ASSESS_ROLES.includes(r.role as MselRole)
  );
}

// The MSELs to offer on the Assess list: those the user can assess that are
// running now. An event is only assessed while it is deployed.
export function assessableMsels(msels: Msel[], userId: string, isSystemAdmin: boolean): Msel[] {
  return (msels ?? []).filter(
    (m) => m.status === MselItemStatus.Deployed && canAssess(m, userId, isSystemAdmin)
  );
}
