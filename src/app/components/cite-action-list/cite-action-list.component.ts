// Copyright 2023 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, Input, OnDestroy, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  CiteAction,
  Team,
  Move
} from 'src/app/generated/blueprint.api';
import { MoveQuery } from 'src/app/data/move/move.query';
import { MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { TeamQuery } from 'src/app/data/team/team.query';
import { Sort } from '@angular/material/sort';
import { MatMenuTrigger } from '@angular/material/menu';
import { CiteActionDataService } from 'src/app/data/cite-action/cite-action-data.service';
import { CiteActionQuery } from 'src/app/data/cite-action/cite-action.query';
import { MatDialog } from '@angular/material/dialog';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { CiteActionEditDialogComponent } from '../cite-action-edit-dialog/cite-action-edit-dialog.component';

@Component({
  selector: 'app-cite-action-list',
  templateUrl: './cite-action-list.component.html',
  styleUrls: ['./cite-action-list.component.scss'],
  standalone: false
})
export class CiteActionListComponent implements OnDestroy {
  @Input() loggedInUserId: string;
  @Input() isContentDeveloper: boolean;
  @Input() showTemplates: boolean;
  msel = new MselPlus();
  citeActionList: CiteAction[] = [];
  templateList: CiteAction[] = [];
  changedCiteAction: CiteAction = {};
  filteredCiteActionList: CiteAction[] = [];
  filterControl = new FormControl();
  filterString = '';
  sort: Sort = { active: 'moveNumber', direction: 'asc' };
  sortedCiteActions: CiteAction[] = [];
  isAddingCiteAction = false;
  editingId = '';
  selectedMoveNumber = -1;
  selectedTeamId = '';
  teamList: Team[] = [];
  mselTeamList: Team[] = [];
  moveList: Move[] = [];
  private unsubscribe$ = new Subject();
  // context menu
  @ViewChild(MatMenuTrigger, { static: true }) contextMenu: MatMenuTrigger;
  contextMenuPosition = { x: '0px', y: '0px' };

  constructor(
    private mselQuery: MselQuery,
    private citeActionDataService: CiteActionDataService,
    private citeActionQuery: CiteActionQuery,
    private moveQuery: MoveQuery,
    private teamQuery: TeamQuery,
    public dialog: MatDialog,
    public dialogService: DialogService
  ) {
    // subscribe to citeActions
    this.citeActionQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((citeActions) => {
        this.citeActionList = citeActions;
        this.sortChanged(this.sort);
      });
    // subscribe to the active MSEL
    (this.mselQuery.selectActive() as Observable<MselPlus>)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((msel) => {
        if (msel && this.msel.id !== msel.id) {
          if (this.showTemplates) {
            this.msel = new MselPlus();
          } else {
            Object.assign(this.msel, msel);
          }
          this.sortedCiteActions = this.getSortedCiteActions(
            this.getFilteredCiteActions(false)
          );
        }
      });
    // subscribe to moves
    this.moveQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((moves) => {
        this.moveList = moves
          .filter((m) => m.mselId === this.msel.id)
          .sort((a, b) => (+a.moveNumber < +b.moveNumber ? -1 : 1));
      });
    // subscribe to mselTeams
    this.teamQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((teams) => {
        const mtList: Team[] = [];
        teams.forEach((mt) => {
          if (mt.mselId === this.msel.id) {
            mtList.push(mt);
          }
        });
        this.mselTeamList = mtList.sort((a, b) =>
          a.shortName.toLowerCase() < b.shortName.toLowerCase() ? -1 : 1
        );
      });
    // subscribe to filter changes
    this.filterControl.valueChanges
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((term) => {
        this.filterString = term;
        this.sortedCiteActions = this.getSortedCiteActions(
          this.getFilteredCiteActions(false)
        );
      });
    // load CiteAction templates
    this.citeActionDataService.loadTemplates();
  }

  addOrEditCiteAction(
    citeAction: CiteAction,
    makeTemplate: boolean,
    makeFromTemplate: boolean
  ) {
    if (!citeAction) {
      citeAction = {
        mselId: this.showTemplates ? '' : this.msel.id,
        moveNumber: 0,
        isTemplate: this.showTemplates,
        actionNumber: 0,
        teamId: '',
      };
    } else {
      const newAction = { ...citeAction };
      if (makeTemplate) {
        citeAction = {
          description: citeAction.description,
          isTemplate: true,
          moveNumber: 0,
          actionNumber: 0,
          teamId: '',
        };
      } else if (makeFromTemplate) {
        citeAction = {
          description: citeAction.description,
          mselId: this.msel.id,
          isTemplate: false,
        };
      } else {
        citeAction = { ...citeAction };
      }
    }
    const dialogRef = this.dialog.open(CiteActionEditDialogComponent, {
      width: '90%',
      maxWidth: '800px',
      data: {
        citeAction: { ...citeAction },
        teamList: this.mselTeamList,
        moveList: this.moveList,
        makeTemplate: makeTemplate,
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
    } else if (citeAction.isTemplate) {
      this.citeActionDataService.add(citeAction);
    } else {
      const teams: string[] = [];
      const moves: number[] = [];
      if (citeAction.teamId) {
        teams.push(citeAction.teamId);
      } else if (!citeAction.isTemplate) {
        this.mselTeamList.forEach((team) => {
          teams.push(team.id);
        });
      }
      if (+citeAction.moveNumber >= 0) {
        moves.push(citeAction.moveNumber);
      } else if (!citeAction.isTemplate) {
        this.moveList.forEach((move) => {
          moves.push(move.moveNumber);
        });
      }
      teams.forEach((team) => {
        moves.forEach((move) => {
          citeAction.teamId = team;
          citeAction.moveNumber = move;
          this.citeActionDataService.add(citeAction);
        });
      });
    }
  }

  deleteCiteAction(citeAction: CiteAction): void {
    if (
      this.isAddingCiteAction ||
      (this.editingId && this.editingId !== citeAction.id)
    ) {
      return;
    }
    const title = this.showTemplates ? 'Delete CITE Action Template' : 'Delete CITE Action';
    this.dialogService
      .confirm(
        title,
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
    this.sortedCiteActions = this.getSortedCiteActions(
      this.getFilteredCiteActions(false)
    );
    this.templateList = this.getSortedCiteActions(
      this.getFilteredCiteActions(true)
    );
  }

  getSortedCiteActions(citeActions: CiteAction[]) {
    if (citeActions) {
      citeActions = citeActions.sort((a, b) =>
        this.sortCiteActions(a, b, this.sort.active, this.sort.direction)
      );
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
      case 'description': // description, moveNumber, team
        if (a.description.toLowerCase() === b.description.toLowerCase()) {
          if (+a.moveNumber === +b.moveNumber) {
            return (a.team?.name < b.team?.name ? -1 : 1) * (isAsc ? 1 : -1);
          }
          return (+a.moveNumber < +b.moveNumber ? -1 : 1) * (isAsc ? 1 : -1);
        }
        return (
          (a.description.toLowerCase() < b.description.toLowerCase() ? -1 : 1) *
          (isAsc ? 1 : -1)
        );
        break;
      case 'team': // team, moveNumber, actionNumber
        if (a.team?.name === b.team?.name) {
          if (+a.moveNumber === +b.moveNumber) {
            return (
              (+a.actionNumber < +b.actionNumber ? -1 : 1) * (isAsc ? 1 : -1)
            );
          }
          return (+a.moveNumber < +b.moveNumber ? -1 : 1) * (isAsc ? 1 : -1);
        }
        return (a.team?.name < b.team?.name ? -1 : 1) * (isAsc ? 1 : -1);
        break;
      case 'moveNumber': // moveNumber, team, actionNumber
        if (+a.moveNumber === +b.moveNumber) {
          if (a.team?.name === b.team?.name) {
            return (
              (+a.actionNumber < +b.actionNumber ? -1 : 1) * (isAsc ? 1 : -1)
            );
          }
          return (a.team?.name < b.team?.name ? -1 : 1) * (isAsc ? 1 : -1);
        }
        return (+a.moveNumber < +b.moveNumber ? -1 : 1) * (isAsc ? 1 : -1);
      default:
        return 0;
    }
  }

  getFilteredCiteActions(getTemplatesOnly: boolean): CiteAction[] {
    const citeActions = this.citeActionList;
    const mselId = getTemplatesOnly || this.showTemplates ? '' : this.msel.id;
    let filteredCiteActions: CiteAction[] = [];
    if (citeActions) {
      citeActions.forEach((citeAction) => {
        if (
          (mselId && citeAction.mselId === mselId) ||
          (!mselId && !citeAction.mselId)
        ) {
          filteredCiteActions.push({ ...citeAction });
        }
      });
      if (filteredCiteActions && filteredCiteActions.length > 0) {
        if (this.filterString) {
          const filterString = this.filterString.toLowerCase();
          filteredCiteActions = filteredCiteActions.filter(
            (a) =>
              a.description.toLowerCase().includes(filterString) ||
              a.team?.name.toLowerCase().includes(filterString) ||
              a.team?.shortName.toLowerCase().includes(filterString)
          );
        }
        if (this.selectedMoveNumber >= 0) {
          filteredCiteActions = filteredCiteActions.filter(
            (a) => +a.moveNumber === +this.selectedMoveNumber
          );
        }
        if (this.selectedTeamId) {
          filteredCiteActions = filteredCiteActions.filter(
            (a) => a.teamId === this.selectedTeamId
          );
        }
      }
    }
    return filteredCiteActions;
  }

  selectMove(moveNumber: number) {
    this.selectedMoveNumber = moveNumber;
    this.sortedCiteActions = this.getSortedCiteActions(
      this.getFilteredCiteActions(false)
    );
  }

  selectTeam(teamId: string) {
    this.selectedTeamId = teamId;
    this.sortedCiteActions = this.getSortedCiteActions(
      this.getFilteredCiteActions(false)
    );
  }

  getTeamDisplay(id: string): string {
    const team = this.mselTeamList.find((m) => m.id === id);
    return team ? team.shortName + ' - ' + team.name : ' ';
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
