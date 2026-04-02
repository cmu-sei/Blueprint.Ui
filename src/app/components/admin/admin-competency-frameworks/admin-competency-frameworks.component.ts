// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, Input, OnDestroy, ViewChild, ViewChildren, QueryList, AfterViewInit } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { MatTableDataSource, MatTable } from '@angular/material/table';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { Subject } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';
import {
  CompetencyFramework,
  CompetencyElement,
  ProficiencyScale,
  ProficiencyLevel,
  CompetencyFrameworkService,
  CompetencyElementService,
  ProficiencyScaleService,
  ProficiencyLevelService,
} from 'src/app/generated/blueprint.api';
import { Sort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { CompetencyFrameworkDataService } from 'src/app/data/competency-framework/competency-framework-data.service';
import { CompetencyFrameworkQuery } from 'src/app/data/competency-framework/competency-framework.query';
import { MatDialog } from '@angular/material/dialog';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { AdminCompetencyFrameworkEditDialogComponent } from '../admin-competency-framework-edit-dialog/admin-competency-framework-edit-dialog.component';
import { AdminProficiencyScaleEditDialogComponent } from '../admin-proficiency-scale-edit-dialog/admin-proficiency-scale-edit-dialog.component';
import { AdminCompetencyElementEditDialogComponent } from '../admin-competency-element-edit-dialog/admin-competency-element-edit-dialog.component';
import { AdminProficiencyLevelEditDialogComponent } from '../admin-proficiency-level-edit-dialog/admin-proficiency-level-edit-dialog.component';
import { AdminCompetencyFrameworkImportDialogComponent } from '../admin-competency-framework-import-dialog/admin-competency-framework-import-dialog.component';
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
  @ViewChild('elementPaginator') elementPaginator: MatPaginator;
  adminCompetencyFrameworks: CompetencyFramework[] = [];
  filterControl = new UntypedFormControl();
  filterString = '';
  sort: Sort = { active: 'name', direction: 'asc' };
  competencyFrameworkDataSource = new MatTableDataSource<CompetencyFramework>(new Array<CompetencyFramework>());
  displayedColumns: string[] = ['action', 'name', 'version', 'source', 'description'];
  private unsubscribe$ = new Subject();
  isExpansionDetailRow = (i: number, row: Object) => (row as CompetencyFramework).id === this.expandedElementId;
  expandedElementId = '';
  // Sub-entity mat-table data sources
  expandedScales: ProficiencyScale[] = [];
  expandedElements: CompetencyElement[] = [];
  scaleDataSource = new MatTableDataSource<ProficiencyScale>([]);
  elementDataSource = new MatTableDataSource<CompetencyElement>([]);
  scaleDisplayedColumns: string[] = ['action', 'name', 'description', 'levels'];
  elementDisplayedColumns: string[] = ['action', 'elementIdentifier', 'elementType', 'name', 'description'];
  levelDisplayedColumns: string[] = ['action', 'name', 'value', 'displayOrder', 'description'];
  // Element search/filter
  elementFilterControl = new UntypedFormControl();
  elementFilterString = '';
  elementTypeFilter = '';
  elementTypes: string[] = [];
  // Scale expansion
  expandedScaleId = '';
  // Sub-table sorting
  scaleSort: Sort = { active: 'name', direction: 'asc' };
  elementSort: Sort = { active: 'elementIdentifier', direction: 'asc' };
  levelSort: Sort = { active: 'displayOrder', direction: 'asc' };

  importing = false;
  importError = '';

  constructor(
    private competencyFrameworkDataService: CompetencyFrameworkDataService,
    private competencyFrameworkQuery: CompetencyFrameworkQuery,
    private competencyFrameworkService: CompetencyFrameworkService,
    private competencyElementService: CompetencyElementService,
    private proficiencyScaleService: ProficiencyScaleService,
    private proficiencyLevelService: ProficiencyLevelService,
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
    this.elementFilterControl.valueChanges
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((term) => {
        this.elementFilterString = term;
        this.applyElementFilter();
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
        'Are you sure that you want to delete ' + competencyFramework.name + '? This will also delete all its elements and scales.'
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
    dialogRef.componentInstance.importComplete.subscribe((framework) => {
      if (framework) {
        this.importing = true;
        this.importError = '';
        this.competencyFrameworkService.createCompetencyFramework(framework)
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
      default:
        return 0;
    }
  }

  rowClicked(row: CompetencyFramework) {
    if (this.expandedElementId === row.id) {
      this.expandedElementId = '';
      this.expandedScales = [];
      this.expandedElements = [];
      this.scaleDataSource.data = [];
      this.elementDataSource.data = [];
    } else {
      this.expandedElementId = row.id;
      this.loadScales(row.id);
      this.loadElements(row.id);
    }
    this.competencyFrameworkTable.renderRows();
  }

  getRowClass(id: string) {
    return this.expandedElementId === id
      ? 'element-row element-row-expanded'
      : 'element-row element-row-not-expanded';
  }

  // --- Proficiency Scales ---

  loadScales(frameworkId: string) {
    this.proficiencyScaleService.getProficiencyScalesByFramework(frameworkId)
      .pipe(take(1))
      .subscribe(scales => {
        this.expandedScales = scales;
        this.scaleDataSource.data = scales;
      });
  }

  toggleScaleExpand(scaleId: string) {
    this.expandedScaleId = this.expandedScaleId === scaleId ? '' : scaleId;
  }

  scaleSortChanged(sort: Sort) {
    this.scaleSort = sort;
    const col = sort.active;
    const isAsc = sort.direction !== 'desc';
    this.scaleDataSource.data = [...this.expandedScales].sort((a, b) => {
      const aVal = (a[col] || '').toString().toLowerCase();
      const bVal = (b[col] || '').toString().toLowerCase();
      return (aVal < bVal ? -1 : aVal > bVal ? 1 : 0) * (isAsc ? 1 : -1);
    });
  }

  elementSortChanged(sort: Sort) {
    this.elementSort = sort;
    this.applyElementFilter();
  }

  onElementTypeFilterChange(value: string) {
    this.elementTypeFilter = value;
    this.applyElementFilter();
  }

  applyElementFilter() {
    let filtered = [...this.expandedElements];
    if (this.elementTypeFilter) {
      filtered = filtered.filter(el => el.elementType === this.elementTypeFilter);
    }
    if (this.elementFilterString) {
      const fs = this.elementFilterString.toLowerCase();
      filtered = filtered.filter(el =>
        el.elementIdentifier?.toLowerCase().includes(fs) ||
        el.elementType?.toLowerCase().includes(fs) ||
        el.name?.toLowerCase().includes(fs) ||
        el.description?.toLowerCase().includes(fs));
    }
    const col = this.elementSort.active;
    const isAsc = this.elementSort.direction !== 'desc';
    filtered.sort((a, b) => {
      const aVal = (a[col] || '').toString().toLowerCase();
      const bVal = (b[col] || '').toString().toLowerCase();
      return (aVal < bVal ? -1 : aVal > bVal ? 1 : 0) * (isAsc ? 1 : -1);
    });
    this.elementDataSource.data = filtered;
  }

  getLevelDataSource(scale: ProficiencyScale): MatTableDataSource<ProficiencyLevel> {
    const levels = scale.proficiencyLevels || [];
    const col = this.levelSort.active;
    const isAsc = this.levelSort.direction !== 'desc';
    const sorted = [...levels].sort((a, b) => {
      const aVal = (a[col] ?? '').toString().toLowerCase();
      const bVal = (b[col] ?? '').toString().toLowerCase();
      return (aVal < bVal ? -1 : aVal > bVal ? 1 : 0) * (isAsc ? 1 : -1);
    });
    return new MatTableDataSource<ProficiencyLevel>(sorted);
  }

  levelSortChanged(sort: Sort) {
    this.levelSort = sort;
  }

  addOrEditScale(scale: ProficiencyScale) {
    if (!scale) {
      scale = {
        competencyFrameworkId: this.expandedElementId,
      };
    }
    const dialogRef = this.dialog.open(AdminProficiencyScaleEditDialogComponent, {
      minWidth: '400px',
      maxWidth: '90vw',
      width: 'auto',
      data: {
        scale: { ...scale },
      },
    });
    dialogRef.componentInstance.editComplete.subscribe((result) => {
      if (result.saveChanges && result.scale) {
        this.saveScale(result.scale);
      }
      dialogRef.close();
    });
  }

  saveScale(scale: ProficiencyScale) {
    if (scale.id) {
      this.proficiencyScaleService.updateProficiencyScale(scale.id, scale)
        .pipe(take(1))
        .subscribe(() => {
          this.loadScales(this.expandedElementId);
        });
    } else {
      this.proficiencyScaleService.createProficiencyScale(scale)
        .pipe(take(1))
        .subscribe(s => {
          this.expandedScales.push(s);
          this.scaleDataSource.data = [...this.expandedScales];
        });
    }
  }

  deleteScale(scale: ProficiencyScale) {
    this.dialogService
      .confirm('Delete Scale', 'Are you sure you want to delete ' + scale.name + '?')
      .subscribe((result) => {
        if (result['confirm']) {
          this.proficiencyScaleService.deleteProficiencyScale(scale.id)
            .pipe(take(1))
            .subscribe(() => {
              this.expandedScales = this.expandedScales.filter(s => s.id !== scale.id);
              this.scaleDataSource.data = [...this.expandedScales];
            });
        }
      });
  }

  // --- Proficiency Levels ---

  addOrEditLevel(scale: ProficiencyScale, level: ProficiencyLevel) {
    if (!level) {
      level = {
        proficiencyScaleId: scale.id,
      };
    }
    const dialogRef = this.dialog.open(AdminProficiencyLevelEditDialogComponent, {
      minWidth: '400px',
      maxWidth: '90vw',
      width: 'auto',
      data: {
        level: { ...level },
      },
    });
    dialogRef.componentInstance.editComplete.subscribe((result) => {
      if (result.saveChanges && result.level) {
        this.saveLevel(scale, result.level);
      }
      dialogRef.close();
    });
  }

  saveLevel(scale: ProficiencyScale, level: ProficiencyLevel) {
    if (level.id) {
      this.proficiencyLevelService.updateProficiencyLevel(level.id, level)
        .pipe(take(1))
        .subscribe(() => {
          this.loadScales(this.expandedElementId);
        });
    } else {
      this.proficiencyLevelService.createProficiencyLevel(level)
        .pipe(take(1))
        .subscribe(l => {
          if (!scale.proficiencyLevels) {
            scale.proficiencyLevels = [];
          }
          scale.proficiencyLevels.push(l);
        });
    }
  }

  deleteLevel(scale: ProficiencyScale, level: ProficiencyLevel) {
    this.proficiencyLevelService.deleteProficiencyLevel(level.id)
      .pipe(take(1))
      .subscribe(() => {
        scale.proficiencyLevels = scale.proficiencyLevels.filter(l => l.id !== level.id);
      });
  }

  // --- Competency Elements ---

  loadElements(frameworkId: string) {
    this.elementFilterControl.setValue('');
    this.elementTypeFilter = '';
    this.competencyElementService.getCompetencyElementsByFramework(frameworkId)
      .pipe(take(1))
      .subscribe(elements => {
        this.expandedElements = elements;
        this.elementTypes = [...new Set(elements.map(e => e.elementType).filter(t => !!t))].sort();
        this.applyElementFilter();
        setTimeout(() => {
          if (this.elementPaginator) {
            this.elementDataSource.paginator = this.elementPaginator;
          }
        });
      });
  }

  addOrEditElement(element: CompetencyElement) {
    if (!element) {
      element = {
        competencyFrameworkId: this.expandedElementId,
      };
    }
    const dialogRef = this.dialog.open(AdminCompetencyElementEditDialogComponent, {
      minWidth: '400px',
      maxWidth: '90vw',
      width: 'auto',
      data: {
        element: { ...element },
      },
    });
    dialogRef.componentInstance.editComplete.subscribe((result) => {
      if (result.saveChanges && result.element) {
        this.saveElement(result.element);
      }
      dialogRef.close();
    });
  }

  saveElement(element: CompetencyElement) {
    if (element.id) {
      this.competencyElementService.updateCompetencyElement(element.id, element)
        .pipe(take(1))
        .subscribe(() => {
          this.loadElements(this.expandedElementId);
        });
    } else {
      this.competencyElementService.createCompetencyElement(element)
        .pipe(take(1))
        .subscribe(el => {
          this.expandedElements.push(el);
          this.applyElementFilter();
        });
    }
  }

  deleteElement(element: CompetencyElement) {
    this.dialogService
      .confirm('Delete Element', 'Are you sure you want to delete ' + (element.name || element.elementIdentifier) + '?')
      .subscribe((result) => {
        if (result['confirm']) {
          this.competencyElementService.deleteCompetencyElement(element.id)
            .pipe(take(1))
            .subscribe(() => {
              this.expandedElements = this.expandedElements.filter(e => e.id !== element.id);
              this.applyElementFilter();
            });
        }
      });
  }

}
