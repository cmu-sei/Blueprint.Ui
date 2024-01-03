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
import { MselTeamQuery } from 'src/app/data/msel-team/msel-team.query';
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
  @Input() showTemplates: boolean;
  msel = new MselPlus();
  citeRoleList: CiteRole[] = [];
  templateList: CiteRole[] = [];
  changedCiteRole: CiteRole = {};
  filteredCiteRoleList: CiteRole[] = [];
  filterControl = new FormControl();
  filterString = '';
  sort: Sort = {active: 'name', direction: 'asc'};
  sortedCiteRoles: CiteRole[] = [];
  isAddingCiteRole = false;
  editingId = '';
  selectedTeamId = '';
  mselTeamList: Team[] = [];
  private unsubscribe$ = new Subject();
  // context menu
  @ViewChild(MatMenuTrigger, { static: true }) contextMenu: MatMenuTrigger;
  contextMenuPosition = { x: '0px', y: '0px' };

  constructor(
    private mselQuery: MselQuery,
    private citeRoleDataService: CiteRoleDataService,
    private citeRoleQuery: CiteRoleQuery,
    private mselTeamQuery: MselTeamQuery,
    public dialog: MatDialog,
    public dialogService: DialogService
  ) {
    // subscribe to citeRoles
    this.citeRoleQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(citeRoles => {
      this.citeRoleList = citeRoles;
      this.sortChanged(this.sort);
    });
    // subscribe to the active MSEL
    (this.mselQuery.selectActive() as Observable<MselPlus>).pipe(takeUntil(this.unsubscribe$)).subscribe(msel => {
      if (msel && this.msel.id !== msel.id) {
        if (this.showTemplates) {
          this.msel = new MselPlus();
        } else {
          Object.assign(this.msel, msel);
        }
        this.sortedCiteRoles = this.getSortedCiteRoles(this.getFilteredCiteRoles(false));
      }
    });
    // subscribe to mselTeams
    this.mselTeamQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(mselTeams => {
      const mtList: Team[] = [];
      mselTeams.forEach(mt => {
        if (mt.mselId === this.msel.id) {
          mtList.push(mt.team);
        }
      });
      this.mselTeamList = mtList.sort((a, b) => a.shortName.toLowerCase() < b.shortName.toLowerCase() ? -1 : 1);
    });
    // subscribe to filter term changes
    this.filterControl.valueChanges
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((term) => {
        this.filterString = term;
        this.sortedCiteRoles = this.getSortedCiteRoles(this.getFilteredCiteRoles(false));
      });
    // load CiteRole templates
    this.citeRoleDataService.loadTemplates();
  }

  addOrEditCiteRole(citeRole: CiteRole, makeTemplate: boolean, makeFromTemplate: boolean) {
    if (!citeRole) {
      citeRole = {
        mselId: this.showTemplates ? '' : this.msel.id,
        name: '',
        isTemplate: this.showTemplates,
        teamId: ''
      };
    } else {
      const newRole = { ...citeRole};
      if (makeTemplate) {
        citeRole = {
          name: citeRole.name,
          isTemplate: true,
          teamId: ''
        };
      } else if (makeFromTemplate) {
        citeRole = {
          name: citeRole.name,
          mselId: this.msel.id,
          isTemplate: false
        };
      } else {
        citeRole = { ...citeRole};
      }
    }
    const dialogRef = this.dialog.open(CiteRoleEditDialogComponent, {
      width: '90%',
      maxWidth: '800px',
      data: {
        citeRole: { ...citeRole},
        teamList: this.mselTeamList
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
    } else if (citeRole.isTemplate) {
      this.citeRoleDataService.add(citeRole);
    } else {
      const teams: string[] = [];
      const moves: number[] = [];
      if (citeRole.teamId) {
        teams.push(citeRole.teamId);
      } else {
        this.mselTeamList.forEach(team => {
          teams.push(team.id);
        });
      }
      teams.forEach(team => {
        citeRole.teamId = team;
        this.citeRoleDataService.add(citeRole);
      });
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
    this.sortedCiteRoles = this.getSortedCiteRoles(this.getFilteredCiteRoles(false));
    this.templateList = this.getSortedCiteRoles(this.getFilteredCiteRoles(true));
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

  getFilteredCiteRoles(getTemplatesOnly: boolean): CiteRole[] {
    const citeRoles = this.citeRoleList;
    const mselId = getTemplatesOnly || this.showTemplates ? '' : this.msel.id;
    let filteredCiteRoles: CiteRole[] = [];
    if (citeRoles) {
      citeRoles.forEach(citeRole => {
        if ((mselId && citeRole.mselId === mselId) || (!mselId && !citeRole.mselId)) {
          filteredCiteRoles.push({... citeRole});
        }
      });
      if (filteredCiteRoles && filteredCiteRoles.length > 0) {
        if (this.filterString) {
          const filterString = this.filterString.toLowerCase();
          filteredCiteRoles = filteredCiteRoles
            .filter((a) =>
              a.name.toLowerCase().includes(filterString) ||
              a.team?.name.toLowerCase().includes(filterString)
            );
        }
        if (this.selectedTeamId) {
          filteredCiteRoles = filteredCiteRoles.filter((a) => a.teamId === this.selectedTeamId);
        }
      }
    }
    return filteredCiteRoles;
  }

  selectTeam(teamId: string) {
    this.selectedTeamId = teamId;
    this.sortedCiteRoles = this.getSortedCiteRoles(this.getFilteredCiteRoles(false));
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
