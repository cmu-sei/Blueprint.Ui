// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, Input, OnDestroy, ViewChild } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { MatTableDataSource } from '@angular/material/table';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  InjectType,
  MselItemStatus,
  Team
} from 'src/app/generated/blueprint.api';
import { MselDataService, MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { Sort } from '@angular/material/sort';
import { MatLegacyMenuTrigger as MatMenuTrigger } from '@angular/material/legacy-menu';
import { MatTable } from '@angular/material/table';
import { InjectTypeDataService } from 'src/app/data/inject-type/inject-type-data.service';
import { InjectTypeQuery } from 'src/app/data/inject-type/inject-type.query';
import { TeamQuery } from 'src/app/data/team/team.query';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { AdminInjectTypeEditDialogComponent } from '../admin-inject-type-edit-dialog/admin-inject-type-edit-dialog.component';
import { v4 as uuidv4 } from 'uuid';

@Component({
  selector: 'app-admin-inject-types',
  templateUrl: './admin-inject-types.component.html',
  styleUrls: ['./admin-inject-types.component.scss'],
  animations: [
    trigger('detailExpand', [
      state('collapsed', style({ height: '0px', minHeight: '0', visibility: 'hidden' })),
      state('expanded', style({ height: '*', visibility: 'visible' })),
      transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
    ]),
  ],
})
export class AdminInjectTypesComponent implements OnDestroy {
  @Input() loggedInUserId: string;
  @Input() isContentDeveloper: boolean;
  @ViewChild('injectTypeTable', {static: false}) injectTypeTable: MatTable<any>;
  contextMenuPosition = { x: '0px', y: '0px' };
  msel = new MselPlus();
  adminInjectTypes: InjectType[] = [];
  changedInjectType: InjectType = {};
  filteredAdminInjectTypes: InjectType[] = [];
  filterControl = new UntypedFormControl();
  filterString = '';
  sort: Sort = {active: 'name', direction: 'asc'};
  sortedInjectTypes: InjectType[] = [];
  templateInjectTypes: InjectType[] = [];
  editingId = '';
  injectTypeDataSource = new MatTableDataSource<InjectType>(new Array<InjectType>());
  displayedColumns: string[] = ['action', 'name', 'description'];
  teamList: Team[] = [];
  private unsubscribe$ = new Subject();
  isExpansionDetailRow = (i: number, row: Object) => (row as InjectType).id === this.expandedElementId;
  expandedElementId = '';

  constructor(
    private mselQuery: MselQuery,
    private injectTypeDataService: InjectTypeDataService,
    private injectTypeQuery: InjectTypeQuery,
    private teamQuery: TeamQuery,
    public dialog: MatDialog,
    public dialogService: DialogService
  ) {
    // subscribe to injectTypes
    this.injectTypeQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(injectTypes => {
      this.adminInjectTypes = injectTypes;
      this.sortChanged(this.sort);
    });
    // subscribe to filter control changes
    this.filterControl.valueChanges
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((term) => {
        this.filterString = term;
        this.sortChanged(this.sort);
      });
  }

  getSortedInjectTypes(injectTypes: InjectType[]) {
    if (injectTypes) {
      injectTypes.sort((a, b) => this.sortInjectTypes(a, b, this.sort.active, this.sort.direction));
    }
    return injectTypes;
  }

  addOrEditInjectType(injectType: InjectType) {
    if (!injectType) {
      const dateTime = new Date();
      dateTime.setMinutes(dateTime.getMinutes() + 30);
      injectType = {
      };
    }
    const dialogRef = this.dialog.open(AdminInjectTypeEditDialogComponent, {
      width: '800px',
      data: {
        injectType: injectType,
        teamList: this.teamList
      },
    });
    dialogRef.componentInstance.editComplete.subscribe((result) => {
      if (result.saveChanges && result.injectType) {
        this.saveInjectType(result.injectType);
      }
      dialogRef.close();
    });
  }

  saveInjectType(injectType: InjectType) {
    if (injectType.id) {
      this.injectTypeDataService.update(injectType);
    } else {
      injectType.id = uuidv4();
      this.injectTypeDataService.add(injectType);
    }
  }

  deleteInjectType(injectType: InjectType): void {
    this.dialogService
      .confirm(
        'Delete InjectType',
        'Are you sure that you want to delete ' + injectType.name + '?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.injectTypeDataService.delete(injectType.id);
          this.editingId = '';
        }
      });
  }

  copyInjectType(injectType: InjectType): void {
    // this.injectTypeDataService.copy(id);
  }

  sortChanged(sort: Sort) {
    this.sort = sort;
    this.injectTypeDataSource.data = this.getSortedInjectTypes(this.getFilteredInjectTypes(this.msel.id, this.adminInjectTypes));
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }

  getFilteredInjectTypes(mselId: string, injectTypes: InjectType[]): InjectType[] {
    let filteredInjectTypes: InjectType[] = [];
    if (injectTypes) {
      injectTypes.forEach(se => {
        filteredInjectTypes.push({... se});
      });
      if (filteredInjectTypes && filteredInjectTypes.length > 0 && this.filterString) {
        const filterString = this.filterString?.toLowerCase();
        filteredInjectTypes = filteredInjectTypes.filter(injectType => injectType.name?.toLowerCase().includes(filterString));
      }
    }
    return filteredInjectTypes;
  }

  private sortInjectTypes(
    a: InjectType,
    b: InjectType,
    column: string,
    direction: string
  ) {
    const isAsc = direction !== 'desc';
    switch (column) {
      case 'name':
        return ( (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1) * (isAsc ? 1 : -1) );
        break;
      case 'description':
        return ( (a.description.toLowerCase() < b.description.toLowerCase() ? -1 : 1) * (isAsc ? 1 : -1) );
        break;
      default:
        return 0;
    }
  }

  getInjectTypeLink(teamId: string) {
    if (this.msel.isTemplate && this.msel.status === MselItemStatus.Approved) {
      return location.origin + '/launch/?msel=' + this.msel.id + '&team=' + teamId;
    } else if (!this.msel.isTemplate && this.msel.status === MselItemStatus.Deployed) {
      return location.origin + '/join/?msel=' + this.msel.id + '&team=' + teamId;
    } else {
      return '';
    }
  }

  rowClicked(row: InjectType) {
    if (this.expandedElementId === row.id) {
      this.expandedElementId = '';
    } else {
      this.expandedElementId = row.id;
    }
    this.injectTypeTable.renderRows();
  }

  getRowClass(id: string) {
    const rowClass = this.expandedElementId === id
      ? 'element-row element-row-expanded'
      : 'element-row element-row-not-expanded';
    return rowClass;
  }

}
