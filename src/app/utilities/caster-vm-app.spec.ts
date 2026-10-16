// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { Msel, PlayerApplication } from 'src/app/generated/blueprint.api';
import { casterVmAppWarning } from './caster-vm-app';

const WARNING =
  'No Player application opens the VM UI, so participants will not be able to reach the Caster VMs. Add one using {vmUrl}, for example {vmUrl}/views/{playerViewId}.';
const VM_URL = 'http://vm.example';
const READY: Msel = { id: 'msel-1', name: 'Exercise Alpha', useCaster: true, usePlayer: true, casterDirectoryId: 'dir-1' };
const app = (url: string, mselId = 'msel-1'): PlayerApplication => ({ id: `app-${url}`, mselId, name: 'App', url });

describe('casterVmAppWarning', () => {
  /**
   * Verifies: no warning until Caster is fully set up: a MSEL that does not use Caster, uses Caster without Player, or has no directory chosen.
   * Interacts with: casterVmAppWarning.
   * Data: no MSEL; READY with useCaster false, usePlayer false or no casterDirectoryId; no applications.
   */
  it.each([
    { label: 'without a MSEL', msel: undefined as Msel },
    { label: 'when Caster is not used', msel: { ...READY, useCaster: false } },
    { label: 'when Player is not used', msel: { ...READY, usePlayer: false } },
    { label: 'without a Caster directory', msel: { ...READY, casterDirectoryId: null } },
  ])('gives no warning $label', ({ msel }) => {
    expect(casterVmAppWarning(msel, [], VM_URL)).toBe('');
  });

  /**
   * Verifies: a Caster-ready MSEL with no application that opens the VM UI gets the warning.
   * Interacts with: casterVmAppWarning.
   * Data: READY with no applications, a null list, an application without a URL, one on another site, and a {vmUrl} application of another MSEL.
   */
  it.each([
    { label: 'no applications', apps: [] as PlayerApplication[] },
    { label: 'a null application list', apps: null as PlayerApplication[] },
    { label: 'an application without a URL', apps: [{ id: 'app-0', mselId: 'msel-1', name: 'Blank' }] },
    { label: 'an application on another site', apps: [app('https://mail.example.com')] },
    { label: 'a VM application of another MSEL', apps: [app('{vmUrl}/views/{playerViewId}', 'msel-2')] },
  ])('warns with $label', ({ apps }) => {
    expect(casterVmAppWarning(READY, apps, VM_URL)).toBe(WARNING);
  });

  /**
   * Verifies: an application of this MSEL whose URL uses {vmUrl}, or starts with the VM UI's URL (trailing slashes ignored), clears the warning.
   * Interacts with: casterVmAppWarning.
   * Data: READY; a {vmUrl} application; an application under http://vm.example with the setting given as http://vm.example//.
   */
  it.each([
    { label: 'uses {vmUrl}', url: '{vmUrl}/views/{playerViewId}', vmUrl: VM_URL },
    { label: 'starts with the VM UI URL', url: 'http://vm.example/views/1', vmUrl: 'http://vm.example//' },
  ])('gives no warning when an application $label', ({ url, vmUrl }) => {
    expect(casterVmAppWarning(READY, [app('https://mail.example.com'), app(url)], vmUrl)).toBe('');
  });

  /**
   * Verifies: without a VmUrl setting only a {vmUrl} application counts, so an absolute URL does not clear the warning.
   * Interacts with: casterVmAppWarning (an empty base URL is not matched).
   * Data: READY; an application at http://vm.example/views/1; VmUrl empty or undefined.
   */
  it.each([
    { label: 'empty', vmUrl: '' },
    { label: 'undefined', vmUrl: undefined as string },
  ])('needs {vmUrl} when the VmUrl setting is $label', ({ vmUrl }) => {
    expect(casterVmAppWarning(READY, [app('http://vm.example/views/1')], vmUrl)).toBe(WARNING);
    expect(casterVmAppWarning(READY, [app('{vmUrl}/views/1')], vmUrl)).toBe('');
  });
});
