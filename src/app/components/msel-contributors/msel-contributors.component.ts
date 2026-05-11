// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { ChangeDetectorRef, Component, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { UnitDataService } from 'src/app/data/unit/unit-data.service';
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
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { Sort } from '@angular/material/sort';
import { animate, state, style, transition, trigger } from '@angular/animations';

@Component({
    selector: 'app-msel-contributors',
    templateUrl: './msel-contributors.component.html',
    styleUrls: ['./msel-contributors.component.scss'],
    animations: [
      trigger('detailExpand', [
        state('collapsed', style({ height: '0px', minHeight: '0', visibility: 'hidden' })),
        state('expanded', style({ height: '*', visibility: 'visible' })),
        transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
      ]),
    ],
    standalone: false
})
export class MselContributorsComponent implements OnDestroy, OnInit {
  @Input() loggedInUserId: string;
  // context menu
  @ViewChild(MatMenuTrigger, { static: true }) contextMenu: MatMenuTrigger;
  @ViewChild('contributorTable', { static: false }) contributorTable: MatTable<any>;
  @ViewChild(MatPaginator) set matPaginator(paginator: MatPaginator) {
    this.mselUnitDataSource.paginator = paginator;
  }
  contextMenuPosition = { x: '0px', y: '0px' };
  filterString = '';
  sort: Sort = { active: 'shortName', direction: 'asc' };
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
  citeEvaluationRoles: string[] = [
    'Owner',
    'Editor',
    'Viewer',
    'Facilitator',
    'Advancer',
    'Observer',
    'Member'
  ];
  galleryExhibitRoles: string[] = [
    'Manager',
    'Observer',
    'Member'
  ];
  steamfitterScenarioRoles: string[] = [
    'Manager',
    'Facilitator',
    'Member',
    'Observer'
  ];
  isEditEnabled = false;
  userList: User[] = [];
  mselUnitList: MselUnit[] = [];
  userMselRoles: UserMselRole[] = [];
  mselUnitDataSource = new MatTableDataSource<MselUnit>(new Array<MselUnit>());
  displayedColumns: string[] = ['action', 'shortName', 'name'];
  expandedElementId = '';
  isExpansionDetailRow = (i: number, row: Object) => (row as MselUnit).id === this.expandedElementId;
  private allUnits: Unit[] = [];
  private unsubscribe$ = new Subject();

  constructor(
    private unitDataService: UnitDataService,
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
      this.applyFilter(this.filterString);
    });
    // subscribe to UserMselRoles
    this.userMselRoleQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(umrs => {
      this.userMselRoles = umrs;
    });
  }

  ngOnInit() {
    // Refresh units so newly created units appear in the add menu
    this.unitDataService.load();
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

  refreshUnits() {
    this.unitDataService.load();
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

  getSelectedMselRoles(userId: string): MselRole[] {
    const roles = this.userMselRoles
      .filter(umr => umr.userId === userId && umr.mselId === this.msel.id)
      .map(umr => umr.role);

    // Add 'Creator' as a display-only pseudo-role for the MSEL creator
    if (userId === this.msel.createdBy) {
      roles.push('Creator' as MselRole);
    }

    return roles;
  }

  setMselRoles(userId: string, newRoles: MselRole[]) {
    const current = this.getSelectedMselRoles(userId);
    const toAdd = newRoles.filter(r => !current.includes(r));
    const toRemove = current.filter(r => !newRoles.includes(r));
    toAdd.forEach(r => this.toggleMselRole(userId, r, true));
    toRemove.forEach(r => this.toggleMselRole(userId, r, false));
  }

  getCiteEvaluationRole(userId: string): string | null {
    const umr = this.userMselRoles.find(u =>
      u.userId === userId && u.mselId === this.msel.id);
    return umr?.citeEvaluationRole ?? null;
  }

  setCiteEvaluationRole(userId: string, role: string | null) {
    this.userMselRoleDataService.setIntegrationRoles(
      this.msel.id, userId,
      role,
      this.getGalleryExhibitRole(userId),
      this.getSteamfitterScenarioRole(userId));
  }

  getGalleryExhibitRole(userId: string): string | null {
    const umr = this.userMselRoles.find(u =>
      u.userId === userId && u.mselId === this.msel.id);
    return umr?.galleryExhibitRole ?? null;
  }

  setGalleryExhibitRole(userId: string, role: string | null) {
    this.userMselRoleDataService.setIntegrationRoles(
      this.msel.id, userId,
      this.getCiteEvaluationRole(userId),
      role,
      this.getSteamfitterScenarioRole(userId));
  }

  getSteamfitterScenarioRole(userId: string): string | null {
    const umr = this.userMselRoles.find(u =>
      u.userId === userId && u.mselId === this.msel.id);
    return umr?.steamfitterScenarioRole ?? null;
  }

  setSteamfitterScenarioRole(userId: string, role: string | null) {
    this.userMselRoleDataService.setIntegrationRoles(
      this.msel.id, userId,
      this.getCiteEvaluationRole(userId),
      this.getGalleryExhibitRole(userId),
      role);
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

  rowClicked(row: MselUnit) {
    if (this.expandedElementId === row.id) {
      this.expandedElementId = '';
    } else {
      this.expandedElementId = row.id;
    }
    this.contributorTable.renderRows();
  }

  getRowClass(id: string) {
    return this.expandedElementId === id
      ? 'element-row element-row-expanded'
      : 'element-row element-row-not-expanded';
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
    // Add 'Creator' as a display-only option
    mselRoles.push('Creator' as MselRole);
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

  isOwnOwnerRole(userId: string, mselRole: MselRole): boolean {
    return userId === this.loggedInUserId && mselRole === MselRole.Owner && this.hasMselRole(userId, mselRole);
  }

  isCreatorRole(userId: string, mselRole: MselRole): boolean {
    return mselRole === ('Creator' as MselRole) && userId === this.msel.createdBy;
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }

  applyFilter(filterValue: string) {
    this.filterString = filterValue;
    filterValue = filterValue.toLowerCase();
    const filtered = this.mselUnitList
      .filter(mu =>
        mu.unit?.name?.toLowerCase().includes(filterValue) ||
        mu.unit?.shortName?.toLowerCase().includes(filterValue) ||
        mu.unit?.users?.some(u => u.name?.toLowerCase().includes(filterValue))
      )
      .sort((a, b) => this.sortMselUnits(a, b));
    this.mselUnitDataSource.data = filtered;
  }

  sortChanged(sort: Sort) {
    this.sort = sort;
    this.applyFilter(this.filterString);
  }

  sortMselUnits(a: MselUnit, b: MselUnit): number {
    const dir = this.sort.direction === 'desc' ? -1 : 1;
    switch (this.sort.active) {
      case 'name':
        return (a.unit?.name?.toLowerCase() ?? '') < (b.unit?.name?.toLowerCase() ?? '') ? -dir : dir;
      default:
        return (a.unit?.shortName?.toLowerCase() ?? '') < (b.unit?.shortName?.toLowerCase() ?? '') ? -dir : dir;
    }
  }

  getRoleDescription(role: MselRole | string): string {
    const descriptions = {
      [MselRole.Editor]: 'Can edit scenario events within the MSEL.',
      [MselRole.Approver]: 'Can approve scenario events on the MSEL.',
      [MselRole.MoveEditor]: 'Can modify the move-related information.',
      [MselRole.Owner]: 'Holds full control over the MSEL.',
      [MselRole.Evaluator]: 'Can access the MSEL view and mark items as complete.',
      [MselRole.Viewer]: 'Can only view MSEL Pages without the ability to make changes.',
      'Creator': 'Created this MSEL and permanently holds Owner permissions. This cannot be removed.'
    };
    return descriptions[role] || 'No description available.';
  }

}
