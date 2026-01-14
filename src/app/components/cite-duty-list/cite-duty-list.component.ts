// Copyright 2023 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, Input, OnDestroy, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  CiteDuty,
  Team
} from 'src/app/generated/blueprint.api';
import { MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { Sort } from '@angular/material/sort';
import { MatMenuTrigger } from '@angular/material/menu';
import { CiteDutyDataService } from 'src/app/data/cite-duty/cite-duty-data.service';
import { CiteDutyQuery } from 'src/app/data/cite-duty/cite-duty.query';
import { TeamQuery } from 'src/app/data/team/team.query';
import { MatDialog } from '@angular/material/dialog';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { CiteDutyEditDialogComponent } from '../cite-duty-edit-dialog/cite-duty-edit-dialog.component';

@Component({
  selector: 'app-cite-duty-list',
  templateUrl: './cite-duty-list.component.html',
  styleUrls: ['./cite-duty-list.component.scss'],
  standalone: false
})
export class CiteDutyListComponent implements OnDestroy {
  @Input() loggedInUserId: string;
  @Input() isContentDeveloper: boolean;
  @Input() showTemplates: boolean;
  msel = new MselPlus();
  citeDutyList: CiteDuty[] = [];
  templateList: CiteDuty[] = [];
  changedCiteDuty: CiteDuty = {};
  filteredCiteDutyList: CiteDuty[] = [];
  filterControl = new FormControl();
  filterString = '';
  sort: Sort = { active: 'name', direction: 'asc' };
  sortedCiteDuties: CiteDuty[] = [];
  isAddingCiteDuty = false;
  editingId = '';
  selectedTeamId = '';
  mselTeamList: Team[] = [];
  private unsubscribe$ = new Subject();
  // context menu
  @ViewChild(MatMenuTrigger, { static: true }) contextMenu: MatMenuTrigger;
  contextMenuPosition = { x: '0px', y: '0px' };

  constructor(
    private mselQuery: MselQuery,
    private citeDutyDataService: CiteDutyDataService,
    private citeDutyQuery: CiteDutyQuery,
    private teamQuery: TeamQuery,
    public dialog: MatDialog,
    public dialogService: DialogService
  ) {
    // subscribe to citeDuties
    this.citeDutyQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(citeDuties => {
      this.citeDutyList = citeDuties;
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
        this.sortedCiteDuties = this.getSortedCiteDuties(this.getFilteredCiteDuties(false));
      }
    });
    // subscribe to Teams
    this.teamQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(teams => {
      const mtList: Team[] = [];
      teams.forEach(mt => {
        if (mt.mselId === this.msel.id) {
          mtList.push(mt);
        }
      });
      this.mselTeamList = mtList.sort((a, b) => a.shortName.toLowerCase() < b.shortName.toLowerCase() ? -1 : 1);
    });
    // subscribe to filter term changes
    this.filterControl.valueChanges
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((term) => {
        this.filterString = term;
        this.sortedCiteDuties = this.getSortedCiteDuties(this.getFilteredCiteDuties(false));
      });
    // load CiteDuty templates
    this.citeDutyDataService.loadTemplates();
  }

  addOrEditCiteDuty(citeDuty: CiteDuty, makeTemplate: boolean, makeFromTemplate: boolean) {
    if (!citeDuty) {
      citeDuty = {
        mselId: this.showTemplates ? '' : this.msel.id,
        name: '',
        isTemplate: this.showTemplates,
        teamId: ''
      };
    } else {
      if (makeTemplate) {
        citeDuty = {
          name: citeDuty.name,
          isTemplate: true,
          teamId: ''
        };
      } else if (makeFromTemplate) {
        citeDuty = {
          name: citeDuty.name,
          mselId: this.msel.id,
          isTemplate: false
        };
      } else {
        citeDuty = { ...citeDuty };
      }
    }
    const dialogRef = this.dialog.open(CiteDutyEditDialogComponent, {
      width: '90%',
      maxWidth: '800px',
      data: {
        citeDuty: { ...citeDuty },
        teamList: this.mselTeamList
      },
    });
    dialogRef.componentInstance.editComplete.subscribe((result) => {
      if (result.saveChanges && result.citeDuty) {
        this.saveDuty(result.citeDuty);
      }
      dialogRef.close();
    });
  }

  saveDuty(citeDuty: CiteDuty) {
    if (citeDuty.id) {
      this.citeDutyDataService.updateCiteDuty(citeDuty);
    } else if (citeDuty.isTemplate) {
      this.citeDutyDataService.add(citeDuty);
    } else {
      const teams: string[] = [];
      const moves: number[] = [];
      if (citeDuty.teamId) {
        teams.push(citeDuty.teamId);
      } else {
        this.mselTeamList.forEach(team => {
          teams.push(team.id);
        });
      }
      teams.forEach(team => {
        citeDuty.teamId = team;
        this.citeDutyDataService.add(citeDuty);
      });
    }
  }

  deleteCiteDuty(citeDuty: CiteDuty): void {
    if (this.isAddingCiteDuty || (this.editingId && this.editingId !== citeDuty.id)) {
      return;
    }
    const title = citeDuty.mselId ? 'Delete CITE Duty' : 'Delete CITE Duty Template';
    this.dialogService
      .confirm(
        title,
        'Are you sure that you want to delete ' + citeDuty.name + '?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.citeDutyDataService.delete(citeDuty.id);
          this.editingId = '';
        }
      });
  }

  sortChanged(sort: Sort) {
    this.sort = sort;
    this.sortedCiteDuties = this.getSortedCiteDuties(this.getFilteredCiteDuties(false));
    this.templateList = this.getSortedCiteDuties(this.getFilteredCiteDuties(true));
  }

  getSortedCiteDuties(citeDuties: CiteDuty[]) {
    if (citeDuties) {
      citeDuties = citeDuties.sort((a, b) => this.sortCiteDuties(a, b, this.sort.active, this.sort.direction));
    }
    return citeDuties;
  }

  private sortCiteDuties(
    a: CiteDuty,
    b: CiteDuty,
    column: string,
    direction: string
  ) {
    const isAsc = direction !== 'desc';
    switch (column) {
      case 'name':
        if (a.name.toLowerCase() === b.name.toLowerCase()) {
          return ((a.team?.name < b.team?.name ? -1 : 1) * (isAsc ? 1 : -1));
        }
        return ((a.name < b.name ? -1 : 1) * (isAsc ? 1 : -1));
        break;
      case 'team':
        if (a.team?.name === b.team?.name) {
          return ((a.name < b.name ? -1 : 1) * (isAsc ? 1 : -1));
        }
        return ((a.team?.name < b.team?.name ? -1 : 1) * (isAsc ? 1 : -1));
        break;
      default:
        return 0;
    }
  }

  getFilteredCiteDuties(getTemplatesOnly: boolean): CiteDuty[] {
    const citeDuties = this.citeDutyList;
    const mselId = getTemplatesOnly || this.showTemplates ? '' : this.msel.id;
    let filteredCiteDuties: CiteDuty[] = [];
    if (citeDuties) {
      citeDuties.forEach(citeDuty => {
        if ((mselId && citeDuty.mselId === mselId) || (!mselId && !citeDuty.mselId)) {
          filteredCiteDuties.push({ ...citeDuty });
        }
      });
      if (filteredCiteDuties && filteredCiteDuties.length > 0) {
        if (this.filterString) {
          const filterString = this.filterString.toLowerCase();
          filteredCiteDuties = filteredCiteDuties
            .filter((a) =>
              a.name.toLowerCase().includes(filterString) ||
              a.team?.name.toLowerCase().includes(filterString)
            );
        }
        if (this.selectedTeamId) {
          filteredCiteDuties = filteredCiteDuties.filter((a) => a.teamId === this.selectedTeamId);
        }
      }
    }
    return filteredCiteDuties;
  }

  selectTeam(teamId: string) {
    this.selectedTeamId = teamId;
    this.sortedCiteDuties = this.getSortedCiteDuties(this.getFilteredCiteDuties(false));
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
