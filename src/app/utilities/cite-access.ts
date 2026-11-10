// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { HttpErrorResponse } from '@angular/common/http';
import { CrucibleDialogService } from '@cmusei/crucible-common';

// The problem type the API answers with when CITE, not Blueprint, refused the user (CiteAccessDeniedException).
export const CITE_ACCESS_DENIED = 'urn:crucible:blueprint:cite-access-denied';

export function isCiteAccessDenied(err: HttpErrorResponse | undefined): boolean {
  return err?.status === 403 && err?.error?.type === CITE_ACCESS_DENIED;
}

/**
 * Tells the user, in a dialog, that CITE would not let them read the scoring model they chose, with the API's reason.
 * Answers false for any other error, which the caller reports its own way.
 */
export function showCiteAccessDenied(dialogService: CrucibleDialogService, err: HttpErrorResponse | undefined): boolean {
  if (!isCiteAccessDenied(err)) {
    return false;
  }
  dialogService.confirm({
    title: 'CITE Access Denied',
    message: err.error.title || 'CITE does not let you view this scoring model.',
    confirmText: '',
    cancelText: 'OK',
  });
  return true;
}
