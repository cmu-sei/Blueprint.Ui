// Copyright 2025 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  SystemRole,
  SystemRolesService,
} from 'src/app/generated/blueprint.api';

@Injectable({
  providedIn: 'root',
})
export class SystemRoleDataService {
  private rolesSubject = new BehaviorSubject<SystemRole[]>([]);
  public roles$ = this.rolesSubject.asObservable();

  constructor(private systemRolesService: SystemRolesService) {}

  getRoles() {
    return this.systemRolesService
      .getSystemRoles()
      .pipe(tap((x) => this.rolesSubject.next(x)));
  }

  editRole(role: SystemRole) {
    return this.systemRolesService.updateSystemRole(role.id, role).pipe(
      tap((x) => {
        this.upsert(role.id, x);
      })
    );
  }

  createRole(role: SystemRole) {
    return this.systemRolesService.createSystemRole(role).pipe(
      tap((x) => {
        this.upsert(x.id, x);
      })
    );
  }

  deleteRole(id: string) {
    return this.systemRolesService.deleteSystemRole(id).pipe(
      tap(() => {
        this.remove(id);
      })
    );
  }

  upsert(id: string, role: Partial<SystemRole>) {
    const roles = this.rolesSubject.getValue();
    const roleToUpdate = roles.find((x) => x.id === id);

    if (roleToUpdate != null) {
      Object.assign(roleToUpdate, role);
    } else {
      roles.push({ ...role, id } as SystemRole);
    }

    this.rolesSubject.next(roles);
  }

  remove(id: string) {
    let roles = this.rolesSubject.getValue();
    roles = roles.filter((x) => x.id !== id);
    this.rolesSubject.next(roles);
  }
}
