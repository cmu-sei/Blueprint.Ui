// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, ElementRef, Input, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { MatTableDataSource, MatTable } from '@angular/material/table';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { Observable, Subject, Subscription } from 'rxjs';
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
import { CrucibleDialogService } from '@cmusei/crucible-common';
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
  private frameworkDeleteCheckMap = new Map<string, { canDelete: boolean; inUseByMsels: string[] }>();
  private unsubscribe$ = new Subject();
  isExpansionDetailRow = (i: number, row: Object) => (row as CompetencyFramework).id === this.expandedElementId;
  expandedElementId = '';
  loadingCompetencies = false;
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
  // Rows for the two panels above, held aside until their paginators exist.
  private availableRelatedRows: Competency[] = [];
  private relatedRows: Competency[] = [];
  // False for the frame between opening the panel and publishing its rows, so the
  // empty-state messages do not flash.
  relatedRowsReady = false;
  // True while an add/remove of a related competency is being saved. Blocks a second
  // one until the first lands, see saveCurrentRelated.
  savingRelated = false;
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
  @ViewChild('jsonInput') jsonInput: ElementRef<HTMLInputElement>;
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
    public dialogService: CrucibleDialogService
  ) {
    this.proficiencyScaleService.getProficiencyScales()
      .pipe(take(1))
      .subscribe(scales => {
        scales.forEach(s => this.scaleMap.set(s.id, s.name));
      });
    this.competencyFrameworkQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(competencyFrameworks => {
      this.adminCompetencyFrameworks = competencyFrameworks;
      this.checkAllFrameworksForDelete();
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

  checkAllFrameworksForDelete(): void {
    this.adminCompetencyFrameworks.forEach(fw => {
      this.competencyFrameworkService.checkCanDeleteCompetencyFramework(fw.id)
        .pipe(take(1))
        .subscribe({
          next: (check) => {
            this.frameworkDeleteCheckMap.set(fw.id, {
              canDelete: check.canDelete,
              inUseByMsels: check.affectedMsels?.map(m => m.name) || []
            });
          },
          error: () => {
            this.frameworkDeleteCheckMap.set(fw.id, { canDelete: true, inUseByMsels: [] });
          }
        });
    });
  }

  canDeleteFramework(frameworkId: string): boolean {
    return this.frameworkDeleteCheckMap.get(frameworkId)?.canDelete ?? true;
  }

  getDeleteTooltip(frameworkId: string): string {
    const check = this.frameworkDeleteCheckMap.get(frameworkId);
    if (!check || check.canDelete) {
      return 'Delete framework';
    }
    const mselCount = check.inUseByMsels.length;
    const mselList = check.inUseByMsels.slice(0, 3).join(', ');
    const more = mselCount > 3 ? ` and ${mselCount - 3} more` : '';
    return `In use by ${mselCount} MSEL(s): ${mselList}${more}`;
  }

  downloadFramework(competencyFramework: CompetencyFramework): void {
    this.competencyFrameworkService.getCompetencyFramework(competencyFramework.id)
      .pipe(take(1))
      .subscribe({
        next: (fw) => {
          const json = JSON.stringify(fw, null, 2);
          const blob = new Blob([json], { type: 'application/json' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          const filename = `${fw.name}-${fw.version || 'export'}.json`.replace(/[^a-z0-9.-]/gi, '_');
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        },
        error: (err) => {
          this.importError = 'Download failed: ' + (err.error?.title || err.message || 'Unknown error');
        }
      });
  }

  deleteCompetencyFramework(competencyFramework: CompetencyFramework): void {
    this.dialogService
      .confirm({ title: 'Delete Competency Framework', message: 'Are you sure that you want to delete ' + competencyFramework.name + '? This will delete ' +
        (competencyFramework.competencies?.length || 0) + ' competencies.'
       }).afterClosed().subscribe((result) => {
        if (result) {
          this.competencyFrameworkDataService.delete(competencyFramework.id);
          this.expandedElementId = '';
        }
      });
  }

  selectJsonFile(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) {
      return;
    }
    this.importing = true;
    this.importError = '';
    // No importId: this path shows only a spinner, so there is no progress to poll.
    this.competencyFrameworkService.importCompetencyFrameworkJson(undefined, file)
      .pipe(take(1))
      .subscribe({
        next: (created) => {
          this.competencyFrameworkDataService.updateStore(created);
          this.importing = false;
        },
        error: (err) => {
          this.importing = false;
          this.importError = 'Import failed: ' + (err.error?.title || err.message || 'Unknown error');
        },
      });
    this.jsonInput.nativeElement.value = null;
  }

  importFramework(): void {
    const dialogRef = this.dialog.open(AdminCompetencyFrameworkImportDialogComponent, {
      width: '600px',
      maxWidth: '90vw',
    });
    dialogRef.componentInstance.importComplete.subscribe((result: ImportResult | null) => {
      if (!result) {
        dialogRef.close();
        return;
      }

      dialogRef.componentInstance.isProcessing = true;
      dialogRef.componentInstance.parseError = '';

      // result.importId lets the dialog poll the API for the import's progress while
      // this request is in flight.
      let request: Observable<CompetencyFramework>;
      if (result.type === 'csv' && result.file) {
        request = this.competencyFrameworkService.importCompetencyFramework(
          result.source, result.version, result.importId, result.file);
      } else if (result.type === 'json' && result.file) {
        request = this.competencyFrameworkService.importCompetencyFrameworkJson(
          result.importId, result.file);
      } else if (result.type === 'xlsx' && result.file) {
        request = this.competencyFrameworkService.importCompetencyFrameworkXlsx(
          result.source, result.version, result.importId, result.file);
      } else {
        return;
      }

      request
        .pipe(take(1))
        .subscribe({
          next: (created) => {
            this.competencyFrameworkDataService.updateStore(created);
            dialogRef.componentInstance.finishImport(`Successfully imported ${created.name}`);
          },
          error: (err) => {
            dialogRef.componentInstance.failImport(
              'Import failed: ' + (err.error?.title || err.message || 'Unknown error'));
          }
        });
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
      this.expandedElementId = '';
      this.clearExpandedFrameworkState();
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
    this.clearExpandedFrameworkState();
    this.loadingCompetencies = true;
    this.competencyFilterControl.setValue('');
    this.workRoleFilterControl.setValue('');
    this.selectedCompetencyType = '';
    this.selectedWorkRoleCategory = '';
    this.competencyFrameworkService.getCompetencyFramework(frameworkId)
      .pipe(take(1))
      .subscribe({
        next: (fw) => {
          if (this.expandedElementId !== frameworkId) {
            return;
          }
          this.loadingCompetencies = false;
          const allComps = fw.competencies || [];
          this.buildTypeMap(fw);
          // Separate work roles from other competencies
          this.workRoles = allComps.filter(c => this.competencyTypeMap.get(c.id) === 'Work Role');
          this.expandedCompetencies = allComps.filter(c => this.competencyTypeMap.get(c.id) !== 'Work Role');
          this.workRoleCategories = [...new Set(this.workRoles.map(wr => this.getWorkRoleCategory(wr)).filter(c => c))].sort();
          // Attach the paginators *before* the data lands. Angular runs change
          // detection when this handler's microtask queue drains, which is before any
          // setTimeout scheduled here — so a data source that is still unpaginated at
          // this point renders every row (2 per competency, via multiTemplateDataRows)
          // only for the paginator to throw them away a tick later. On NICE 2.1.0 that
          // is ~4,400 rows built and discarded, which blocks the main thread for
          // seconds. The panel holding these paginators is already rendered by now,
          // because rowClicked set expandedElementId before this request was issued.
          this.attachCompetencyPaginators();
          this.applyWorkRoleFilter();
          this.applyCompetencyFilter();
          // Fallback for the case where the panel had not rendered yet, so the
          // paginators did not exist above.
          setTimeout(() => this.attachCompetencyPaginators());
        },
        error: (err: any) => {
          if (this.expandedElementId !== frameworkId) {
            return;
          }
          this.loadingCompetencies = false;
          this.importError = 'Load failed: ' + (err.error?.title || err.message || 'Unknown error');
        }
      });
  }

  private attachCompetencyPaginators(): void {
    if (this.competencyPaginator && this.competencyDataSource.paginator !== this.competencyPaginator) {
      this.competencyDataSource.paginator = this.competencyPaginator;
    }
    if (this.workRolePaginator && this.workRoleDataSource.paginator !== this.workRolePaginator) {
      this.workRoleDataSource.paginator = this.workRolePaginator;
    }
  }

  private clearExpandedFrameworkState(): void {
    this.loadingCompetencies = false;
    this.collapseCompetencyDetail();
    this.expandedCompetencies = [];
    this.competencyDataSource.data = [];
    this.competencyTypes = [];
    this.workRoles = [];
    this.workRoleDataSource.data = [];
    this.workRoleCategories = [];
    this.taxonomyLevels = [];
    this.competencyTypeMap.clear();
    this.competencyById.clear();
    this.availableRelatedDataSource.data = [];
    this.relatedDataSource.data = [];
    this.availableTypes = [];
    this.relatedTypes = [];
    this.currentRelatedIdNumbers = [];
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
    // DCWF: category code + role number (for example IT-411, DA-422)
    if (/^[A-Z]{2}-\d+[A-Z]?$/.test(idNumber)) return 'Work Role';
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
    // Only work the rows out here. The paginators live inside the detail cell that
    // expandedCompetencyId above has just made renderable, so they do not exist yet;
    // publishing the rows now would render both tables in full. Deferred to the
    // setTimeout below, which runs after the cell — and its paginators — exist.
    this.computeRelatedRows();
    this.availableTypes = [...new Set(
      this.availableRelatedRows.map(c => this.competencyTypeMap.get(c.id) || '').filter(t => t)
    )].sort();
    this.relatedTypes = [...new Set(
      this.relatedRows.map(c => this.competencyTypeMap.get(c.id) || '').filter(t => t)
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
    setTimeout(() => this.commitRelatedRows());
  }

  private collapseCompetencyDetail(): void {
    this.expandedCompetencyId = '';
    this.expandedComp = null;
    this.relatedRowsReady = false;
  }

  private updateRelatedDataSources(): void {
    this.computeRelatedRows();
    this.commitRelatedRows();
  }

  /**
   * Works out the two row sets without touching the data sources, so callers can
   * publish them once the paginators exist (see commitRelatedRows).
   */
  private computeRelatedRows(): void {
    const relatedSet = new Set(this.currentRelatedIdNumbers);
    const selfId = this.expandedComp?.idNumber;
    const sortByIdNumber = (a: Competency, b: Competency) =>
      (a.idNumber || '').localeCompare(b.idNumber || '');
    const all = [...this.competencyById.values()];
    this.relatedRows = all
      .filter(c => relatedSet.has(c.idNumber))
      .sort(sortByIdNumber);
    this.availableRelatedRows = all
      .filter(c => c.idNumber !== selfId && !relatedSet.has(c.idNumber))
      .sort(sortByIdNumber);
  }

  /**
   * Publishes the computed rows, attaching the paginators first. "Available to Link"
   * holds every other competency in the framework, so handing it to an unpaginated
   * table renders the whole framework (~2,200 rows for NICE 2.1.0) just to discard it
   * on the next tick.
   */
  private commitRelatedRows(): void {
    this.attachRelatedPaginators();
    this.relatedDataSource.data = this.relatedRows;
    this.availableRelatedDataSource.data = this.availableRelatedRows;
    this.relatedRowsReady = true;
  }

  private attachRelatedPaginators(): void {
    if (this.availablePaginator && this.availableRelatedDataSource.paginator !== this.availablePaginator) {
      this.availableRelatedDataSource.paginator = this.availablePaginator;
    }
    if (this.relatedPaginator && this.relatedDataSource.paginator !== this.relatedPaginator) {
      this.relatedDataSource.paginator = this.relatedPaginator;
    }
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
    if (this.savingRelated || this.currentRelatedIdNumbers.includes(comp.idNumber)) {
      return;
    }
    this.currentRelatedIdNumbers = [...this.currentRelatedIdNumbers, comp.idNumber];
    this.updateRelatedDataSources();
    this.saveCurrentRelated(comp.idNumber, true);
  }

  removeRelatedCompetency(comp: Competency): void {
    if (this.savingRelated || !this.currentRelatedIdNumbers.includes(comp.idNumber)) {
      return;
    }
    this.currentRelatedIdNumbers = this.currentRelatedIdNumbers.filter(id => id !== comp.idNumber);
    this.updateRelatedDataSources();
    this.saveCurrentRelated(comp.idNumber, false);
  }

  /**
   * Saves a single related-competency change. This used to reload the whole framework on
   * success, which is well over a megabyte of JSON and several seconds of row rendering
   * for one click on a checkbox-sized button — so it patches the local copy from the
   * change it just made instead. Only one save is allowed in flight at a time: two
   * overlapping PUTs on the same competency would each be computed from the same
   * server-side relationship set.
   */
  private saveCurrentRelated(changedIdNumber: string, added: boolean): void {
    const comp = this.expandedComp;
    if (!comp?.id) {
      return;
    }

    const relatedIdNumbers = [...this.currentRelatedIdNumbers];
    this.savingRelated = true;
    this.competencyFrameworkService.updateCompetency(comp.id, { ...comp, relatedIdNumbers })
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.savingRelated = false;
          comp.relatedIdNumbers = relatedIdNumbers;
          this.patchInverseRelation(changedIdNumber, comp.idNumber, added);
        },
        error: (err) => {
          this.savingRelated = false;
          this.importError = 'Save failed: ' + (err.error?.title || err.message || 'Unknown error');
          // Put the lists back to what the server still holds. Skipped if the user has
          // moved on to a different competency, whose state this must not overwrite.
          if (this.expandedComp === comp) {
            this.currentRelatedIdNumbers = [...(comp.relatedIdNumbers || [])];
            this.updateRelatedDataSources();
          }
        }
      });
  }

  /**
   * Keeps the other end of the relationship in step, because the API reports a
   * competency's related list as the union of its outbound and inbound relationships —
   * so linking A to B also changes what B reports. competencyById holds the same object
   * references as the competency and work role tables, so patching in place is enough.
   */
  private patchInverseRelation(otherIdNumber: string, selfIdNumber: string, added: boolean): void {
    const other = [...this.competencyById.values()].find(c => c.idNumber === otherIdNumber);
    if (!other) {
      return;
    }
    const related = other.relatedIdNumbers || [];
    if (added) {
      if (!related.includes(selfIdNumber)) {
        other.relatedIdNumbers = [...related, selfIdNumber];
      }
    } else {
      other.relatedIdNumbers = related.filter(id => id !== selfIdNumber);
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
      .confirm({ title: 'Delete Competency', message: 'Are you sure you want to delete ' + (competency.idNumber || competency.shortName) + '?'
       }).afterClosed().subscribe((result) => {
        if (result) {
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
