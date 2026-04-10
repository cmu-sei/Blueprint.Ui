// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, Input, OnDestroy, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { SelectionModel } from '@angular/cdk/collections';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { Subject, Observable } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';
import {
  Competency,
  CompetencyFramework,
  CompetencyFrameworkService,
  MselCompetency,
  Team,
  TeamCompetency,
  SystemPermission,
} from 'src/app/generated/blueprint.api';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { MselDataService, MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { MselCompetencyDataService } from 'src/app/data/msel-competency/msel-competency-data.service';
import { MselCompetencyQuery } from 'src/app/data/msel-competency/msel-competency.query';
import { TeamCompetencyDataService } from 'src/app/data/team-competency/team-competency-data.service';
import { TeamCompetencyQuery } from 'src/app/data/team-competency/team-competency.query';
import { CompetencyFrameworkDataService } from 'src/app/data/competency-framework/competency-framework-data.service';
import { CompetencyFrameworkQuery } from 'src/app/data/competency-framework/competency-framework.query';
import { MatDialog } from '@angular/material/dialog';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort, Sort } from '@angular/material/sort';

@Component({
  selector: 'app-msel-competencies',
  templateUrl: './msel-competencies.component.html',
  styleUrls: ['./msel-competencies.component.scss'],
  animations: [
    trigger('detailExpand', [
      state('collapsed', style({ height: '0px', minHeight: '0', visibility: 'hidden' })),
      state('expanded', style({ height: '*', visibility: 'visible' })),
      transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
    ]),
  ],
  standalone: false
})
export class MselCompetenciesComponent implements OnDestroy, OnInit, AfterViewInit {
  @Input() loggedInUserId: string;
  @ViewChild('competencyPaginator') competencyPaginator: MatPaginator;
  @ViewChild('workRolePaginator') workRolePaginator: MatPaginator;
  @ViewChild('workRoleSort') workRoleSort: MatSort;
  @ViewChild('poolSort') poolSort: MatSort;
  msel = new MselPlus();
  mselCompetencyList: MselCompetency[] = [];
  teamCompetencyList: TeamCompetency[] = [];
  // Frameworks
  frameworks: CompetencyFramework[] = [];
  selectedFrameworkId = '';
  selectedFramework: CompetencyFramework = null;
  frameworkWorkRoles: Competency[] = [];
  private competencyTypeMap = new Map<string, string>();
  private competencyById = new Map<string, Competency>();

  // --- Panel 1: Add Competencies (browser) ---
  workRoleFilterControl = new UntypedFormControl();
  workRoleFilterString = '';
  competencySearchControl = new UntypedFormControl();
  competencySearchString = '';
  workRoleDataSource = new MatTableDataSource<Competency>([]);
  workRoleDisplayedColumns: string[] = ['check', 'idNumber', 'shortName', 'category'];
  workRoleCategoryFilter = '';
  workRoleCategories: string[] = [];
  addPanelExpanded = false;
  browserExpandedId: string = null;
  browserAutoExpandedIds = new Set<string>();
  browserChildTypeFilter = '';
  browserChildTypes: string[] = [];

  // --- Panel 2: MSEL Competencies (pool) ---
  filterControl = new UntypedFormControl();
  filterString = '';
  dataSource = new MatTableDataSource<MselCompetency>([]);
  displayedColumns: string[] = ['select', 'action', 'idNumber', 'type', 'framework', 'shortName', 'teams', 'events'];
  selection = new SelectionModel<MselCompetency>(true, []);
  typeFilter = '';
  competencyTypes: string[] = [];
  frameworkFilter = '';
  poolFrameworks: { id: string, name: string }[] = [];
  // Teams
  mselTeams: Team[] = [];
  teamsByCompetency = new Map<string, string[]>();
  expandedCompetencyId: string = null;

  private unsubscribe$ = new Subject();

  constructor(
    private mselQuery: MselQuery,
    private mselCompetencyDataService: MselCompetencyDataService,
    private mselCompetencyQuery: MselCompetencyQuery,
    private teamCompetencyDataService: TeamCompetencyDataService,
    private teamCompetencyQuery: TeamCompetencyQuery,
    private competencyFrameworkDataService: CompetencyFrameworkDataService,
    private competencyFrameworkQuery: CompetencyFrameworkQuery,
    private competencyFrameworkService: CompetencyFrameworkService,
    private permissionDataService: PermissionDataService,
    public dialog: MatDialog,
    public dialogService: DialogService
  ) {
    (this.mselQuery.selectActive() as Observable<MselPlus>).pipe(takeUntil(this.unsubscribe$)).subscribe(msel => {
      if (msel && this.msel.id !== msel.id) {
        Object.assign(this.msel, msel);
        this.mselTeams = msel.teams || [];
        this.mselCompetencyDataService.loadByMsel(msel.id);
        this.teamCompetencyDataService.loadByMsel(msel.id);
      }
    });
    this.mselCompetencyQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(mselCompetencies => {
      const isFirstLoad = this.mselCompetencyList.length === 0 && !this.selectedFrameworkId;
      this.mselCompetencyList = mselCompetencies;
      if (isFirstLoad && mselCompetencies.length === 0) {
        this.addPanelExpanded = true;
      }
      this.selection.clear();
      this.buildPoolTypes();
      this.applyFilter();
    });
    this.teamCompetencyQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(teamCompetencies => {
      this.teamCompetencyList = teamCompetencies;
      this.buildTeamsByCompetency();
    });
    this.competencyFrameworkQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(frameworks => {
      this.frameworks = frameworks;
    });
    this.filterControl.valueChanges.pipe(takeUntil(this.unsubscribe$)).subscribe(term => {
      this.filterString = term;
      this.applyFilter();
    });
    this.workRoleFilterControl.valueChanges.pipe(takeUntil(this.unsubscribe$)).subscribe(term => {
      this.workRoleFilterString = term;
      this.applyWorkRoleFilter();
    });
    this.competencySearchControl.valueChanges.pipe(takeUntil(this.unsubscribe$)).subscribe(term => {
      this.competencySearchString = term;
      this.applyWorkRoleFilter();
    });
  }

  ngOnInit() {
    this.permissionDataService.load().pipe(takeUntil(this.unsubscribe$)).subscribe();
    this.competencyFrameworkDataService.load();
  }

  ngAfterViewInit() {
    if (this.poolSort) {
      this.dataSource.sort = this.poolSort;
    }
  }

  canEditMsel(): boolean {
    return this.permissionDataService.hasPermission(SystemPermission.ManageMsels) ||
      this.msel.hasRole(this.loggedInUserId, '').owner;
  }

  // =============================================
  // Framework selection
  // =============================================

  onFrameworkChange(frameworkId: string) {
    this.selectedFrameworkId = frameworkId;
    this.browserExpandedId = null;
    this.browserChildTypeFilter = '';
    if (frameworkId) {
      this.addPanelExpanded = true;
    }
    if (!frameworkId) {
      this.selectedFramework = null;
      this.frameworkWorkRoles = [];
      this.workRoleDataSource.data = [];
      return;
    }
    this.competencyFrameworkService.getCompetencyFramework(frameworkId)
      .pipe(take(1))
      .subscribe(fw => {
        this.selectedFramework = fw;
        const allComps = fw.competencies || [];
        this.buildTypeMapFromComps(fw, allComps);
        this.frameworkWorkRoles = allComps.filter(c => this.competencyTypeMap.get(c.id) === 'Work Role');
        this.workRoleCategories = [...new Set(this.frameworkWorkRoles.map(wr => this.getWorkRoleCategory(wr)).filter(c => c))].sort();
        this.workRoleCategoryFilter = '';
        this.workRoleFilterControl.setValue('');
        this.applyWorkRoleFilter();
        setTimeout(() => {
          if (this.workRolePaginator) {
            this.workRoleDataSource.paginator = this.workRolePaginator;
          }
        });
      });
  }

  private buildTypeMapFromComps(fw: CompetencyFramework, comps: Competency[]) {
    this.competencyTypeMap.clear();
    this.competencyById.clear();
    const byId = new Map<string, Competency>();
    comps.forEach(c => {
      byId.set(c.id, c);
      this.competencyById.set(c.id, c);
    });
    const hasHierarchy = comps.some(c => c.parentId && byId.has(c.parentId));
    const taxonomyLevels = (fw.taxonomies || '')
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    for (const c of comps) {
      const idType = this.deriveTypeFromId(c.idNumber);
      if (idType !== 'Other') {
        this.competencyTypeMap.set(c.id, idType);
      } else if (hasHierarchy && taxonomyLevels.length > 0) {
        const depth = this.getDepth(c, byId);
        this.competencyTypeMap.set(c.id, taxonomyLevels[Math.min(depth, taxonomyLevels.length - 1)]);
      } else if (hasHierarchy) {
        const isRoot = !c.parentId || !byId.has(c.parentId);
        this.competencyTypeMap.set(c.id, isRoot ? 'Category' : 'Other');
      } else {
        this.competencyTypeMap.set(c.id, 'Other');
      }
    }
  }

  private deriveTypeFromId(idNumber: string): string {
    if (!idNumber) return 'Other';
    if (idNumber.includes('WRL')) return 'Work Role';
    if (/^[TKSA][\d-]/.test(idNumber)) {
      const prefixMap: Record<string, string> = { 'T': 'Task', 'K': 'Knowledge', 'S': 'Skill', 'A': 'Ability' };
      return prefixMap[idNumber.charAt(0)] || 'Other';
    }
    if (/^[A-Z]{2}-[A-Z]{3}-\d+$/.test(idNumber)) return 'Work Role';
    if (/^[A-Z]{3}$/.test(idNumber)) return 'Specialty Area';
    if (/^[A-Z]{2}$/.test(idNumber)) return 'Category';
    return 'Other';
  }

  private getDepth(comp: Competency, byId: Map<string, Competency>): number {
    let depth = 0;
    let current = comp;
    while (current.parentId && byId.has(current.parentId)) {
      depth++;
      current = byId.get(current.parentId);
    }
    return depth;
  }

  getWorkRoleCategory(workRole: Competency): string {
    let current = workRole;
    while (current.parentId && this.competencyById.has(current.parentId)) {
      current = this.competencyById.get(current.parentId);
    }
    if (current.id === workRole.id) return '';
    return current.shortName || current.idNumber || '';
  }

  getCompetencyType(comp: Competency): string {
    return this.competencyTypeMap.get(comp.id) || '';
  }

  // =============================================
  // Panel 1: Add Competencies — work role browser
  // =============================================

  isInPool(competencyId: string): boolean {
    return this.mselCompetencyList.some(mc => mc.competencyId === competencyId);
  }

  togglePoolItem(comp: Competency) {
    if (this.isInPool(comp.id)) {
      const mc = this.mselCompetencyList.find(m => m.competencyId === comp.id);
      if (mc) this.mselCompetencyDataService.delete(mc.id);
    } else {
      this.mselCompetencyDataService.add({
        mselId: this.msel.id,
        competencyId: comp.id,
      } as MselCompetency);
    }
  }

  onWorkRoleCategoryChange(category: string) {
    this.workRoleCategoryFilter = category;
    this.applyWorkRoleFilter();
  }

  applyWorkRoleFilter() {
    let filtered = [...this.frameworkWorkRoles];
    if (this.workRoleCategoryFilter) {
      filtered = filtered.filter(wr => this.getWorkRoleCategory(wr) === this.workRoleCategoryFilter);
    }
    if (this.workRoleFilterString) {
      const fs = this.workRoleFilterString.toLowerCase();
      filtered = filtered.filter(c =>
        c.idNumber?.toLowerCase().includes(fs) ||
        c.shortName?.toLowerCase().includes(fs) ||
        c.description?.toLowerCase().includes(fs));
    }
    // Competency search: filter work roles to those with matching children, auto-expand
    this.browserAutoExpandedIds.clear();
    if (this.competencySearchString) {
      const cs = this.competencySearchString.toLowerCase();
      filtered = filtered.filter(wr => {
        const children = this.getRelatedCompetencies(wr);
        return children.some(c =>
          c.idNumber?.toLowerCase().includes(cs) ||
          c.shortName?.toLowerCase().includes(cs) ||
          c.description?.toLowerCase().includes(cs));
      });
      for (const wr of filtered) {
        this.browserAutoExpandedIds.add(wr.id);
      }
    }
    filtered.sort((a, b) => (a.idNumber || '').localeCompare(b.idNumber || ''));
    this.workRoleDataSource.data = filtered;
    this.workRoleDataSource.sortingDataAccessor = (item: Competency, property: string) => {
      switch (property) {
        case 'category': return this.getWorkRoleCategory(item)?.toLowerCase() || '';
        default: return (item[property] || '').toString().toLowerCase();
      }
    };
    setTimeout(() => {
      if (this.workRoleSort) {
        this.workRoleDataSource.sort = this.workRoleSort;
      }
    });
  }

  // --- Browser expand: child TKSAs ---

  isBrowserExpanded(workRole: Competency): boolean {
    return this.browserExpandedId === workRole.id || this.browserAutoExpandedIds.has(workRole.id);
  }

  toggleBrowserExpand(workRole: Competency) {
    if (this.browserAutoExpandedIds.size > 0) {
      // In search mode: toggle individual within auto-expanded set
      if (this.browserAutoExpandedIds.has(workRole.id)) {
        this.browserAutoExpandedIds.delete(workRole.id);
      } else {
        this.browserAutoExpandedIds.add(workRole.id);
      }
      this.browserExpandedId = null;
    } else if (this.browserExpandedId === workRole.id) {
      this.browserExpandedId = null;
    } else {
      this.browserExpandedId = workRole.id;
      this.browserChildTypeFilter = '';
      this.buildBrowserChildTypes(workRole);
    }
  }

  private buildBrowserChildTypes(workRole: Competency) {
    const children = this.getRelatedCompetencies(workRole);
    const types = new Set<string>();
    for (const c of children) {
      const t = this.competencyTypeMap.get(c.id) || this.deriveTypeFromId(c.idNumber);
      if (t && t !== 'Other' && t !== 'Work Role') types.add(t);
    }
    this.browserChildTypes = [...types].sort();
  }

  private getRelatedCompetencies(comp: Competency): Competency[] {
    const resultMap = new Map<string, Competency>();
    for (const c of this.competencyById.values()) {
      if (c.parentId === comp.id) {
        resultMap.set(c.id, c);
      }
    }
    if (comp.relatedIdNumbers?.length > 0) {
      const relatedSet = new Set(comp.relatedIdNumbers);
      for (const c of this.competencyById.values()) {
        if (c.idNumber && relatedSet.has(c.idNumber) && c.id !== comp.id) {
          resultMap.set(c.id, c);
        }
      }
    }
    return [...resultMap.values()].sort((a, b) => (a.idNumber || '').localeCompare(b.idNumber || ''));
  }

  getFilteredChildren(workRole: Competency): Competency[] {
    let children = this.getRelatedCompetencies(workRole);
    if (this.browserChildTypeFilter) {
      children = children.filter(c => {
        const t = this.competencyTypeMap.get(c.id) || this.deriveTypeFromId(c.idNumber);
        return t === this.browserChildTypeFilter;
      });
    }
    if (this.competencySearchString) {
      const cs = this.competencySearchString.toLowerCase();
      children = children.filter(c =>
        c.idNumber?.toLowerCase().includes(cs) ||
        c.shortName?.toLowerCase().includes(cs) ||
        c.description?.toLowerCase().includes(cs));
    }
    return children;
  }

  onBrowserChildTypeChange(type: string) {
    this.browserChildTypeFilter = type;
  }

  selectAllChildren(workRole: Competency) {
    const children = this.getFilteredChildren(workRole);
    for (const c of children) {
      if (!this.isInPool(c.id)) {
        this.mselCompetencyDataService.add({
          mselId: this.msel.id,
          competencyId: c.id,
        } as MselCompetency);
      }
    }
  }

  deselectAllChildren(workRole: Competency) {
    const children = this.getFilteredChildren(workRole);
    for (const c of children) {
      const mc = this.mselCompetencyList.find(m => m.competencyId === c.id);
      if (mc) {
        this.mselCompetencyDataService.delete(mc.id);
      }
    }
  }

  allChildrenSelected(workRole: Competency): boolean {
    const children = this.getFilteredChildren(workRole);
    return children.length > 0 && children.every(c => this.isInPool(c.id));
  }

  someChildrenSelected(workRole: Competency): boolean {
    const children = this.getFilteredChildren(workRole);
    const selectedCount = children.filter(c => this.isInPool(c.id)).length;
    return selectedCount > 0 && selectedCount < children.length;
  }

  // =============================================
  // Panel 2: MSEL Competencies — pool
  // =============================================

  private buildPoolTypes() {
    const types = new Set<string>();
    const fwMap = new Map<string, string>();
    for (const mc of this.mselCompetencyList) {
      const t = this.competencyTypeMap.get(mc.competencyId) || this.deriveTypeFromId(mc.competency?.idNumber);
      if (t && t !== 'Other') types.add(t);
      const fwId = mc.competency?.competencyFrameworkId;
      if (fwId && !fwMap.has(fwId)) {
        const fw = this.frameworks.find(f => f.id === fwId);
        if (fw) fwMap.set(fwId, fw.name);
      }
    }
    this.competencyTypes = [...types].sort();
    this.poolFrameworks = [...fwMap.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }

  onTypeFilterChange(type: string) {
    this.typeFilter = type;
    this.applyFilter();
  }

  onFrameworkFilterChange(frameworkId: string) {
    this.frameworkFilter = frameworkId;
    this.applyFilter();
  }

  applyFilter() {
    let filtered = [...this.mselCompetencyList];
    if (this.frameworkFilter) {
      filtered = filtered.filter(mc => mc.competency?.competencyFrameworkId === this.frameworkFilter);
    }
    if (this.typeFilter) {
      filtered = filtered.filter(mc => {
        const t = this.competencyTypeMap.get(mc.competencyId) || this.deriveTypeFromId(mc.competency?.idNumber);
        return t === this.typeFilter;
      });
    }
    if (this.filterString) {
      const term = this.filterString.toLowerCase();
      filtered = filtered.filter(mc =>
        mc.competency?.idNumber?.toLowerCase().includes(term) ||
        mc.competency?.shortName?.toLowerCase().includes(term) ||
        mc.competency?.description?.toLowerCase().includes(term));
    }
    filtered.sort((a, b) => (a.competency?.idNumber || '').localeCompare(b.competency?.idNumber || ''));
    this.dataSource.data = filtered;
    this.dataSource.sortingDataAccessor = (item: MselCompetency, property: string) => {
      switch (property) {
        case 'idNumber': return item.competency?.idNumber?.toLowerCase() || '';
        case 'type': return this.getMselCompetencyType(item)?.toLowerCase() || '';
        case 'framework': return this.getFrameworkName(item)?.toLowerCase() || '';
        case 'shortName': return item.competency?.shortName?.toLowerCase() || '';
        case 'teams': return this.getTeamNames(item)?.toLowerCase() || '';
        case 'events': return this.getEventCount(item);
        default: return '';
      }
    };
    setTimeout(() => {
      if (this.competencyPaginator) {
        this.dataSource.paginator = this.competencyPaginator;
      }
      if (this.poolSort) {
        this.dataSource.sort = this.poolSort;
      }
    });
  }

  removeMselCompetency(mc: MselCompetency) {
    this.mselCompetencyDataService.delete(mc.id);
  }

  getMselCompetencyType(mc: MselCompetency): string {
    return this.competencyTypeMap.get(mc.competencyId) || this.deriveTypeFromId(mc.competency?.idNumber);
  }

  getFrameworkName(mc: MselCompetency): string {
    const fwId = mc.competency?.competencyFrameworkId;
    if (!fwId) return '';
    const fw = this.frameworks.find(f => f.id === fwId);
    return fw ? fw.name : '';
  }

  getEventCount(mc: MselCompetency): number {
    return 0; // TODO: count scenario events referencing this competency
  }

  // --- Team mapping ---

  private buildTeamsByCompetency() {
    this.teamsByCompetency.clear();
    for (const tc of this.teamCompetencyList) {
      const arr = this.teamsByCompetency.get(tc.competencyId) || [];
      arr.push(tc.teamId);
      this.teamsByCompetency.set(tc.competencyId, arr);
    }
  }

  getTeamNames(mc: MselCompetency): string {
    const teamIds = this.teamsByCompetency.get(mc.competencyId) || [];
    if (teamIds.length === 0) return '';
    return teamIds
      .map(tid => this.mselTeams.find(t => t.id === tid)?.shortName || '')
      .filter(n => n)
      .join(', ');
  }

  // --- Pool row expand: team assignment ---

  toggleExpand(mc: MselCompetency) {
    this.expandedCompetencyId = this.expandedCompetencyId === mc.competencyId ? null : mc.competencyId;
  }

  getAvailableTeams(mc: MselCompetency): Team[] {
    const assignedIds = this.teamsByCompetency.get(mc.competencyId) || [];
    return this.mselTeams.filter(t => !assignedIds.includes(t.id));
  }

  getAssignedTeams(mc: MselCompetency): Team[] {
    const assignedIds = this.teamsByCompetency.get(mc.competencyId) || [];
    return this.mselTeams.filter(t => assignedIds.includes(t.id));
  }

  addTeamToCompetency(mc: MselCompetency, team: Team) {
    this.teamCompetencyDataService.add({
      teamId: team.id,
      competencyId: mc.competencyId,
    } as TeamCompetency);
  }

  removeTeamFromCompetency(mc: MselCompetency, team: Team) {
    const tc = this.teamCompetencyList.find(t => t.teamId === team.id && t.competencyId === mc.competencyId);
    if (tc) {
      this.teamCompetencyDataService.delete(tc.id);
    }
  }

  // --- Select all / deselect all (pool) ---

  isAllSelected(): boolean {
    return this.selection.selected.length === this.dataSource.data.length && this.dataSource.data.length > 0;
  }

  toggleAllRows() {
    if (this.isAllSelected()) {
      this.selection.clear();
    } else {
      this.dataSource.data.forEach(row => this.selection.select(row));
    }
  }

  removeSelected() {
    const selected = this.selection.selected;
    if (selected.length === 0) return;
    this.dialogService.confirm(
      'Remove Selected',
      `Remove ${selected.length} competenc${selected.length === 1 ? 'y' : 'ies'} from this MSEL?`
    ).subscribe(result => {
      if (result['confirm']) {
        for (const mc of selected) {
          this.mselCompetencyDataService.delete(mc.id);
        }
        this.selection.clear();
      }
    });
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
