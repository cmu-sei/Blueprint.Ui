// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { ChangeDetectorRef, Component, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { UnitQuery } from 'src/app/data/unit/unit.query';
import { UserQuery } from 'src/app/data/user/user.query';
import {
  DataField,
  MselRole,
  MselUnit,
  ScenarioEvent,
  SystemPermission,
  Unit,
  User,
  UserMselRole
} from 'src/app/generated/blueprint.api';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { MselDataService, MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { MselUnitDataService } from 'src/app/data/msel-unit/msel-unit-data.service';
import { MselUnitQuery } from 'src/app/data/msel-unit/msel-unit.query';
import { MatMenuTrigger } from '@angular/material/menu';
import { UserMselRoleDataService } from 'src/app/data/user-msel-role/user-msel-role-data.service';
import { UserMselRoleQuery } from 'src/app/data/user-msel-role/user-msel-role.query';
import { DialogService } from 'src/app/services/dialog/dialog.service';

@Component({
    selector: 'app-msel-contributors',
    templateUrl: './msel-contributors.component.html',
    styleUrls: ['./msel-contributors.component.scss'],
    standalone: false
})
export class MselContributorsComponent implements OnDestroy, OnInit {
  @Input() loggedInUserId: string;
  // context menu
  @ViewChild(MatMenuTrigger, { static: true }) contextMenu: MatMenuTrigger;
  contextMenuPosition = { x: '0px', y: '0px' };
  msel = new MselPlus();
  originalMsel = new MselPlus();
  expandedSectionIds: string[] = [];
  sortedScenarioEvents: ScenarioEvent[];
  sortedDataFields: DataField[];
  mselRoles: MselRole[] = [
    MselRole.Editor,
    MselRole.Approver,
    MselRole.MoveEditor,
    MselRole.Owner,
    MselRole.Evaluator,
    MselRole.Viewer
  ];
  isEditEnabled = false;
  userList: User[] = [];
  mselUnitList: MselUnit[] = [];
  userMselRoles: UserMselRole[] = [];
  private allUnits: Unit[] = [];
  private unsubscribe$ = new Subject();

  constructor(
    private unitQuery: UnitQuery,
    private userQuery: UserQuery,
    private mselDataService: MselDataService,
    private mselQuery: MselQuery,
    private mselUnitDataService: MselUnitDataService,
    private mselUnitQuery: MselUnitQuery,
    private userMselRoleDataService: UserMselRoleDataService,
    private userMselRoleQuery: UserMselRoleQuery,
    public dialogService: DialogService,
    private permissionDataService: PermissionDataService,
    private changeDetectorRef: ChangeDetectorRef
  ) {
    // subscribe to the active MSEL
    (this.mselQuery.selectActive() as Observable<MselPlus>).pipe(takeUntil(this.unsubscribe$)).subscribe(msel => {
      if (msel && this.msel.id !== msel.id) {
        Object.assign(this.originalMsel, msel);
        Object.assign(this.msel, msel);
        this.sortedDataFields = this.getSortedDataFields(msel.dataFields);
      }
    });
    // subscribe to users
    this.userQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(users => {
      this.userList = users;
    });
    // subscribe to units
    this.unitQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(units => {
      if (units && units.length > 0) {
        this.allUnits = units.sort((a, b) => a.shortName?.toLowerCase() > b.shortName?.toLowerCase() ? 1 : -1);
      }
    });
    // subscribe to mselUnits
    this.mselUnitQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(mselUnits => {
      this.mselUnitList = [];
      mselUnits.forEach(mt => {
        const mselUnit = {} as MselUnit;
        if (mt) {
          this.mselUnitList.push(Object.assign(mselUnit, mt));
        }
      });
      if (this.mselUnitList.length > 0) {
        this.mselUnitList = this.mselUnitList.sort((a, b) =>
          a.unit.shortName?.toLowerCase() > b.unit.shortName?.toLowerCase() ? 1 : -1);
      }
    });
    // subscribe to UserMselRoles
    this.userMselRoleQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(umrs => {
      this.userMselRoles = umrs;
    });
  }

  ngOnInit() {
    // Load permissions and trigger change detection when loaded
    this.permissionDataService.load()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(() => {
        this.changeDetectorRef.markForCheck();
      });
  }

  getUserName(userId: string) {
    const user = this.userList.find(u => u.id === userId);
    return user ? user.name : 'unknown';
  }

  getSortedDataFields(dataFields: DataField[]): DataField[] {
    const sortedDataFields: DataField[] = [];
    if (dataFields) {
      dataFields.forEach(df => {
        sortedDataFields.push({ ...df });
      });
      sortedDataFields.sort((a, b) => +a.displayOrder > +b.displayOrder ? 1 : -1);
    }
    return sortedDataFields;
  }

  getUnitList() {
    let unitList = this.allUnits;
    if (this.msel && this.mselUnitList && this.mselUnitList.length > 0 && unitList.length > 0) {
      const mselUnitIds = new Set(this.mselUnitList.map(mt => mt.unitId));
      unitList = this.allUnits.filter(t => !mselUnitIds.has(t.id));
    }

    return unitList;
  }

  getUnit(id: string) {
    const unit = this.allUnits.find(t => t.id === id);
    return unit ? unit : {};
  }

  getMselUnitUsers(id: string) {
    const unit = this.mselUnitList.find(mt => mt.unitId === id).unit;
    return unit ? unit.users : [];
  }

  addUnitToMsel(unitId: string) {
    const mselUnit: MselUnit = {
      mselId: this.msel.id,
      unitId: unitId
    };
    this.mselUnitDataService.add(mselUnit);
  }

  removeUnitFromMsel(id: string): void {
    const mselUnit = this.mselUnitList.find(u => u.id === id);
    const unitLabel = mselUnit?.unit?.name;

    this.dialogService
      .confirm(
        'Remove Contributor',
        `Are you sure that you want to remove ${unitLabel} from the MSEL?`
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.mselUnitDataService.delete(id);
        }
      });
  }

  hasMselRole(userId: string, mselRole: MselRole): boolean {
    const hasRole = this.userMselRoles.some(umr =>
      umr.userId === userId && umr.role === mselRole && umr.mselId === this.msel.id);
    return hasRole;
  }

  toggleMselRole(userId: string, mselRole: MselRole, addIt: boolean) {
    if (addIt) {
      const umr = {
        userId: userId,
        mselId: this.msel.id,
        role: mselRole
      } as UserMselRole;
      this.userMselRoleDataService.add(umr);
    } else {
      const umrId = this.userMselRoles.find(umr =>
        umr.userId === userId &&
        umr.mselId === this.msel.id &&
        umr.role === mselRole
      ).id;
      this.userMselRoleDataService.delete(umrId);
    }
  }

  saveMselUnit(mselUnit: MselUnit) {
    this.mselUnitDataService.updateMselUnit(mselUnit);
  }

  saveChanges() {
    this.mselDataService.updateMsel(this.msel);
    this.isEditEnabled = false;
  }

  cancelChanges() {
    this.isEditEnabled = false;
    Object.assign(this.msel, this.originalMsel);
  }

  trackByFn(index, item) {
    return item.id;
  }

  getMselRolesToDisplay(): MselRole[] {
    const mselRoles = [];
    this.mselRoles.forEach(mr => {
      if (mr.startsWith('Cite')) {
        if (this.msel.useCite) {
          mselRoles.push(mr);
        }
      } else if (mr.startsWith('Gallery')) {
        if (this.msel.useGallery) {
          mselRoles.push(mr);
        }
      } else {
        mselRoles.push(mr);
      }
    });
    return mselRoles;
  }

  canViewMsel(): boolean {
    return this.permissionDataService.hasPermission(SystemPermission.ViewMsels) ||
      this.mselUnitList.some(mu => mu.unit?.users?.some(u => u.id === this.loggedInUserId));
  }

  canManageMsel(): boolean {
    return this.permissionDataService.hasPermission(SystemPermission.ManageMsels) ||
      this.msel.hasRole(this.loggedInUserId, '').owner;
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }

  getRoleDescription(role: MselRole): string {
    const descriptions = {
      [MselRole.Editor]: 'Can edit scenario events within the MSEL.',
      [MselRole.Approver]: 'Can approve scenario events on the MSEL.',
      [MselRole.MoveEditor]: 'Can modify the move-related information.',
      [MselRole.Owner]: 'Holds full control over the MSEL.',
      [MselRole.Evaluator]: 'Can access the MSEL view and mark items as complete.',
      [MselRole.Viewer]: 'Can only view MSEL Pages without the ability to make changes.'
    };
    return descriptions[role] || 'No description available.';
  }

}
