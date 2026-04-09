// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  MselCompetency,
  SystemPermission,
} from 'src/app/generated/blueprint.api';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { MselDataService, MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { MselCompetencyDataService } from 'src/app/data/msel-competency/msel-competency-data.service';
import { MselCompetencyQuery } from 'src/app/data/msel-competency/msel-competency.query';
import { MatDialog } from '@angular/material/dialog';
import { CompetencyOptionsDialogComponent } from '../competency-options-dialog/competency-options-dialog.component';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';

@Component({
  selector: 'app-msel-competencies',
  templateUrl: './msel-competencies.component.html',
  styleUrls: ['./msel-competencies.component.scss'],
  standalone: false
})
export class MselCompetenciesComponent implements OnDestroy, OnInit {
  @Input() loggedInUserId: string;
  @ViewChild(MatPaginator) paginator: MatPaginator;
  msel = new MselPlus();
  mselCompetencyList: MselCompetency[] = [];
  filterString = '';
  dataSource = new MatTableDataSource<MselCompetency>([]);
  displayedColumns: string[] = ['action', 'idNumber', 'shortName', 'description', 'teams', 'events'];
  private unsubscribe$ = new Subject();

  constructor(
    private mselQuery: MselQuery,
    private mselCompetencyDataService: MselCompetencyDataService,
    private mselCompetencyQuery: MselCompetencyQuery,
    private permissionDataService: PermissionDataService,
    private dialog: MatDialog,
    public dialogService: DialogService
  ) {
    (this.mselQuery.selectActive() as Observable<MselPlus>).pipe(takeUntil(this.unsubscribe$)).subscribe(msel => {
      if (msel && this.msel.id !== msel.id) {
        Object.assign(this.msel, msel);
        this.mselCompetencyDataService.loadByMsel(msel.id);
      }
    });
    this.mselCompetencyQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(mselCompetencies => {
      this.mselCompetencyList = mselCompetencies;
      this.applyFilter(this.filterString);
    });
  }

  ngOnInit() {
    this.permissionDataService.load()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe();
  }

  canEditMsel(): boolean {
    return this.permissionDataService.hasPermission(SystemPermission.ManageMsels) ||
      this.msel.hasRole(this.loggedInUserId, '').owner;
  }

  applyFilter(filterValue: string) {
    this.filterString = filterValue;
    let filtered = [...this.mselCompetencyList];
    if (filterValue) {
      const term = filterValue.toLowerCase();
      filtered = filtered.filter(mc =>
        mc.competency?.idNumber?.toLowerCase().includes(term) ||
        mc.competency?.shortName?.toLowerCase().includes(term) ||
        mc.competency?.description?.toLowerCase().includes(term));
    }
    this.dataSource.data = filtered;
    if (this.paginator) {
      this.dataSource.paginator = this.paginator;
    }
  }

  openCompetencyPicker() {
    const existingIds = new Set(this.mselCompetencyList.map(mc => mc.competency?.idNumber));
    const existingOptions = this.mselCompetencyList.map(mc => ({
      id: mc.competency?.id,
      optionName: mc.competency?.idNumber,
      optionValue: mc.competency?.shortName,
      isSelected: true,
    }));
    const dialogRef = this.dialog.open(CompetencyOptionsDialogComponent, {
      width: '80%',
      maxWidth: '900px',
      maxHeight: '80vh',
      data: {
        dataOptions: existingOptions,
      },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        const returnedIds = new Set<string>();
        result.forEach((opt: any) => {
          if (opt.isSelected) {
            const competencyId = opt.competencyId || opt.id;
            returnedIds.add(opt.optionName);
            if (!existingIds.has(opt.optionName)) {
              this.mselCompetencyDataService.add({
                mselId: this.msel.id,
                competencyId: competencyId,
              } as MselCompetency);
            }
          }
        });
        this.mselCompetencyList.forEach(mc => {
          if (!returnedIds.has(mc.competency?.idNumber)) {
            this.mselCompetencyDataService.delete(mc.id);
          }
        });
      }
    });
  }

  removeMselCompetency(mc: MselCompetency) {
    this.mselCompetencyDataService.delete(mc.id);
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
