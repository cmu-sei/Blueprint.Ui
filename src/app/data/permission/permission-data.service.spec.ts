// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { SystemPermission, SystemPermissionsService } from 'src/app/generated/blueprint.api';
import { PermissionDataService } from './permission-data.service';
import { permissionDataProviders } from 'src/app/test-utils/mock-permission-data.service';
import { ApiStub } from 'src/app/test-utils/api-stub';

const ALL_PERMISSIONS = Object.values(SystemPermission);
// The View* permissions that open an admin section; ViewMsels opens none.
const SECTION_VIEW_PERMISSIONS = ALL_PERMISSIONS.filter(
  (p) => p.startsWith('View') && p !== SystemPermission.ViewMsels,
);
const NON_VIEW_PERMISSIONS = ALL_PERMISSIONS.filter((p) => !p.startsWith('View'));

function setup(granted: SystemPermission[]) {
  const permissionsApi = {
    getMySystemPermissions: vi.fn(() => of(granted)),
  } satisfies ApiStub<SystemPermissionsService>;
  TestBed.configureTestingModule({
    providers: [{ provide: SystemPermissionsService, useValue: permissionsApi }],
  });
  return { service: TestBed.inject(PermissionDataService), permissionsApi };
}

describe('PermissionDataService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: before load() resolves, the service holds no permissions and every gate is closed.
   * Interacts with: PermissionDataService.hasPermission / canViewAdministration.
   * Data: no load() call.
   */
  it('denies everything until permissions are loaded', () => {
    const { service } = setup(ALL_PERMISSIONS);

    expect(service.permissions).toEqual([]);
    expect(ALL_PERMISSIONS.some((p) => service.hasPermission(p))).toBe(false);
    expect(service.canViewAdministration()).toBe(false);
  });

  /**
   * Verifies: load() fetches the caller's system permissions, caches them, and emits them.
   * Interacts with: SystemPermissionsService.getMySystemPermissions (stub).
   * Data: CreateMsels and ViewUsers.
   */
  it('load caches the caller\'s permissions', async () => {
    const { service, permissionsApi } = setup([
      SystemPermission.CreateMsels,
      SystemPermission.ViewUsers,
    ]);

    const loaded = await firstValueFrom(service.load());

    expect(permissionsApi.getMySystemPermissions).toHaveBeenCalledTimes(1);
    expect(loaded).toEqual([SystemPermission.CreateMsels, SystemPermission.ViewUsers]);
    expect(service.permissions).toEqual(loaded);
  });

  /**
   * Verifies: hasPermission is true for each granted permission and false for every other one.
   * Interacts with: PermissionDataService.hasPermission.
   * Data: each SystemPermission granted on its own.
   */
  it.each(ALL_PERMISSIONS)('hasPermission grants only %s when only it is held', async (granted) => {
    const { service } = setup([granted]);
    await firstValueFrom(service.load());

    for (const permission of ALL_PERMISSIONS) {
      expect(service.hasPermission(permission)).toBe(permission === granted);
    }
  });

  /**
   * Verifies: any single View* permission that opens an admin section opens the administration area.
   * Interacts with: PermissionDataService.canViewAdministration.
   * Data: each View* permission except ViewMsels on its own.
   */
  it.each(SECTION_VIEW_PERMISSIONS)('canViewAdministration is true with only %s', async (granted) => {
    const { service } = setup([granted]);
    await firstValueFrom(service.load());

    expect(service.canViewAdministration()).toBe(true);
  });

  /**
   * Verifies: ViewMsels alone opens the administration area, although no admin section is gated on it (current behavior).
   * Interacts with: PermissionDataService.canViewAdministration.
   * Data: ViewMsels only.
   */
  it('canViewAdministration is true with only ViewMsels', async () => {
    const { service } = setup([SystemPermission.ViewMsels]);
    await firstValueFrom(service.load());

    expect(service.canViewAdministration()).toBe(true);
  });

  /**
   * Verifies: holding every Create/Edit/Manage permission but no View* permission keeps the administration area closed.
   * Interacts with: PermissionDataService.canViewAdministration.
   * Data: all non-View system permissions.
   */
  it('canViewAdministration is false without any View permission', async () => {
    const { service } = setup(NON_VIEW_PERMISSIONS);
    await firstValueFrom(service.load());

    expect(service.canViewAdministration()).toBe(false);
  });

  /**
   * Verifies: permissionDataProviders, used by component specs, gives the real service already primed with the granted permissions.
   * Interacts with: permissionDataProviders (test-utils), the real PermissionDataService, SystemPermissionsService.getMySystemPermissions (stub).
   * Data: ViewUsers granted; no load() call by the test.
   */
  it('permissionDataProviders primes the real service with the grants', () => {
    TestBed.configureTestingModule({
      providers: permissionDataProviders({ system: [SystemPermission.ViewUsers] }),
    });

    const service = TestBed.inject(PermissionDataService);

    expect(service).toBeInstanceOf(PermissionDataService);
    expect(service.permissions).toEqual([SystemPermission.ViewUsers]);
    expect(service.canViewAdministration()).toBe(true);
    expect(service.hasPermission(SystemPermission.ManageUsers)).toBe(false);
  });
});
