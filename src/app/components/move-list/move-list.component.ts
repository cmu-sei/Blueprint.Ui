// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, Input, OnDestroy, ViewChild } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Move } from 'src/app/generated/blueprint.api';
import { MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { Sort } from '@angular/material/sort';
import { MatLegacyMenuTrigger as MatMenuTrigger } from '@angular/material/legacy-menu';
import { MoveDataService } from 'src/app/data/move/move-data.service';
import { MoveQuery } from 'src/app/data/move/move.query';
import { MoveEditDialogComponent } from '../move-edit-dialog/move-edit-dialog.component';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
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
  filterControl = new UntypedFormControl();
  filterString = '';
  sort: Sort = { active: 'moveNumber', direction: 'asc' };
  displayedMoves: Move[] = [];
  isAddingMove = false;
  editingId = '';
  showRealTime = false;
  maxMoveNumber = Number.MIN_SAFE_INTEGER;
  maxMoveStartSeconds = 0;

  private unsubscribe$ = new Subject();
  // context menu
  @ViewChild(MatMenuTrigger, { static: true }) contextMenu: MatMenuTrigger;
  contextMenuPosition = { x: '0px', y: '0px' };

  constructor(
    private mselQuery: MselQuery,
    private moveDataService: MoveDataService,
    private moveQuery: MoveQuery,
    public dialog: MatDialog,
    public dialogService: DialogService
  ) {
    // subscribe to move changes
    this.moveQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((moves) => {
        this.moveList = moves;
        this.displayedMoves = this.getSortedMoves(this.getFilteredMoves());
        this.maxMoveNumber = Math.max.apply(
          Math,
          moves.map(function (o) {
            return +o.moveNumber;
          })
        );
        this.maxMoveStartSeconds = Math.max.apply(
          Math,
          moves.map(function (o) {
            return +o.deltaSeconds;
          })
        );
      });
    // subscribe to the active MSEL
    (this.mselQuery.selectActive() as Observable<MselPlus>)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((msel) => {
        if (msel && this.msel.id !== msel.id) {
          Object.assign(this.msel, msel);
          this.displayedMoves = this.getSortedMoves(this.getFilteredMoves());
        }
      });
    this.filterControl.valueChanges
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((term) => {
        this.filterString = term;
        this.displayedMoves = this.getSortedMoves(this.getFilteredMoves());
      });
  }

  getSortedMoves(moves: Move[]) {
    if (moves) {
      moves.sort((a, b) =>
        this.sortMoves(a, b, this.sort.active, this.sort.direction)
      );
    }
    return moves;
  }

  addOrEditMove(move: Move) {
    let editMove: Move = {};
    if (!move) {
      editMove = {
        moveNumber: this.maxMoveNumber + 1,
        deltaSeconds: this.maxMoveStartSeconds,
        description: '',
        situationDescription: '',
        situationTime: new Date(),
        mselId: this.msel.id,
      };
    } else {
      // make sure all move dates are actual dates
      editMove = { ...move };
      this.moveDataService.setAsDates(editMove);
    }
    const dialogRef = this.dialog.open(MoveEditDialogComponent, {
      width: '800px',
      data: {
        move: editMove,
        mselStartTime: this.msel.startTime,
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
    this.sort =
      sort && sort.active ? sort : { active: 'moveNumber', direction: 'asc' };
    this.displayedMoves = this.displayedMoves.sort((a, b) =>
      this.sortMoves(a, b, sort.active, sort.direction)
    );
  }

  private sortMoves(a: Move, b: Move, column: string, direction: string) {
    const isAsc = direction !== 'desc';
    switch (column) {
      case 'moveNumber':
        return (+a.moveNumber < +b.moveNumber ? -1 : 1) * (isAsc ? 1 : -1);
        break;
      case 'deltaSeconds':
        return (a.deltaSeconds < b.deltaSeconds ? -1 : 1) * (isAsc ? 1 : -1);
        break;
      case 'situationTime':
        return (a.situationTime < b.situationTime ? -1 : 1) * (isAsc ? 1 : -1);
        break;
      case 'situationDescription':
        return (
          (a.situationDescription < b.situationDescription ? -1 : 1) *
          (isAsc ? 1 : -1)
        );
        break;
      default:
        return 0;
    }
  }

  getFilteredMoves(): Move[] {
    let filteredMoves: Move[] = [];
    if (this.moveList) {
      this.moveList.forEach((m) => {
        if (m.mselId === this.msel.id) {
          filteredMoves.push({ ...m });
        }
      });
      if (filteredMoves && filteredMoves.length > 0 && this.filterString) {
        const filterString = this.filterString.toLowerCase();
        filteredMoves = filteredMoves.filter(
          (a) =>
            a.description.toLowerCase().includes(filterString) ||
            a.situationDescription.toLowerCase().includes(filterString)
        );
      }
    }
    return filteredMoves;
  }

  badMoveTimeOrder(): boolean {
    const orderedMoves = this.moveList.sort((a, b) =>
      +a.moveNumber < +b.moveNumber ? -1 : 1
    );
    let deltaSeconds = Number.MIN_SAFE_INTEGER;
    for (let index = 0; index < orderedMoves.length; index++) {
      if (+orderedMoves[index].deltaSeconds <= +deltaSeconds) {
        return true;
      }
      deltaSeconds = orderedMoves[index].deltaSeconds;
    }
    return false;
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
