// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, Input, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { MatTableDataSource, MatTable } from '@angular/material/table';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { Subject } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';
import {
  Competency,
  CompetencyFramework,
  CompetencyFrameworkService,
} from 'src/app/generated/blueprint.api';
import { Sort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { CompetencyFrameworkDataService } from 'src/app/data/competency-framework/competency-framework-data.service';
import { CompetencyFrameworkQuery } from 'src/app/data/competency-framework/competency-framework.query';
import { MatDialog } from '@angular/material/dialog';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { AdminCompetencyFrameworkEditDialogComponent } from '../admin-competency-framework-edit-dialog/admin-competency-framework-edit-dialog.component';
import { AdminCompetencyFrameworkImportDialogComponent, ImportResult } from '../admin-competency-framework-import-dialog/admin-competency-framework-import-dialog.component';
import { AdminCompetencyEditDialogComponent } from '../admin-competency-edit-dialog/admin-competency-edit-dialog.component';
import { v4 as uuidv4 } from 'uuid';

@Component({
  selector: 'app-admin-competency-frameworks',
  templateUrl: './admin-competency-frameworks.component.html',
  styleUrls: ['./admin-competency-frameworks.component.scss'],
  animations: [
    trigger('detailExpand', [
      state('collapsed', style({ height: '0px', minHeight: '0', visibility: 'hidden' })),
      state('expanded', style({ height: '*', visibility: 'visible' })),
      transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
    ]),
    trigger('subDetailExpand', [
      state('collapsed', style({ height: '0px', minHeight: '0', visibility: 'hidden' })),
      state('expanded', style({ height: '*', visibility: 'visible' })),
      transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
    ]),
  ],
  standalone: false
})
export class AdminCompetencyFrameworksComponent implements OnDestroy, AfterViewInit {
  @Input() loggedInUserId: string;
  @Input() canEdit: boolean;
  @ViewChild('competencyFrameworkTable', { static: false }) competencyFrameworkTable: MatTable<any>;
  @ViewChild('paginator') paginator: MatPaginator;
  @ViewChild('competencyPaginator') competencyPaginator: MatPaginator;
  @ViewChild('workRolePaginator') workRolePaginator: MatPaginator;
  adminCompetencyFrameworks: CompetencyFramework[] = [];
  filterControl = new UntypedFormControl();
  filterString = '';
  sort: Sort = { active: 'name', direction: 'asc' };
  competencyFrameworkDataSource = new MatTableDataSource<CompetencyFramework>(new Array<CompetencyFramework>());
  displayedColumns: string[] = ['action', 'name', 'version', 'source', 'description'];
  private unsubscribe$ = new Subject();
  isExpansionDetailRow = (i: number, row: Object) => (row as CompetencyFramework).id === this.expandedElementId;
  expandedElementId = '';
  // Competency data sources
  expandedCompetencies: Competency[] = [];
  competencyDataSource = new MatTableDataSource<Competency>([]);
  competencyDisplayedColumns: string[] = ['action', 'idNumber', 'type', 'shortName', 'description'];
  expandedCompetencyId = '';
  competencyFilterControl = new UntypedFormControl();
  competencyFilterString = '';
  competencySort: Sort = { active: 'idNumber', direction: 'asc' };
  competencyTypes: string[] = [];
  selectedCompetencyType = '';
  private taxonomyLevels: string[] = [];
  private competencyTypeMap = new Map<string, string>();
  private competencyById = new Map<string, Competency>();
  // Work role data sources
  workRoles: Competency[] = [];
  workRoleDataSource = new MatTableDataSource<Competency>([]);
  workRoleDisplayedColumns: string[] = ['action', 'idNumber', 'shortName', 'category', 'description'];
  expandedWorkRoleId = '';
  workRoleFilterControl = new UntypedFormControl();
  workRoleFilterString = '';
  workRoleSort: Sort = { active: 'idNumber', direction: 'asc' };

  importing = false;
  importError = '';

  constructor(
    private competencyFrameworkDataService: CompetencyFrameworkDataService,
    private competencyFrameworkQuery: CompetencyFrameworkQuery,
    private competencyFrameworkService: CompetencyFrameworkService,
    public dialog: MatDialog,
    public dialogService: DialogService
  ) {
    this.competencyFrameworkQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(competencyFrameworks => {
      this.adminCompetencyFrameworks = competencyFrameworks;
      this.sortChanged(this.sort);
    });
    this.filterControl.valueChanges
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((term) => {
        this.filterString = term;
        this.sortChanged(this.sort);
      });
    this.competencyFilterControl.valueChanges
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((term) => {
        this.competencyFilterString = term;
        this.applyCompetencyFilter();
      });
    this.workRoleFilterControl.valueChanges
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((term) => {
        this.workRoleFilterString = term;
        this.applyWorkRoleFilter();
      });
  }

  getSortedCompetencyFrameworks(competencyFrameworks: CompetencyFramework[]) {
    if (competencyFrameworks) {
      competencyFrameworks.sort((a, b) => this.sortCompetencyFrameworks(a, b, this.sort.active, this.sort.direction));
    }
    return competencyFrameworks;
  }

  addOrEditCompetencyFramework(competencyFramework: CompetencyFramework) {
    if (!competencyFramework) {
      competencyFramework = {};
    }
    const dialogRef = this.dialog.open(AdminCompetencyFrameworkEditDialogComponent, {
      minWidth: '400px',
      maxWidth: '90vw',
      width: 'auto',
      data: {
        competencyFramework: { ...competencyFramework },
      },
    });
    dialogRef.componentInstance.editComplete.subscribe((result) => {
      if (result.saveChanges && result.competencyFramework) {
        this.saveCompetencyFramework(result.competencyFramework);
      }
      dialogRef.close();
    });
  }

  saveCompetencyFramework(competencyFramework: CompetencyFramework) {
    if (competencyFramework.id) {
      this.competencyFrameworkDataService.update(competencyFramework);
    } else {
      competencyFramework.id = uuidv4();
      this.competencyFrameworkDataService.add(competencyFramework);
    }
  }

  deleteCompetencyFramework(competencyFramework: CompetencyFramework): void {
    this.dialogService
      .confirm(
        'Delete Competency Framework',
        'Are you sure that you want to delete ' + competencyFramework.name + '? This will also delete all its competencies.'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.competencyFrameworkDataService.delete(competencyFramework.id);
          this.expandedElementId = '';
        }
      });
  }

  importFramework(): void {
    const dialogRef = this.dialog.open(AdminCompetencyFrameworkImportDialogComponent, {
      width: '600px',
      maxWidth: '90vw',
    });
    dialogRef.componentInstance.importComplete.subscribe((result: ImportResult | null) => {
      if (result) {
        this.importing = true;
        this.importError = '';
        if (result.type === 'csv' && result.file) {
          this.competencyFrameworkService.importCompetencyFramework(result.source, result.version, result.file)
            .pipe(take(1))
            .subscribe({
              next: (created) => {
                this.importing = false;
                this.competencyFrameworkDataService.updateStore(created);
              },
              error: (err) => {
                this.importing = false;
                this.importError = 'Import failed: ' + (err.error?.title || err.message || 'Unknown error');
              }
            });
        } else if (result.type === 'json' && result.file) {
          this.competencyFrameworkService.importCompetencyFrameworkJson(result.file)
            .pipe(take(1))
            .subscribe({
              next: (created) => {
                this.importing = false;
                this.competencyFrameworkDataService.updateStore(created);
              },
              error: (err) => {
                this.importing = false;
                this.importError = 'Import failed: ' + (err.error?.title || err.message || 'Unknown error');
              }
            });
        } else if (result.type === 'parsed' && result.framework) {
          this.competencyFrameworkService.createCompetencyFramework(result.framework)
            .pipe(take(1))
            .subscribe({
              next: (created) => {
                this.importing = false;
                this.competencyFrameworkDataService.updateStore(created);
              },
              error: (err) => {
                this.importing = false;
                this.importError = 'Import failed: ' + (err.error?.title || err.message || 'Unknown error');
              }
            });
        }
      }
      dialogRef.close();
    });
  }

  sortChanged(sort: Sort) {
    this.sort = sort;
    this.competencyFrameworkDataSource.data = this.getSortedCompetencyFrameworks(this.getFilteredCompetencyFrameworks(this.adminCompetencyFrameworks));
  }

  ngAfterViewInit() {
    this.competencyFrameworkDataSource.paginator = this.paginator;
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }

  getFilteredCompetencyFrameworks(competencyFrameworks: CompetencyFramework[]): CompetencyFramework[] {
    let filtered: CompetencyFramework[] = [];
    if (competencyFrameworks) {
      competencyFrameworks.forEach(cf => {
        filtered.push({ ...cf });
      });
      if (filtered && filtered.length > 0 && this.filterString) {
        const filterString = this.filterString?.toLowerCase();
        filtered = filtered.filter(cf =>
          cf.name?.toLowerCase().includes(filterString) ||
          cf.source?.toLowerCase().includes(filterString) ||
          cf.version?.toLowerCase().includes(filterString));
      }
    }
    return filtered;
  }

  private sortCompetencyFrameworks(
    a: CompetencyFramework,
    b: CompetencyFramework,
    column: string,
    direction: string
  ) {
    const isAsc = direction !== 'desc';
    switch (column) {
      case 'name':
        return (((a.name || '').toLowerCase() < (b.name || '').toLowerCase() ? -1 : 1) * (isAsc ? 1 : -1));
      case 'version':
        return (((a.version || '').toLowerCase() < (b.version || '').toLowerCase() ? -1 : 1) * (isAsc ? 1 : -1));
      case 'source':
        return (((a.source || '').toLowerCase() < (b.source || '').toLowerCase() ? -1 : 1) * (isAsc ? 1 : -1));
      case 'description':
        return (((a.description || '').toLowerCase() < (b.description || '').toLowerCase() ? -1 : 1) * (isAsc ? 1 : -1));
      default:
        return 0;
    }
  }

  rowClicked(row: CompetencyFramework) {
    if (this.expandedElementId === row.id) {
      this.expandedElementId = '';
      this.expandedCompetencies = [];
      this.competencyDataSource.data = [];
      this.workRoles = [];
      this.workRoleDataSource.data = [];
      this.expandedCompetencyId = '';
      this.expandedWorkRoleId = '';
    } else {
      this.expandedElementId = row.id;
      this.loadCompetencies(row.id);
    }
    this.competencyFrameworkTable.renderRows();
  }

  getRowClass(id: string) {
    return this.expandedElementId === id
      ? 'element-row element-row-expanded'
      : 'element-row element-row-not-expanded';
  }

  // --- Competencies ---

  loadCompetencies(frameworkId: string) {
    this.competencyFilterControl.setValue('');
    this.workRoleFilterControl.setValue('');
    this.selectedCompetencyType = '';
    this.competencyFrameworkService.getCompetencyFramework(frameworkId)
      .pipe(take(1))
      .subscribe(fw => {
        const allComps = fw.competencies || [];
        this.buildTypeMap(fw);
        // Separate work roles from other competencies
        this.workRoles = allComps.filter(c => this.competencyTypeMap.get(c.id) === 'Work Role');
        this.expandedCompetencies = allComps.filter(c => this.competencyTypeMap.get(c.id) !== 'Work Role');
        this.applyWorkRoleFilter();
        this.applyCompetencyFilter();
        setTimeout(() => {
          if (this.competencyPaginator) {
            this.competencyDataSource.paginator = this.competencyPaginator;
          }
          if (this.workRolePaginator) {
            this.workRoleDataSource.paginator = this.workRolePaginator;
          }
        });
      });
  }

  private buildTypeMap(fw: CompetencyFramework) {
    this.competencyTypeMap.clear();
    this.competencyById.clear();
    const comps = fw.competencies || [];
    const byId = new Map<string, Competency>();
    comps.forEach(c => {
      byId.set(c.id, c);
      this.competencyById.set(c.id, c);
    });

    const hasHierarchy = comps.some(c => c.parentId && byId.has(c.parentId));

    // Build set of IDs that participate in the hierarchy
    const parentIds = new Set<string>();
    const childIds = new Set<string>();
    if (hasHierarchy) {
      for (const c of comps) {
        if (c.parentId && byId.has(c.parentId)) {
          childIds.add(c.id);
          parentIds.add(c.parentId);
        }
      }
    }

    this.taxonomyLevels = (fw.taxonomies || '')
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    for (const c of comps) {
      // Always try ID-pattern first — it's the most reliable signal
      const idType = this.deriveTypeFromId(c.idNumber);
      if (idType !== 'Other') {
        this.competencyTypeMap.set(c.id, idType);
      } else if (hasHierarchy && this.taxonomyLevels.length > 0) {
        // Fall back to taxonomy depth for items without a recognizable ID pattern
        const depth = this.getDepth(c, byId);
        this.competencyTypeMap.set(c.id, this.taxonomyLevels[Math.min(depth, this.taxonomyLevels.length - 1)]);
      } else if (hasHierarchy) {
        // No taxonomy labels, no known ID — use hierarchy position
        const isRoot = !c.parentId || !byId.has(c.parentId);
        this.competencyTypeMap.set(c.id, isRoot ? 'Category' : 'Other');
      } else {
        this.competencyTypeMap.set(c.id, 'Other');
      }
    }

    // Build sorted unique types list (exclude Work Role — shown in separate panel)
    this.competencyTypes = [...new Set(this.competencyTypeMap.values())].filter(t => t !== 'Work Role').sort();
  }

  private deriveTypeFromId(idNumber: string): string {
    if (!idNumber) return 'Other';
    // DCWF/NICE 2.x: WRL in ID → Work Role
    if (idNumber.includes('WRL')) return 'Work Role';
    // TKSA prefix: starts with T/K/S/A followed by digit or dash (T0001, T-401, K0055, etc.)
    if (/^[TKSA][\d-]/.test(idNumber)) {
      const prefixMap: Record<string, string> = {
        'T': 'Task', 'K': 'Knowledge', 'S': 'Skill', 'A': 'Ability',
      };
      return prefixMap[idNumber.charAt(0)] || 'Other';
    }
    // NICE 2017: XX-YYY-NNN pattern (3 hyphenated parts) → Work Role
    if (/^[A-Z]{2}-[A-Z]{3}-\d+$/.test(idNumber)) return 'Work Role';
    // 3-letter code → Specialty Area (e.g. DEV, MGT, ASA)
    if (/^[A-Z]{3}$/.test(idNumber)) return 'Specialty Area';
    // 2-letter code → Category (e.g. PD, IO, AN)
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

  getCompetencyType(comp: Competency): string {
    return this.competencyTypeMap.get(comp.id) || '';
  }

  onTypeFilterChange(type: string) {
    this.selectedCompetencyType = type;
    this.applyCompetencyFilter();
  }

  competencySortChanged(sort: Sort) {
    this.competencySort = sort;
    this.applyCompetencyFilter();
  }

  applyCompetencyFilter() {
    let filtered = [...this.expandedCompetencies];
    if (this.selectedCompetencyType) {
      filtered = filtered.filter(c => this.competencyTypeMap.get(c.id) === this.selectedCompetencyType);
    }
    if (this.competencyFilterString) {
      const fs = this.competencyFilterString.toLowerCase();
      filtered = filtered.filter(c =>
        c.idNumber?.toLowerCase().includes(fs) ||
        c.shortName?.toLowerCase().includes(fs) ||
        c.description?.toLowerCase().includes(fs));
    }
    const col = this.competencySort.active;
    const isAsc = this.competencySort.direction !== 'desc';
    filtered.sort((a, b) => {
      let aVal: string, bVal: string;
      if (col === 'type') {
        aVal = (this.competencyTypeMap.get(a.id) || '').toLowerCase();
        bVal = (this.competencyTypeMap.get(b.id) || '').toLowerCase();
      } else {
        aVal = (a[col] || '').toString().toLowerCase();
        bVal = (b[col] || '').toString().toLowerCase();
      }
      return (aVal < bVal ? -1 : aVal > bVal ? 1 : 0) * (isAsc ? 1 : -1);
    });
    this.competencyDataSource.data = filtered;
  }

  getWorkRoleCategory(workRole: Competency): string {
    let current = workRole;
    while (current.parentId && this.competencyById.has(current.parentId)) {
      current = this.competencyById.get(current.parentId);
    }
    if (current.id === workRole.id) return '';
    return current.shortName || current.idNumber || '';
  }

  applyWorkRoleFilter() {
    let filtered = [...this.workRoles];
    if (this.workRoleFilterString) {
      const fs = this.workRoleFilterString.toLowerCase();
      filtered = filtered.filter(c =>
        c.idNumber?.toLowerCase().includes(fs) ||
        c.shortName?.toLowerCase().includes(fs) ||
        c.description?.toLowerCase().includes(fs));
    }
    const col = this.workRoleSort.active;
    const isAsc = this.workRoleSort.direction !== 'desc';
    filtered.sort((a, b) => {
      let aVal: string, bVal: string;
      if (col === 'category') {
        aVal = this.getWorkRoleCategory(a).toLowerCase();
        bVal = this.getWorkRoleCategory(b).toLowerCase();
      } else {
        aVal = (a[col] || '').toString().toLowerCase();
        bVal = (b[col] || '').toString().toLowerCase();
      }
      return (aVal < bVal ? -1 : aVal > bVal ? 1 : 0) * (isAsc ? 1 : -1);
    });
    this.workRoleDataSource.data = filtered;
  }

  workRoleSortChanged(sort: Sort) {
    this.workRoleSort = sort;
    this.applyWorkRoleFilter();
  }

  toggleWorkRoleExpand(row: Competency) {
    this.expandedWorkRoleId = this.expandedWorkRoleId === row.id ? '' : row.id;
  }

  toggleCompetencyExpand(row: Competency) {
    this.expandedCompetencyId = this.expandedCompetencyId === row.id ? '' : row.id;
  }

  getRelatedCompetencies(comp: Competency): Competency[] {
    if (!comp.relatedIdNumbers || comp.relatedIdNumbers.length === 0) return [];
    const relatedSet = new Set(comp.relatedIdNumbers);
    return [...this.competencyById.values()].filter(c => relatedSet.has(c.idNumber));
  }

  getChildCompetencies(comp: Competency): Competency[] {
    return [...this.competencyById.values()].filter(c => c.parentId === comp.id);
  }

  addOrEditCompetency(competency: Competency, typeHint?: string) {
    if (!competency) {
      competency = { competencyFrameworkId: this.expandedElementId };
    }
    const dialogRef = this.dialog.open(AdminCompetencyEditDialogComponent, {
      minWidth: '500px',
      maxWidth: '90vw',
      width: '600px',
      data: {
        competency: { ...competency },
        allCompetencies: [...this.workRoles, ...this.expandedCompetencies],
        typeHint: typeHint || '',
        availableTypes: ['Work Role', ...this.competencyTypes],
      },
    });
    dialogRef.componentInstance.editComplete.subscribe((result: any) => {
      if (result.saveChanges && result.competency) {
        this.saveCompetency(result.competency);
      }
      dialogRef.close();
    });
  }

  saveCompetency(competency: Competency) {
    if (competency.id) {
      this.competencyFrameworkService.updateCompetency(competency.id, competency)
        .pipe(take(1))
        .subscribe({
          next: () => this.loadCompetencies(this.expandedElementId),
          error: (err: any) => {
            this.importError = 'Save failed: ' + (err.error?.title || err.message || 'Unknown error');
          }
        });
    } else {
      this.competencyFrameworkService.createCompetency(this.expandedElementId, competency)
        .pipe(take(1))
        .subscribe({
          next: () => this.loadCompetencies(this.expandedElementId),
          error: (err: any) => {
            this.importError = 'Save failed: ' + (err.error?.title || err.message || 'Unknown error');
          }
        });
    }
  }

  deleteCompetency(competency: Competency): void {
    this.dialogService
      .confirm(
        'Delete Competency',
        'Are you sure you want to delete ' + (competency.idNumber || competency.shortName) + '?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.competencyFrameworkService.deleteCompetency(competency.id)
            .pipe(take(1))
            .subscribe({
              next: () => this.loadCompetencies(this.expandedElementId),
              error: (err: any) => {
                this.importError = 'Delete failed: ' + (err.error?.title || err.message || 'Unknown error');
              }
            });
        }
      });
  }

}
