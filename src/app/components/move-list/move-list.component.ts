// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license, please see LICENSE.md in the project root for license information or contact permission@sei.cmu.edu for full terms.
import { Component, Input, OnDestroy, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatSidenav } from '@angular/material/sidenav';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Observable, BehaviorSubject } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';
import {
  ComnSettingsService,
  Theme,
  ComnAuthQuery,
} from '@cmusei/crucible-common';
import { UserDataService } from 'src/app/data/user/user-data.service';
import { TopbarView } from './../shared/top-bar/topbar.models';
import {
  Msel,
  Move
} from 'src/app/generated/blueprint.api';
import { MselDataService, MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { Sort } from '@angular/material/sort';
import { MatMenuTrigger } from '@angular/material/menu';
import { MoveDataService } from 'src/app/data/move/move-data.service';
import { MoveQuery } from 'src/app/data/move/move.query';
import { MoveEditDialogComponent } from '../move-edit-dialog copy/move-edit-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { v4 as uuidv4 } from 'uuid';

@Component({
  selector: 'app-move-list',
  templateUrl: './move-list.component.html',
  styleUrls: ['./move-list.component.scss'],
})
export class MoveListComponent implements OnDestroy {
  @Input() loggedInUserId: string;
  @Input() isContentDeveloper: boolean;
  msel = new MselPlus();
  moveList: Move[] = [];
  changedMove: Move = {};
  filteredMoveList: Move[] = [];
  filterControl = new FormControl();
  filterString = '';
  sort: Sort = {active: '', direction: ''};
  sortedMoves: Move[] = [];
  isAddingMove = false;
  editingId = '';

  private unsubscribe$ = new Subject();
  // context menu
  @ViewChild(MatMenuTrigger, { static: true }) contextMenu: MatMenuTrigger;
  contextMenuPosition = { x: '0px', y: '0px' };

  constructor(
    activatedRoute: ActivatedRoute,
    private router: Router,
    private userDataService: UserDataService,
    private settingsService: ComnSettingsService,
    private authQuery: ComnAuthQuery,
    private mselDataService: MselDataService,
    private mselQuery: MselQuery,
    private moveDataService: MoveDataService,
    private moveQuery: MoveQuery,
    public dialog: MatDialog,
    public dialogService: DialogService
  ) {
    // subscribe to moves
    this.moveQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(moves => {
      this.moveList = moves;
      this.sortedMoves = this.getSortedMoves(this.getFilteredMoves(this.moveList));
    });
    // subscribe to the active MSEL
    (this.mselQuery.selectActive() as Observable<MselPlus>).pipe(takeUntil(this.unsubscribe$)).subscribe(msel => {
      if (msel) {
        Object.assign(this.msel, msel);
        this.sortedMoves = this.getSortedMoves(this.getFilteredMoves(this.moveList));
      }
    });
    this.filterControl.valueChanges
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((term) => {
        this.filterString = term;
        this.sortedMoves = this.getSortedMoves(this.getFilteredMoves(this.moveList));
      });
  }

  getSortedMoves(moves: Move[]) {
    if (moves) {
      moves.sort((a, b) => +a.moveNumber > +b.moveNumber ? 1 : -1);
    }
    return moves;
  }

  addOrEditMove(move: Move) {
    if (!move) {
      move = {
        title: '',
        description: '',
        mselId: this.msel.id
      };
    }
    const dialogRef = this.dialog.open(MoveEditDialogComponent, {
      width: '800px',
      data: {
        move: move
      },
    });
    dialogRef.componentInstance.editComplete.subscribe((result) => {
      if (result.saveChanges && result.move) {
        this.saveMove(result.move);
      }
      dialogRef.close();
    });
  }

  saveMove(move: Move) {
    if (move.id) {
      this.moveDataService.updateMove(move);
    } else {
      move.id = uuidv4();
      this.moveDataService.add(move);
    }
  }

  deleteMove(move: Move): void {
    if (this.isAddingMove || (this.editingId && this.editingId !== move.id)) {
      return;
    }
    this.dialogService
      .confirm(
        'Delete Move',
        'Are you sure that you want to delete ' + move.description + '?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.moveDataService.delete(move.id);
          this.editingId = '';
        }
      });
  }

  sortChanged(sort: Sort) {
    this.sort = sort;
    this.sortedMoves = this.getSortedMoves(this.getFilteredMoves(this.moveList));
  }

  private sortMoves(
    a: Move,
    b: Move,
    column: string,
    direction: string
  ) {
    const isAsc = direction !== 'desc';
    switch (column) {
      case 'moveNumber':
        return ( (a.moveNumber < b.moveNumber ? -1 : 1) * (isAsc ? 1 : -1) );
        break;
      case 'description':
        return ( (a.description < b.description ? -1 : 1) * (isAsc ? 1 : -1) );
        break;
      default:
        return 0;
    }
  }

  getFilteredMoves(moves: Move[]): Move[] {
    let filteredMoves: Move[] = [];
    if (moves) {
      moves.forEach(se => {
        if (se.mselId === this.msel.id) {
          filteredMoves.push({... se});
        }
      });
      if (filteredMoves && filteredMoves.length > 0 && this.filterString) {
        const filterString = this.filterString.toLowerCase();
        filteredMoves = filteredMoves
          .filter((a) =>
            a.description.toLowerCase().includes(filterString)
          );
      }
    }
    return filteredMoves;
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
