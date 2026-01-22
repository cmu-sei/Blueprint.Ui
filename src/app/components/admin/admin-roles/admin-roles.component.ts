// Copyright 2025 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, OnInit, OnDestroy } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatCheckboxChange } from '@angular/material/checkbox';
import { Subject } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';
import {
  SystemPermission,
  SystemRole,
} from 'src/app/generated/blueprint.api';
import { SystemRoleDataService } from 'src/app/data/system-role/system-role-data.service';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { DialogService } from 'src/app/services/dialog/dialog.service';

@Component({
  selector: 'app-admin-roles',
  templateUrl: './admin-roles.component.html',
  styleUrls: ['./admin-roles.component.scss'],
  standalone: false,
})
export class AdminRolesComponent implements OnInit, OnDestroy {
  private unsubscribe$ = new Subject<void>();

  canEdit = false;
  allPermission = 'All';
  newRoleName = '';
  isAddingRole = false;
  editingRoleId: string | null = null;
  editingRoleName = '';

  permissionDescriptions = new Map<string, string>([
    ['All', 'Gives permission to perform any action'],
    [SystemPermission.CreateMsels, 'Allows creation of new MSELs'],
    [SystemPermission.ViewMsels, 'Allows viewing all MSELs'],
    [SystemPermission.EditMsels, 'Allows editing MSELs'],
    [SystemPermission.ManageMsels, 'Allows managing MSELs including memberships'],
    [SystemPermission.ViewUnits, 'Allows viewing all Units'],
    [SystemPermission.ManageUnits, 'Allows managing Units'],
    [SystemPermission.ViewOrganizations, 'Allows viewing all Organizations'],
    [SystemPermission.ManageOrganizations, 'Allows managing Organizations'],
    [SystemPermission.ViewDataFields, 'Allows viewing all Data Fields'],
    [SystemPermission.ManageDataFields, 'Allows managing Data Fields'],
    [SystemPermission.ViewInjectTypes, 'Allows viewing all Inject Types'],
    [SystemPermission.ManageInjectTypes, 'Allows managing Inject Types'],
    [SystemPermission.ViewCatalogs, 'Allows viewing all Catalogs'],
    [SystemPermission.ManageCatalogs, 'Allows managing Catalogs'],
    [SystemPermission.ViewGalleryCards, 'Allows viewing Gallery Cards'],
    [SystemPermission.ManageGalleryCards, 'Allows managing Gallery Cards'],
    [SystemPermission.ViewCiteActions, 'Allows viewing CITE Actions'],
    [SystemPermission.ManageCiteActions, 'Allows managing CITE Actions'],
    [SystemPermission.ViewCiteDuties, 'Allows viewing CITE Duties'],
    [SystemPermission.ManageCiteDuties, 'Allows managing CITE Duties'],
    [SystemPermission.ViewUsers, 'Allows viewing all Users. Enables the Users Administration panel'],
    [SystemPermission.ManageUsers, 'Allows managing Users including adding, removing, and changing roles'],
    [SystemPermission.ViewRoles, 'Allows viewing all Roles. Enables the Roles Administration panel'],
    [SystemPermission.ManageRoles, 'Allows creating, editing, and deleting Roles'],
    [SystemPermission.ViewGroups, 'Allows viewing all Groups. Enables the Groups Administration panel'],
    [SystemPermission.ManageGroups, 'Allows creating, editing, and deleting Groups'],
  ]);

  dataSource = new MatTableDataSource<string>([
    this.allPermission,
    ...Object.values(SystemPermission),
  ]);

  roles$ = this.roleDataService.roles$.pipe(
    map((roles) =>
      roles.sort((a, b) => {
        if (a.immutable !== b.immutable) {
          return a.immutable ? -1 : 1;
        }
        return (a.name || '').localeCompare(b.name || '');
      })
    )
  );

  displayedColumns$ = this.roles$.pipe(
    map((roles) => {
      const columnNames = roles.map((r) => r.name);
      return ['permissions', ...columnNames];
    })
  );

  constructor(
    private roleDataService: SystemRoleDataService,
    private permissionDataService: PermissionDataService,
    private dialogService: DialogService
  ) {}

  ngOnInit(): void {
    this.canEdit = this.permissionDataService.hasPermission(
      SystemPermission.ManageRoles
    );
    this.roleDataService.getRoles().pipe(takeUntil(this.unsubscribe$)).subscribe();
  }

  ngOnDestroy(): void {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

  trackById(index: number, item: any) {
    return item.id;
  }

  hasPermission(permission: string, role: SystemRole): boolean {
    if (permission === this.allPermission) {
      return role.allPermissions || false;
    }
    return (role.permissions || []).some((x) => x === permission);
  }

  setPermission(
    permission: string,
    role: SystemRole,
    event: MatCheckboxChange
  ): void {
    const updatedRole = { ...role };

    if (permission === this.allPermission) {
      updatedRole.allPermissions = event.checked;
    } else {
      updatedRole.permissions = [...(role.permissions || [])];
      if (event.checked && !this.hasPermission(permission, role)) {
        updatedRole.permissions.push(permission as SystemPermission);
      } else if (!event.checked) {
        updatedRole.permissions = updatedRole.permissions.filter(
          (x) => x !== (permission as SystemPermission)
        );
      }
    }

    this.roleDataService.editRole(updatedRole).subscribe();
  }

  startAddRole(): void {
    this.isAddingRole = true;
    this.newRoleName = '';
  }

  cancelAddRole(): void {
    this.isAddingRole = false;
    this.newRoleName = '';
  }

  addRole(): void {
    if (this.newRoleName.trim()) {
      this.roleDataService
        .createRole({ name: this.newRoleName.trim(), permissions: [] })
        .subscribe(() => {
          this.isAddingRole = false;
          this.newRoleName = '';
        });
    }
  }

  startEditRole(role: SystemRole): void {
    this.editingRoleId = role.id;
    this.editingRoleName = role.name || '';
  }

  cancelEditRole(): void {
    this.editingRoleId = null;
    this.editingRoleName = '';
  }

  saveRoleName(role: SystemRole): void {
    if (this.editingRoleName.trim()) {
      const updatedRole = { ...role, name: this.editingRoleName.trim() };
      this.roleDataService.editRole(updatedRole).subscribe(() => {
        this.editingRoleId = null;
        this.editingRoleName = '';
      });
    }
  }

  deleteRole(role: SystemRole): void {
    this.dialogService
      .confirm(
        'Delete Role',
        `Are you sure you want to delete "${role.name}"?`
      )
      .subscribe((result) => {
        if (result && result['confirm']) {
          this.roleDataService.deleteRole(role.id).subscribe();
        }
      });
  }

  getPermissionDescription(permission: string): string {
    return this.permissionDescriptions.get(permission) || permission;
  }

  handleInput(event: KeyboardEvent): void {
    event.stopPropagation();
  }
}
