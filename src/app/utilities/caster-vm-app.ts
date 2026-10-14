/*
 Copyright 2026 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { Msel, PlayerApplication } from 'src/app/generated/blueprint.api';

// Informational only: Push stays enabled, since the VMs may be reached some other way.
// Blueprint creates no Player application on its own, so without one the VMs are deployed
// but nobody can open them from Player. Empty until Caster is fully set up (Use Player on,
// a directory chosen), since the MSEL Info tab already warns about those.
export function casterVmAppWarning(msel: Msel, playerApplications: PlayerApplication[], vmUrl: string): string {
  if (!msel?.useCaster || !msel.usePlayer || !msel.casterDirectoryId) return '';
  const baseUrl = (vmUrl || '').replace(/\/+$/, '');
  const hasVmApp = (playerApplications || [])
    .filter(a => a.mselId === msel.id)
    .some(a => a.url?.includes('{vmUrl}') || (baseUrl && a.url?.startsWith(baseUrl)));
  return hasVmApp
    ? ''
    : 'No Player application opens the VM UI, so participants will not be able to reach the Caster VMs. Add one using {vmUrl}, for example {vmUrl}/views/{playerViewId}.';
}
