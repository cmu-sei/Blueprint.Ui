// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, Input, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { MatTableDataSource, MatTable } from '@angular/material/table';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { Subject, Subscription } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';
import {
  Competency,
  CompetencyFramework,
  CompetencyFrameworkService,
  ProficiencyScaleService,
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
import { AdminCompetencyDetailDialogComponent } from '../admin-competency-detail-dialog/admin-competency-detail-dialog.component';
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
  displayedColumns: string[] = ['action', 'name', 'version', 'source', 'scale', 'description'];
  private scaleMap = new Map<string, string>();
  private unsubscribe$ = new Subject();
  isExpansionDetailRow = (i: number, row: Object) => (row as CompetencyFramework).id === this.expandedElementId;
  expandedElementId = '';
  // Competency data sources
  expandedCompetencies: Competency[] = [];
  competencyDataSource = new MatTableDataSource<Competency>([]);
  competencyDisplayedColumns: string[] = ['action', 'idNumber', 'type', 'shortName', 'description'];
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
  workRoleFilterControl = new UntypedFormControl();
  workRoleFilterString = '';
  workRoleSort: Sort = { active: 'idNumber', direction: 'asc' };
  workRoleCategories: string[] = [];
  selectedWorkRoleCategory = '';
  // Inline related competency management
  expandedCompetencyId = '';
  availableRelatedDataSource = new MatTableDataSource<Competency>([]);
  relatedDataSource = new MatTableDataSource<Competency>([]);
  availableRelatedColumns: string[] = ['name', 'view', 'add'];
  relatedColumns: string[] = ['name', 'view', 'remove'];
  relatedFilterControl = new UntypedFormControl();
  relatedSideFilterControl = new UntypedFormControl();
  availableTypeFilter = '';
  relatedTypeFilter = '';
  availableTypes: string[] = [];
  relatedTypes: string[] = [];
  @ViewChild('availablePaginator') availablePaginator: MatPaginator;
  @ViewChild('relatedPaginator') relatedPaginator: MatPaginator;
  private expandedComp: Competency = null;
  private currentRelatedIdNumbers: string[] = [];
  private relatedFilterSub: Subscription;
  private relatedSideFilterSub: Subscription;

  importing = false;
  importError = '';

  constructor(
    private competencyFrameworkDataService: CompetencyFrameworkDataService,
    private competencyFrameworkQuery: CompetencyFrameworkQuery,
    private competencyFrameworkService: CompetencyFrameworkService,
    private proficiencyScaleService: ProficiencyScaleService,
    public dialog: MatDialog,
    public dialogService: DialogService
  ) {
    this.proficiencyScaleService.getProficiencyScales()
      .pipe(take(1))
      .subscribe(scales => {
        scales.forEach(s => this.scaleMap.set(s.id, s.name));
      });
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
      minWidth: '500px',
      maxWidth: '90vw',
      width: '700px',
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
    this.competencyFrameworkService.checkCanDeleteCompetencyFramework(competencyFramework.id)
      .pipe(take(1))
      .subscribe({
        next: (check) => {
          if (check.CanDelete) {
            this.dialogService
              .confirm(
                'Delete Competency Framework',
                'Are you sure that you want to delete ' + competencyFramework.name + '? This will delete ' +
                (competencyFramework.Competencies?.length || 0) + ' competencies.'
              )
              .subscribe((result) => {
                if (result['confirm']) {
                  this.competencyFrameworkDataService.delete(competencyFramework.id);
                  this.expandedElementId = '';
                }
              });
          } else {
            let message = `Cannot delete ${competencyFramework.name}. It is being used by ${check.AffectedMsels.length} MSEL(s):\n\n`;
            check.AffectedMsels.slice(0, 10).forEach(m => {
              message += `• ${m.Name}\n`;
            });
            if (check.AffectedMsels.length > 10) {
              message += `• ... and ${check.AffectedMsels.length - 10} more\n`;
            }
            message += '\nRemove competencies from these MSELs before deleting the framework.';
            this.dialogService.message(
              'Cannot Delete Framework',
              message,
              'Close'
            );
          }
        },
        error: (err) => {
          this.importError = 'Check failed: ' + (err.error?.title || err.message || 'Unknown error');
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
      case 'scale':
        const aScale = (this.scaleMap.get(a.defaultProficiencyScaleId) || '').toLowerCase();
        const bScale = (this.scaleMap.get(b.defaultProficiencyScaleId) || '').toLowerCase();
        return ((aScale < bScale ? -1 : aScale > bScale ? 1 : 0) * (isAsc ? 1 : -1));
      case 'description':
        return (((a.description || '').toLowerCase() < (b.description || '').toLowerCase() ? -1 : 1) * (isAsc ? 1 : -1));
      default:
        return 0;
    }
  }

  rowClicked(row: CompetencyFramework) {
    if (this.expandedElementId === row.id) {
      this.collapseCompetencyDetail();
      this.expandedElementId = '';
      this.expandedCompetencies = [];
      this.competencyDataSource.data = [];
      this.workRoles = [];
      this.workRoleDataSource.data = [];
    } else {
      this.expandedElementId = row.id;
      this.loadCompetencies(row.id);
    }
    this.competencyFrameworkTable.renderRows();
  }

  getScaleName(fw: CompetencyFramework): string {
    return this.scaleMap.get(fw.defaultProficiencyScaleId) || '';
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
    this.selectedWorkRoleCategory = '';
    this.competencyFrameworkService.getCompetencyFramework(frameworkId)
      .pipe(take(1))
      .subscribe(fw => {
        const allComps = fw.competencies || [];
        this.buildTypeMap(fw);
        // Separate work roles from other competencies
        this.workRoles = allComps.filter(c => this.competencyTypeMap.get(c.id) === 'Work Role');
        this.expandedCompetencies = allComps.filter(c => this.competencyTypeMap.get(c.id) !== 'Work Role');
        this.workRoleCategories = [...new Set(this.workRoles.map(wr => this.getWorkRoleCategory(wr)).filter(c => c))].sort();
        this.applyWorkRoleFilter();
        this.applyCompetencyFilter();
        // Refresh expanded row's related data with updated inverse relationships
        if (this.expandedCompetencyId && this.competencyById.has(this.expandedCompetencyId)) {
          const fresh = this.competencyById.get(this.expandedCompetencyId);
          this.expandedComp = fresh;
          this.currentRelatedIdNumbers = [...(fresh.relatedIdNumbers || [])];

          this.updateRelatedDataSources();
        }
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

  onWorkRoleCategoryFilterChange(category: string): void {
    this.selectedWorkRoleCategory = category;
    this.applyWorkRoleFilter();
  }

  applyWorkRoleFilter() {
    let filtered = [...this.workRoles];
    if (this.selectedWorkRoleCategory) {
      filtered = filtered.filter(c => this.getWorkRoleCategory(c) === this.selectedWorkRoleCategory);
    }
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

  toggleCompetencyExpand(comp: Competency): void {
    if (this.expandedCompetencyId === comp.id) {
      this.collapseCompetencyDetail();
    } else {
      this.expandCompetencyDetail(comp);
    }
  }

  private expandCompetencyDetail(comp: Competency): void {
    this.collapseCompetencyDetail();
    this.expandedCompetencyId = comp.id;
    this.expandedComp = comp;
    this.currentRelatedIdNumbers = [...(comp.relatedIdNumbers || [])];
    this.relatedFilterControl.setValue('');
    this.relatedSideFilterControl.setValue('');
    this.availableTypeFilter = '';
    this.relatedTypeFilter = '';
    this.updateRelatedDataSources();
    this.availableTypes = [...new Set(
      this.availableRelatedDataSource.data.map(c => this.competencyTypeMap.get(c.id) || '').filter(t => t)
    )].sort();
    this.relatedTypes = [...new Set(
      this.relatedDataSource.data.map(c => this.competencyTypeMap.get(c.id) || '').filter(t => t)
    )].sort();
    this.availableRelatedDataSource.filterPredicate = (c: Competency, filter: string): boolean => {
      if (this.availableTypeFilter) {
        const type = this.competencyTypeMap?.get(c.id) || '';
        if (type !== this.availableTypeFilter) return false;
      }
      const term = (this.relatedFilterControl.value || '').toLowerCase();
      if (!term) return true;
      return c.idNumber?.toLowerCase().includes(term) ||
        c.shortName?.toLowerCase().includes(term) ||
        c.description?.toLowerCase().includes(term);
    };
    this.relatedDataSource.filterPredicate = (c: Competency, filter: string): boolean => {
      if (this.relatedTypeFilter) {
        const type = this.competencyTypeMap?.get(c.id) || '';
        if (type !== this.relatedTypeFilter) return false;
      }
      const term = (this.relatedSideFilterControl.value || '').toLowerCase();
      if (!term) return true;
      return c.idNumber?.toLowerCase().includes(term) ||
        c.shortName?.toLowerCase().includes(term) ||
        c.description?.toLowerCase().includes(term);
    };
    this.relatedFilterSub?.unsubscribe();
    this.relatedFilterSub = this.relatedFilterControl.valueChanges.subscribe(() => {
      this.applyAvailableFilter();
    });
    this.relatedSideFilterSub?.unsubscribe();
    this.relatedSideFilterSub = this.relatedSideFilterControl.valueChanges.subscribe(() => {
      this.applyRelatedFilter();
    });
    setTimeout(() => {
      if (this.availablePaginator) {
        this.availableRelatedDataSource.paginator = this.availablePaginator;
      }
      if (this.relatedPaginator) {
        this.relatedDataSource.paginator = this.relatedPaginator;
      }
    });
  }

  private collapseCompetencyDetail(): void {
    this.expandedCompetencyId = '';
    this.expandedComp = null;
  }

  private updateRelatedDataSources(): void {
    const relatedSet = new Set(this.currentRelatedIdNumbers);
    const selfId = this.expandedComp?.idNumber;
    const sortByIdNumber = (a: Competency, b: Competency) =>
      (a.idNumber || '').localeCompare(b.idNumber || '');
    this.relatedDataSource.data = [...this.competencyById.values()]
      .filter(c => relatedSet.has(c.idNumber))
      .sort(sortByIdNumber);
    this.availableRelatedDataSource.data = [...this.competencyById.values()]
      .filter(c => c.idNumber !== selfId && !relatedSet.has(c.idNumber))
      .sort(sortByIdNumber);
  }

  onAvailableTypeFilterChange(type: string): void {
    this.availableTypeFilter = type;
    this.applyAvailableFilter();
  }

  private applyAvailableFilter(): void {
    const term = (this.relatedFilterControl.value || '').toLowerCase();
    // Trigger re-evaluation — use term or type or space to force filter
    this.availableRelatedDataSource.filter = term || this.availableTypeFilter || ' ';
    if (!term && !this.availableTypeFilter) {
      this.availableRelatedDataSource.filter = '';
    }
  }

  onRelatedTypeFilterChange(type: string): void {
    this.relatedTypeFilter = type;
    this.applyRelatedFilter();
  }

  private applyRelatedFilter(): void {
    const term = (this.relatedSideFilterControl.value || '').toLowerCase();
    this.relatedDataSource.filter = term || this.relatedTypeFilter || ' ';
    if (!term && !this.relatedTypeFilter) {
      this.relatedDataSource.filter = '';
    }
  }

  addRelatedCompetency(comp: Competency): void {
    if (!this.currentRelatedIdNumbers.includes(comp.idNumber)) {
      this.currentRelatedIdNumbers.push(comp.idNumber);
      this.updateRelatedDataSources();
      this.saveCurrentRelated();
    }
  }

  removeRelatedCompetency(comp: Competency): void {
    this.currentRelatedIdNumbers = this.currentRelatedIdNumbers.filter(id => id !== comp.idNumber);
    this.updateRelatedDataSources();
    this.saveCurrentRelated();
  }

  private saveCurrentRelated(): void {
    if (this.expandedComp) {
      const updated = { ...this.expandedComp, relatedIdNumbers: this.currentRelatedIdNumbers };
      this.saveCompetency(updated);
    }
  }

  viewCompetencyDetail(comp: Competency): void {
    this.dialog.open(AdminCompetencyDetailDialogComponent, {
      width: '600px',
      data: { competency: comp, competencyTypeMap: this.competencyTypeMap },
    });
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
    // Build available parents: all competencies in this framework except self
    const availableParents = [...this.competencyById.values()]
      .filter(c => c.id !== competency.id)
      .map(c => ({ id: c.id, label: (c.idNumber ? c.idNumber + ' — ' : '') + (c.shortName || '') }))
      .sort((a, b) => a.label.localeCompare(b.label));
    const dialogRef = this.dialog.open(AdminCompetencyEditDialogComponent, {
      minWidth: '500px',
      maxWidth: '90vw',
      width: '600px',
      data: {
        competency: { ...competency },
        typeHint: typeHint || '',
        availableTypes: [...new Set(['Category', 'Work Role', 'Task', 'Knowledge', 'Skill', 'Ability', ...this.competencyTypes])],
        availableParents,
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
