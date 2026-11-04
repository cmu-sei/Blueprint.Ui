// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Msel, MselItemStatus, MselRole } from 'src/app/generated/blueprint.api';
import { MselPlus } from 'src/app/data/msel/msel-data.service';

// The API's rule for updating a MSEL itself (MselService.UpdateAsync, and the MSEL image): EditMsels,
// or the MSEL's Owner, which includes its creator. The MSEL's settings, its card image and the
// system rows of its Data Fields tab are all saved this way.
export function canUpdateMsel(msel: MselPlus | undefined, userId: string, hasEditMsels: boolean): boolean {
  return hasEditMsels || !!msel?.hasRole(userId, '').owner;
}

// The API's rule for a MSEL's CITE scoring model, linked or authored (MselScoringModelService), as for its CITE
// actions and duties: EditMsels, or the MSEL's Owner or Editor. hasRole's editor also counts an Approver, which
// the API's MselEditorRequirement does not, so the Editor role is looked for itself.
export function canEditScoringModel(msel: MselPlus | undefined, userId: string, hasEditMsels: boolean): boolean {
  const isEditor = !!msel?.userMselRoles?.some((umr) => umr.userId === userId && umr.role === MselRole.Editor);
  return hasEditMsels || !!msel?.hasRole(userId, '').owner || isEditor;
}

// Pushing, Pulling and Deployed are set only by pushing and pulling integrations.
const PIPELINE_STATUSES: MselItemStatus[] = [MselItemStatus.Pushing, MselItemStatus.Pulling, MselItemStatus.Deployed];

export function isPipelineStatus(msel: Msel | undefined): boolean {
  return PIPELINE_STATUSES.includes(msel?.status);
}

// The integrations were built from the MSEL's settings, so they stay as they are until Remove Integrations.
export function integrationsLocked(msel: Msel | undefined): boolean {
  return isPipelineStatus(msel) || !!(msel?.playerViewId || msel?.galleryCollectionId || msel?.galleryExhibitId ||
    msel?.citeEvaluationId || msel?.steamfitterScenarioId || msel?.casterWorkspaceId);
}
