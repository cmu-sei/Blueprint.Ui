// Copyright 2023 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, Input, OnDestroy, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  CiteAction,
  Team
} from 'src/app/generated/blueprint.api';
import { MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { Sort } from '@angular/material/sort';
import { MatLegacyMenuTrigger as MatMenuTrigger } from '@angular/material/legacy-menu';
import { CiteActionDataService } from 'src/app/data/cite-action/cite-action-data.service';
import { CiteActionQuery } from 'src/app/data/cite-action/cite-action.query';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { CiteActionEditDialogComponent } from '../cite-action-edit-dialog/cite-action-edit-dialog.component';

@Component({
  selector: 'app-cite-action-list',
  templateUrl: './cite-action-list.component.html',
  styleUrls: ['./cite-action-list.component.scss'],
})
export class CiteActionListComponent implements OnDestroy {
  @Input() loggedInUserId: string;
  @Input() isContentDeveloper: boolean;
  msel = new MselPlus();
  citeActionList: CiteAction[] = [];
  changedCiteAction: CiteAction = {};
  filteredCiteActionList: CiteAction[] = [];
  filterControl = new FormControl();
  filterString = '';
  sort: Sort = {active: 'moveNumber', direction: 'asc'};
  sortedCiteActions: CiteAction[] = [];
  isAddingCiteAction = false;
  editingId = '';
  selectedMselId = '';
  selectedMoveNumber = -1;
  selectedTeamId = '';
  teamList: Team[] = [];
  private unsubscribe$ = new Subject();
  // context menu
  @ViewChild(MatMenuTrigger, { static: true }) contextMenu: MatMenuTrigger;
  contextMenuPosition = { x: '0px', y: '0px' };

  constructor(
    private mselQuery: MselQuery,
    private citeActionDataService: CiteActionDataService,
    private citeActionQuery: CiteActionQuery,
    public dialog: MatDialog,
    public dialogService: DialogService
  ) {
    // subscribe to citeActions
    this.citeActionQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(citeActions => {
      this.citeActionList = citeActions;
      this.sortedCiteActions = this.getSortedCiteActions(this.getFilteredCiteActions(this.citeActionList));
    });
    // subscribe to the active MSEL
    (this.mselQuery.selectActive() as Observable<MselPlus>).pipe(takeUntil(this.unsubscribe$)).subscribe(msel => {
      if (msel && this.selectedMselId !== msel.id) {
        Object.assign(this.msel, msel);
        this.selectedMselId = msel.id;
        this.sortedCiteActions = this.getSortedCiteActions(this.getFilteredCiteActions(this.citeActionList));
      }
    });
    this.filterControl.valueChanges
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((term) => {
        this.filterString = term;
        this.sortedCiteActions = this.getSortedCiteActions(this.getFilteredCiteActions(this.citeActionList));
      });
  }

  addOrEditCiteAction(citeAction: CiteAction) {
    if (!citeAction) {
      citeAction = {
        description: '',
        mselId: this.msel.id,
        teamId: this.selectedTeamId,
        moveNumber: this.selectedMoveNumber
      };
    } else {
      citeAction = {... citeAction};
    }
    const dialogRef = this.dialog.open(CiteActionEditDialogComponent, {
      width: '800px',
      data: {
        citeAction: citeAction,
        teamList: this.msel.teams,
        moveList: this.msel.moves
      },
    });
    dialogRef.componentInstance.editComplete.subscribe((result) => {
      if (result.saveChanges && result.citeAction) {
        this.saveAction(result.citeAction);
      }
      dialogRef.close();
    });
  }

  saveAction(citeAction: CiteAction) {
    if (citeAction.id) {
      this.citeActionDataService.updateCiteAction(citeAction);
    } else {
      const teams: string[] = [];
      const moves: number[] = [];
      if (citeAction.teamId) {
        teams.push(citeAction.teamId);
      } else {
        this.msel.teams.forEach(team => {
          teams.push(team.id);
        });
      }
      if (+citeAction.moveNumber >= 0) {
        moves.push(citeAction.moveNumber);
      } else {
        this.msel.moves.forEach(move => {
          moves.push(move.moveNumber);
        });
      }
      teams.forEach(team => {
        moves.forEach(move => {
          citeAction.teamId = team;
          citeAction.moveNumber = move;
          this.citeActionDataService.add(citeAction);
        });
      });
    }
  }

  deleteCiteAction(citeAction: CiteAction): void {
    if (this.isAddingCiteAction || (this.editingId && this.editingId !== citeAction.id)) {
      return;
    }
    this.dialogService
      .confirm(
        'Delete CiteAction',
        'Are you sure that you want to delete ' + citeAction.description + '?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.citeActionDataService.delete(citeAction.id);
          this.editingId = '';
        }
      });
  }

  sortChanged(sort: Sort) {
    this.sort = sort;
    this.sortedCiteActions = this.getSortedCiteActions(this.getFilteredCiteActions(this.citeActionList));
  }

  getSortedCiteActions(citeActions: CiteAction[]) {
    if (citeActions) {
      citeActions = citeActions.sort((a, b) => this.sortCiteActions(a, b, this.sort.active, this.sort.direction));
    }
    return citeActions;
  }

  private sortCiteActions(
    a: CiteAction,
    b: CiteAction,
    column: string,
    direction: string
  ) {
    const isAsc = direction !== 'desc';
    switch (column) {
      case 'description':  // description, moveNumber, team
        if (a.description.toLowerCase() === b.description.toLowerCase()) {
          if (+a.moveNumber === +b.moveNumber) {
            return ( (a.team.name < b.team.name ? -1 : 1) * (isAsc ? 1 : -1) );
          }
          return ( (+a.moveNumber < +b.moveNumber ? -1 : 1) * (isAsc ? 1 : -1) );
        }
        return ( (a.description.toLowerCase() < b.description.toLowerCase() ? -1 : 1) * (isAsc ? 1 : -1) );
        break;
      case 'team':  // team, moveNumber, actionNumber
        if (a.team.name === b.team.name) {
          if (+a.moveNumber === +b.moveNumber) {
            return ( (+a.actionNumber < +b.actionNumber ? -1 : 1) * (isAsc ? 1 : -1) );
          }
          return ( (+a.moveNumber < +b.moveNumber ? -1 : 1) * (isAsc ? 1 : -1) );
        }
        return ( (a.team.name < b.team.name ? -1 : 1) * (isAsc ? 1 : -1) );
        break;
      case 'moveNumber':  // moveNumber, team, actionNumber
        if (+a.moveNumber === +b.moveNumber) {
          if (a.team.name === b.team.name) {
            return ( (+a.actionNumber < +b.actionNumber ? -1 : 1) * (isAsc ? 1 : -1) );
          }
          return ( (a.team.name < b.team.name ? -1 : 1) * (isAsc ? 1 : -1) );
        }
        return ( (+a.moveNumber < +b.moveNumber ? -1 : 1) * (isAsc ? 1 : -1) );
      default:
        return 0;
    }
  }

  getFilteredCiteActions(citeActions: CiteAction[]): CiteAction[] {
    let filteredCiteActions: CiteAction[] = [];
    if (citeActions) {
      citeActions.forEach(se => {
        if (se.mselId === this.msel.id) {
          filteredCiteActions.push({... se});
        }
      });
      if (filteredCiteActions && filteredCiteActions.length > 0) {
        if (this.filterString) {
          const filterString = this.filterString.toLowerCase();
          filteredCiteActions = filteredCiteActions
            .filter((a) =>
              a.description.toLowerCase().includes(filterString) ||
              a.team.name.toLowerCase().includes(filterString)
            );
        }
        if (this.selectedMoveNumber >= 0) {
          filteredCiteActions = filteredCiteActions.filter((a) => a.moveNumber === this.selectedMoveNumber);
        }
        if (this.selectedTeamId) {
          filteredCiteActions = filteredCiteActions.filter((a) => a.teamId === this.selectedTeamId);
        }
      }
    }
    return filteredCiteActions;
  }

  selectMove(moveNumber: number) {
    this.selectedMoveNumber = moveNumber;
    this.sortedCiteActions = this.getSortedCiteActions(this.getFilteredCiteActions(this.citeActionList));
  }

  selectTeam(teamId: string) {
    this.selectedTeamId = teamId;
    this.sortedCiteActions = this.getSortedCiteActions(this.getFilteredCiteActions(this.citeActionList));
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
