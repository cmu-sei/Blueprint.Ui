// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { PermissionDataService } from './permission-data.service';
import { SystemPermission, SystemPermissionsService } from 'src/app/generated/blueprint.api';

const ALL_PERMISSIONS = Object.values(SystemPermission) as SystemPermission[];

const VIEW_PERMISSIONS: SystemPermission[] = ALL_PERMISSIONS.filter((p) =>
  p.startsWith('View')
);

const NON_VIEW_PERMISSIONS: SystemPermission[] = ALL_PERMISSIONS.filter(
  (p) => !p.startsWith('View')
);

describe('PermissionDataService', () => {
  let service: PermissionDataService;
  let mockSystemPermissionsService: { getMySystemPermissions: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockSystemPermissionsService = {
      getMySystemPermissions: vi.fn().mockReturnValue(of([])),
    };

    TestBed.configureTestingModule({
      providers: [
        PermissionDataService,
        { provide: SystemPermissionsService, useValue: mockSystemPermissionsService },
      ],
    });

    service = TestBed.inject(PermissionDataService);
  });

  describe('initial state', () => {
    it('starts with an empty permissions array before loading', () => {
      expect(service.permissions).toEqual([]);
    });

    it('hasPermission returns false for all permissions before load', () => {
      for (const perm of ALL_PERMISSIONS) {
        expect(service.hasPermission(perm)).toBe(false);
      }
    });
  });

  describe('load()', () => {
    it('loads and stores permissions from the API', async () => {
      const perms: SystemPermission[] = [SystemPermission.ViewMsels, SystemPermission.ManageMsels];
      mockSystemPermissionsService.getMySystemPermissions.mockReturnValue(of(perms));

      await firstValueFrom(service.load());

      expect(service.permissions).toEqual(perms);
    });

    it('stores empty array when API returns empty', async () => {
      mockSystemPermissionsService.getMySystemPermissions.mockReturnValue(of([]));

      await firstValueFrom(service.load());

      expect(service.permissions).toEqual([]);
    });

    it('stores all 26 permissions when API returns all', async () => {
      mockSystemPermissionsService.getMySystemPermissions.mockReturnValue(of(ALL_PERMISSIONS));

      await firstValueFrom(service.load());

      expect(service.permissions.length).toBe(26);
    });
  });

  describe('hasPermission() — all 26 SystemPermission values', () => {
    for (const perm of ALL_PERMISSIONS) {
      it(`granted: hasPermission('${perm}') returns true when present`, async () => {
        mockSystemPermissionsService.getMySystemPermissions.mockReturnValue(of([perm]));
        await firstValueFrom(service.load());

        expect(service.hasPermission(perm)).toBe(true);
      });

      it(`missing: hasPermission('${perm}') returns false when absent`, async () => {
        const others = ALL_PERMISSIONS.filter((p) => p !== perm);
        mockSystemPermissionsService.getMySystemPermissions.mockReturnValue(of(others));
        await firstValueFrom(service.load());

        expect(service.hasPermission(perm)).toBe(false);
      });
    }
  });

  describe('hasPermission() — edge cases', () => {
    it('returns false for all permissions when array is empty', async () => {
      mockSystemPermissionsService.getMySystemPermissions.mockReturnValue(of([]));
      await firstValueFrom(service.load());

      for (const perm of ALL_PERMISSIONS) {
        expect(service.hasPermission(perm)).toBe(false);
      }
    });

    it('returns true for all permissions when all are loaded', async () => {
      mockSystemPermissionsService.getMySystemPermissions.mockReturnValue(of(ALL_PERMISSIONS));
      await firstValueFrom(service.load());

      for (const perm of ALL_PERMISSIONS) {
        expect(service.hasPermission(perm)).toBe(true);
      }
    });

    it('returns false for a permission not in a partial array', async () => {
      const subset: SystemPermission[] = [
        SystemPermission.ViewMsels,
        SystemPermission.ManageMsels,
        SystemPermission.ViewUnits,
      ];
      mockSystemPermissionsService.getMySystemPermissions.mockReturnValue(of(subset));
      await firstValueFrom(service.load());

      expect(service.hasPermission(SystemPermission.ManageUsers)).toBe(false);
    });

    it('returns true for multiple permissions all present in array', async () => {
      const perms: SystemPermission[] = [
        SystemPermission.ViewRoles,
        SystemPermission.ManageRoles,
        SystemPermission.ViewGroups,
        SystemPermission.ManageGroups,
      ];
      mockSystemPermissionsService.getMySystemPermissions.mockReturnValue(of(perms));
      await firstValueFrom(service.load());

      for (const perm of perms) {
        expect(service.hasPermission(perm)).toBe(true);
      }
    });
  });

  describe('canViewAdministration()', () => {
    it('returns false with empty permissions', async () => {
      mockSystemPermissionsService.getMySystemPermissions.mockReturnValue(of([]));
      await firstValueFrom(service.load());

      expect(service.canViewAdministration()).toBe(false);
    });

    it('returns false with only Manage* permissions', async () => {
      const managePerms = NON_VIEW_PERMISSIONS.filter((p) => p.startsWith('Manage'));
      mockSystemPermissionsService.getMySystemPermissions.mockReturnValue(of(managePerms));
      await firstValueFrom(service.load());

      expect(service.canViewAdministration()).toBe(false);
    });

    it('returns false with only Create* permissions', async () => {
      const createPerms = NON_VIEW_PERMISSIONS.filter((p) => p.startsWith('Create'));
      mockSystemPermissionsService.getMySystemPermissions.mockReturnValue(of(createPerms));
      await firstValueFrom(service.load());

      expect(service.canViewAdministration()).toBe(false);
    });

    it('returns false with only non-View permissions', async () => {
      mockSystemPermissionsService.getMySystemPermissions.mockReturnValue(of(NON_VIEW_PERMISSIONS));
      await firstValueFrom(service.load());

      expect(service.canViewAdministration()).toBe(false);
    });

    it('returns true when ViewMsels is present alone', async () => {
      mockSystemPermissionsService.getMySystemPermissions.mockReturnValue(
        of([SystemPermission.ViewMsels])
      );
      await firstValueFrom(service.load());

      expect(service.canViewAdministration()).toBe(true);
    });

    it('returns true when ViewUnits is present alone', async () => {
      mockSystemPermissionsService.getMySystemPermissions.mockReturnValue(
        of([SystemPermission.ViewUnits])
      );
      await firstValueFrom(service.load());

      expect(service.canViewAdministration()).toBe(true);
    });

    it('returns true when ViewUsers is present alone', async () => {
      mockSystemPermissionsService.getMySystemPermissions.mockReturnValue(
        of([SystemPermission.ViewUsers])
      );
      await firstValueFrom(service.load());

      expect(service.canViewAdministration()).toBe(true);
    });

    it('returns true when ViewRoles is present alone', async () => {
      mockSystemPermissionsService.getMySystemPermissions.mockReturnValue(
        of([SystemPermission.ViewRoles])
      );
      await firstValueFrom(service.load());

      expect(service.canViewAdministration()).toBe(true);
    });

    it('returns true for each View* permission individually', async () => {
      for (const perm of VIEW_PERMISSIONS) {
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
          providers: [
            PermissionDataService,
            { provide: SystemPermissionsService, useValue: { getMySystemPermissions: () => of([perm]) } },
          ],
        });
        const svc = TestBed.inject(PermissionDataService);
        await firstValueFrom(svc.load());

        expect(svc.canViewAdministration()).toBe(true);
      }
    });

    it('returns true when mixed View* and Manage* permissions are present', async () => {
      const mixed: SystemPermission[] = [
        SystemPermission.ViewMsels,
        SystemPermission.ManageMsels,
        SystemPermission.ManageUsers,
      ];
      mockSystemPermissionsService.getMySystemPermissions.mockReturnValue(of(mixed));
      await firstValueFrom(service.load());

      expect(service.canViewAdministration()).toBe(true);
    });

    it('returns true when all permissions are loaded', async () => {
      mockSystemPermissionsService.getMySystemPermissions.mockReturnValue(of(ALL_PERMISSIONS));
      await firstValueFrom(service.load());

      expect(service.canViewAdministration()).toBe(true);
    });
  });
});
