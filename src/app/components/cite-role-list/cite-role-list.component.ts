// Copyright 2023 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, Input, OnDestroy, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  CiteRole,
  Team
} from 'src/app/generated/blueprint.api';
import { MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { Sort } from '@angular/material/sort';
import { MatLegacyMenuTrigger as MatMenuTrigger } from '@angular/material/legacy-menu';
import { CiteRoleDataService } from 'src/app/data/cite-role/cite-role-data.service';
import { CiteRoleQuery } from 'src/app/data/cite-role/cite-role.query';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { CiteRoleEditDialogComponent } from '../cite-role-edit-dialog/cite-role-edit-dialog.component';

@Component({
  selector: 'app-cite-role-list',
  templateUrl: './cite-role-list.component.html',
  styleUrls: ['./cite-role-list.component.scss'],
})
export class CiteRoleListComponent implements OnDestroy {
  @Input() loggedInUserId: string;
  @Input() isContentDeveloper: boolean;
  msel = new MselPlus();
  citeRoleList: CiteRole[] = [];
  changedCiteRole: CiteRole = {};
  filteredCiteRoleList: CiteRole[] = [];
  filterControl = new FormControl();
  filterString = '';
  sort: Sort = {active: 'name', direction: 'asc'};
  sortedCiteRoles: CiteRole[] = [];
  isAddingCiteRole = false;
  editingId = '';
  private unsubscribe$ = new Subject();
  // context menu
  @ViewChild(MatMenuTrigger, { static: true }) contextMenu: MatMenuTrigger;
  contextMenuPosition = { x: '0px', y: '0px' };

  constructor(
    private mselQuery: MselQuery,
    private citeRoleDataService: CiteRoleDataService,
    private citeRoleQuery: CiteRoleQuery,
    public dialog: MatDialog,
    public dialogService: DialogService
  ) {
    // subscribe to citeRoles
    this.citeRoleQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(citeRoles => {
      this.citeRoleList = citeRoles;
      this.sortedCiteRoles = this.getSortedCiteRoles(this.getFilteredCiteRoles(this.citeRoleList));
    });
    // subscribe to the active MSEL
    (this.mselQuery.selectActive() as Observable<MselPlus>).pipe(takeUntil(this.unsubscribe$)).subscribe(msel => {
      if (msel && msel.id !== this.msel.id) {
        Object.assign(this.msel, msel);
        this.sortedCiteRoles = this.getSortedCiteRoles(this.getFilteredCiteRoles(this.citeRoleList));
      }
    });
    this.filterControl.valueChanges
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((term) => {
        this.filterString = term;
        this.sortedCiteRoles = this.getSortedCiteRoles(this.getFilteredCiteRoles(this.citeRoleList));
      });
  }

  addOrEditCiteRole(citeRole: CiteRole) {
    if (!citeRole) {
      citeRole = {
        name: '',
        mselId: this.msel.id,
        teamId: null
      };
    } else {
      citeRole = {... citeRole};
    }
    const dialogRef = this.dialog.open(CiteRoleEditDialogComponent, {
      width: '800px',
      data: {
        citeRole: citeRole,
        teamList: this.msel.teams
      },
    });
    dialogRef.componentInstance.editComplete.subscribe((result) => {
      if (result.saveChanges && result.citeRole) {
        this.saveRole(result.citeRole);
      }
      dialogRef.close();
    });
  }

  saveRole(citeRole: CiteRole) {
    if (citeRole.id) {
      this.citeRoleDataService.updateCiteRole(citeRole);
    } else {
      if (citeRole.teamId) {
        this.citeRoleDataService.add(citeRole);
      } else {
        this.msel.teams.forEach(team => {
          citeRole.teamId = team.id;
          this.citeRoleDataService.add(citeRole);
        });
      }
    }
  }

  deleteCiteRole(citeRole: CiteRole): void {
    if (this.isAddingCiteRole || (this.editingId && this.editingId !== citeRole.id)) {
      return;
    }
    this.dialogService
      .confirm(
        'Delete CiteRole',
        'Are you sure that you want to delete ' + citeRole.name + '?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.citeRoleDataService.delete(citeRole.id);
          this.editingId = '';
        }
      });
  }

  sortChanged(sort: Sort) {
    this.sort = sort;
    this.sortedCiteRoles = this.getSortedCiteRoles(this.getFilteredCiteRoles(this.citeRoleList));
  }

  getSortedCiteRoles(citeRoles: CiteRole[]) {
    if (citeRoles) {
      citeRoles = citeRoles.sort((a, b) => this.sortCiteRoles(a, b, this.sort.active, this.sort.direction));
    }
    return citeRoles;
  }

  private sortCiteRoles(
    a: CiteRole,
    b: CiteRole,
    column: string,
    direction: string
  ) {
    const isAsc = direction !== 'desc';
    switch (column) {
      case 'name':
        if (a.name.toLowerCase() === b.name.toLowerCase()) {
          return ( (a.team.name < b.team.name ? -1 : 1) * (isAsc ? 1 : -1) );
        }
        return ( (a.name < b.name ? -1 : 1) * (isAsc ? 1 : -1) );
        break;
      case 'team':
        if (a.team.name === b.team.name) {
          return ( (a.name < b.name ? -1 : 1) * (isAsc ? 1 : -1) );
        }
        return ( (a.team.name < b.team.name ? -1 : 1) * (isAsc ? 1 : -1) );
        break;
      default:
        return 0;
    }
  }

  getFilteredCiteRoles(citeRoles: CiteRole[]): CiteRole[] {
    let filteredCiteRoles: CiteRole[] = [];
    if (citeRoles) {
      citeRoles.forEach(se => {
        if (se.mselId === this.msel.id) {
          filteredCiteRoles.push({... se});
        }
      });
      if (filteredCiteRoles && filteredCiteRoles.length > 0 && this.filterString) {
        const filterString = this.filterString.toLowerCase();
        filteredCiteRoles = filteredCiteRoles
          .filter((a) =>
            a.name.toLowerCase().includes(filterString) ||
            a.team.name.toLowerCase().includes(filterString)
          );
      }
    }
    return filteredCiteRoles;
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
