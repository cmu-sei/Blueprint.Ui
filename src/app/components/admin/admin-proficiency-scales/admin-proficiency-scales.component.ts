// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { MatPaginator } from '@angular/material/paginator';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { Subject } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';
import {
  ProficiencyScale,
  ProficiencyLevel,
  ProficiencyScaleService,
  ProficiencyLevelService,
} from 'src/app/generated/blueprint.api';
import { Sort } from '@angular/material/sort';
import { MatDialog } from '@angular/material/dialog';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { AdminProficiencyScaleEditDialogComponent } from '../admin-proficiency-scale-edit-dialog/admin-proficiency-scale-edit-dialog.component';
import { AdminProficiencyLevelEditDialogComponent } from '../admin-proficiency-level-edit-dialog/admin-proficiency-level-edit-dialog.component';
import { ItemDownloadDialogComponent } from '../../item-download-dialog/item-download-dialog.component';
import { HttpEventType, HttpResponse } from '@angular/common/http';

@Component({
  selector: 'app-admin-proficiency-scales',
  templateUrl: './admin-proficiency-scales.component.html',
  styleUrls: ['./admin-proficiency-scales.component.scss'],
  animations: [
    trigger('detailExpand', [
      state('collapsed', style({ height: '0px', minHeight: '0', visibility: 'hidden' })),
      state('expanded', style({ height: '*', visibility: 'visible' })),
      transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
    ]),
  ],
  standalone: false
})
export class AdminProficiencyScalesComponent implements OnInit, OnDestroy {
  @Input() loggedInUserId: string;
  @Input() canEdit: boolean;
  scales: ProficiencyScale[] = [];
  scaleDataSource = new MatTableDataSource<ProficiencyScale>([]);
  scaleDisplayedColumns: string[] = ['action', 'name', 'description', 'levels'];
  levelDisplayedColumns: string[] = ['action', 'name', 'value', 'displayOrder', 'description'];
  scaleSort: Sort = { active: 'name', direction: 'asc' };
  levelSort: Sort = { active: 'displayOrder', direction: 'asc' };
  @ViewChild('scaleTable', { static: false }) scaleTable: MatTable<any>;
  @ViewChild('paginator') paginator: MatPaginator;
  @ViewChild('jsonInput') jsonInput: ElementRef<HTMLInputElement>;
  expandedScaleId = '';
  filterControl = new UntypedFormControl();
  filterString = '';
  private unsubscribe$ = new Subject();

  constructor(
    private proficiencyScaleService: ProficiencyScaleService,
    private proficiencyLevelService: ProficiencyLevelService,
    public dialog: MatDialog,
    public dialogService: DialogService
  ) {}

  ngOnInit() {
    this.loadScales();
    this.filterControl.valueChanges
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((term) => {
        this.filterString = term;
        this.applySorting();
      });
  }

  loadScales() {
    this.proficiencyScaleService.getProficiencyScales()
      .pipe(take(1))
      .subscribe(scales => {
        this.scales = scales;
        this.applySorting();
      });
  }

  selectFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) {
      return;
    }
    this.proficiencyScaleService.uploadJsonProficiencyScales(file, 'events', true)
      .subscribe((event: any) => {
        if (event instanceof HttpResponse && event.status === 200) {
          this.loadScales();
        }
      });
    this.jsonInput.nativeElement.value = null;
  }

  openDownloadDialog() {
    const items = (this.scaleDataSource.filteredData || []).map((s) => ({
      id: s.id,
      label: s.name || s.id,
    }));
    const dialogRef = this.dialog.open(ItemDownloadDialogComponent, {
      maxWidth: '90vw',
      width: 'auto',
      data: {
        title: 'Select Proficiency Scales to download',
        items,
      },
    });
    dialogRef.afterClosed().subscribe((selectedIds: string[] | undefined) => {
      if (selectedIds && selectedIds.length > 0) {
        this.downloadJsonItems(selectedIds);
      }
    });
  }

  downloadJsonItems(ids: string[]) {
    this.proficiencyScaleService.downloadJsonProficiencyScales(ids).subscribe(
      (data) => {
        const url = window.URL.createObjectURL(data);
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.download = 'proficiency-scale-export.json';
        link.click();
        window.URL.revokeObjectURL(url);
      },
      (err) => {
        window.alert('Error downloading file');
      }
    );
  }

  applySorting() {
    const col = this.scaleSort.active;
    const isAsc = this.scaleSort.direction !== 'desc';
    let filtered = [...this.scales];
    if (this.filterString) {
      const term = this.filterString.toLowerCase();
      filtered = filtered.filter(s =>
        s.name?.toLowerCase().includes(term) ||
        s.description?.toLowerCase().includes(term));
    }
    this.scaleDataSource.data = filtered.sort((a, b) => {
      let aVal: string;
      let bVal: string;
      if (col === 'levels') {
        aVal = (a.proficiencyLevels?.length || 0).toString();
        bVal = (b.proficiencyLevels?.length || 0).toString();
        return (Number(aVal) - Number(bVal)) * (isAsc ? 1 : -1);
      }
      aVal = (a[col] || '').toString().toLowerCase();
      bVal = (b[col] || '').toString().toLowerCase();
      return (aVal < bVal ? -1 : aVal > bVal ? 1 : 0) * (isAsc ? 1 : -1);
    });
    if (this.paginator) {
      this.scaleDataSource.paginator = this.paginator;
    }
  }

  scaleSortChanged(sort: Sort) {
    this.scaleSort = sort;
    this.applySorting();
  }

  toggleScaleExpand(row: ProficiencyScale) {
    this.expandedScaleId = this.expandedScaleId === row.id ? '' : row.id;
    this.scaleTable.renderRows();
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
      scale = {};
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
          this.loadScales();
        });
    } else {
      this.proficiencyScaleService.createProficiencyScale(scale)
        .pipe(take(1))
        .subscribe(() => {
          this.loadScales();
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
              this.scales = this.scales.filter(s => s.id !== scale.id);
              this.applySorting();
              if (this.expandedScaleId === scale.id) {
                this.expandedScaleId = '';
              }
            });
        }
      });
  }

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
          this.loadScales();
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

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
