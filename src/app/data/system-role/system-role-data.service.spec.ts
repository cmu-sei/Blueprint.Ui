// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { SystemPermission, SystemRole, SystemRolesService } from 'src/app/generated/blueprint.api';
import { SystemRoleDataService } from './system-role-data.service';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { recordEmissions } from 'src/app/test-utils/record-emissions';

function role(overrides: Partial<SystemRole> = {}): SystemRole {
  return {
    id: 'role-admin',
    name: 'Administrator',
    allPermissions: true,
    immutable: true,
    permissions: [],
    ...overrides,
  };
}

function setup() {
  const rolesApi = {
    getSystemRoles: vi.fn(() => of<SystemRole[]>([])),
    updateSystemRole: vi.fn(() => of<SystemRole>({})),
    createSystemRole: vi.fn(() => of<SystemRole>({})),
    deleteSystemRole: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<SystemRolesService>;
  TestBed.configureTestingModule({
    providers: [{ provide: SystemRolesService, useValue: rolesApi }],
  });
  const service = TestBed.inject(SystemRoleDataService);
  return { service, rolesApi, roles: recordEmissions(service.roles$) };
}

const names = (list: SystemRole[]) => list.map((r) => r.name);

describe('SystemRoleDataService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: getRoles is cold and publishes the API's roles on roles$ once subscribed.
   * Interacts with: SystemRolesService.getSystemRoles (stub), roles$.
   * Data: Administrator and Content Developer.
   */
  it('getRoles publishes the roles', async () => {
    const { service, rolesApi, roles } = setup();
    rolesApi.getSystemRoles.mockReturnValue(
      of([role(), role({ id: 'role-cd', name: 'Content Developer', allPermissions: false })]),
    );

    const roles$ = service.getRoles();
    expect(roles).toEqual([[]]);
    await firstValueFrom(roles$);

    expect(names(roles.at(-1))).toEqual(['Administrator', 'Content Developer']);
  });

  /**
   * Verifies: createRole appends the created role, editRole merges the saved role into the existing one, and deleteRole removes it.
   * Interacts with: SystemRolesService create / update / delete (stubs), roles$.
   * Data: Observer created, then granted ViewMsels, then deleted.
   */
  it('create, edit and delete keep roles$ current', async () => {
    const { service, rolesApi, roles } = setup();
    const observer = role({ id: 'role-obs', name: 'Observer', allPermissions: false, immutable: false });
    rolesApi.createSystemRole.mockReturnValue(of(observer));
    rolesApi.updateSystemRole.mockReturnValue(
      of({ ...observer, permissions: [SystemPermission.ViewMsels] }),
    );
    rolesApi.deleteSystemRole.mockReturnValue(of(null));

    await firstValueFrom(service.createRole({ name: 'Observer' }));
    expect(names(roles.at(-1))).toEqual(['Observer']);

    await firstValueFrom(service.editRole({ ...observer, permissions: [SystemPermission.ViewMsels] }));
    expect(rolesApi.updateSystemRole).toHaveBeenCalledWith('role-obs', expect.objectContaining({ name: 'Observer' }));
    expect(roles.at(-1)[0].permissions).toEqual([SystemPermission.ViewMsels]);

    await firstValueFrom(service.deleteRole('role-obs'));
    expect(roles.at(-1)).toEqual([]);
  });

  /**
   * Verifies: upsert adds an unknown id (stamping the id on it) and patches a known one; remove drops by id.
   * Interacts with: SystemRoleDataService.upsert / remove, roles$.
   * Data: role-x upserted from a partial, renamed, then removed.
   */
  it('upsert and remove edit the published list', () => {
    const { service, roles } = setup();

    service.upsert('role-x', { name: 'Exercise Lead' });
    expect(roles.at(-1)).toEqual([{ id: 'role-x', name: 'Exercise Lead' }]);

    service.upsert('role-x', { description: 'Runs the exercise' });
    expect(roles.at(-1)).toEqual([
      { id: 'role-x', name: 'Exercise Lead', description: 'Runs the exercise' },
    ]);

    service.remove('role-x');
    expect(roles.at(-1)).toEqual([]);
  });
});
