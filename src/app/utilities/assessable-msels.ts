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
  if (!msel || msel.isTemplate) {
    return false;
  }
  return isSystemAdmin || holdsRole(msel, userId, ASSESS_ROLES);
}

// The MSEL roles that can open the assessor view, read-only unless they can also assess.
export const VIEW_ASSESSOR_ROLES: MselRole[] = [MselRole.Owner, MselRole.Editor, MselRole.Approver, MselRole.Evaluator];

// Whether the user can open this MSEL's assessor view: a system admin always can, anyone else
// needs one of the VIEW_ASSESSOR_ROLES on it.
export function canViewAssessor(msel: Msel, userId: string, isSystemAdmin: boolean): boolean {
  return !!msel && (isSystemAdmin || holdsRole(msel, userId, VIEW_ASSESSOR_ROLES));
}

// Every role the user holds on the MSEL counts. The MSEL's creator is its Owner: the API adds that
// role to the MSELs it answers, and this counts it even where a MSEL arrives without it.
function holdsRole(msel: Msel, userId: string, roles: MselRole[]): boolean {
  if (!userId) {
    return false;
  }
  if (msel.createdBy === userId && roles.includes(MselRole.Owner)) {
    return true;
  }
  return (msel.userMselRoles ?? []).some((r) => r.userId === userId && roles.includes(r.role as MselRole));
}

// The MSELs to offer on the Assess list: those the user can assess that are
// running now. An event is only assessed while it is deployed.
export function assessableMsels(msels: Msel[], userId: string, isSystemAdmin: boolean): Msel[] {
  return (msels ?? []).filter(
    (m) => m.status === MselItemStatus.Deployed && canAssess(m, userId, isSystemAdmin)
  );
}
