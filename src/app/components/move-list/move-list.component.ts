// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, OnDestroy, AfterViewInit, inject, input, viewChild } from '@angular/core';
import { UntypedFormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatTableDataSource, MatTable, MatColumnDef, MatHeaderCellDef, MatHeaderCell, MatCellDef, MatCell, MatHeaderRowDef, MatHeaderRow, MatRowDef, MatRow } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Move } from 'src/app/generated/blueprint.api';
import { MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { Sort, MatSort, MatSortHeader } from '@angular/material/sort';
import { MatMenuTrigger } from '@angular/material/menu';
import { MoveDataService } from 'src/app/data/move/move-data.service';
import { MoveQuery } from 'src/app/data/move/move.query';
import { MoveEditDialogComponent } from '../move-edit-dialog/move-edit-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { v4 as uuidv4 } from 'uuid';
import { MatIcon } from '@angular/material/icon';
import { DatePipe } from '@angular/common';
import { MatFormField, MatInput, MatSuffix } from '@angular/material/input';
import { MatIconButton } from '@angular/material/button';
import { DurationViewComponent } from '../shared/duration-view/duration-view.component';
import { TimezoneAbbrPipe } from '../../utilities/timezone-abbr';

@Component({
    selector: 'app-move-list',
    templateUrl: './move-list.component.html',
    styleUrls: ['./move-list.component.scss'],
    imports: [MatIcon, MatFormField, MatInput, FormsModule, ReactiveFormsModule, MatIconButton, MatSuffix, MatPaginator, MatTable, MatSort, MatColumnDef, MatHeaderCellDef, MatHeaderCell, MatCellDef, MatCell, MatSortHeader, DurationViewComponent, MatHeaderRowDef, MatHeaderRow, MatRowDef, MatRow, DatePipe, TimezoneAbbrPipe]
})
export class MoveListComponent implements OnDestroy, AfterViewInit {
  private mselQuery = inject(MselQuery);
  private moveDataService = inject(MoveDataService);
  private moveQuery = inject(MoveQuery);
  dialog = inject(MatDialog);
  dialogService = inject(CrucibleDialogService);

  readonly loggedInUserId = input<string>(undefined);
  readonly canEditMsel = input<boolean>(undefined);
  msel = new MselPlus();
  moveList: Move[] = [];
  changedMove: Move = {};
  filteredMoveList: Move[] = [];
  filterControl = new UntypedFormControl();
  filterString = '';
  sort: Sort = { active: 'moveNumber', direction: 'asc' };
  displayedMoves: Move[] = [];
  moveDataSource = new MatTableDataSource<Move>(new Array<Move>());
  displayedColumns: string[] = ['action', 'moveNumber', 'timeToggle', 'moveStartTime', 'situationTime', 'description'];
  isAddingMove = false;
  editingId = '';
  showRealTime = false;
  maxMoveNumber = Number.MIN_SAFE_INTEGER;
  maxMoveStartSeconds = 0;

  private unsubscribe$ = new Subject();
  // context menu
  readonly contextMenu = viewChild(MatMenuTrigger);
  readonly paginator = viewChild(MatPaginator);
  contextMenuPosition = { x: '0px', y: '0px' };

  constructor() {
    // subscribe to move changes
    this.moveQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((moves) => {
        this.moveList = moves;
        this.displayedMoves = this.getSortedMoves(this.getFilteredMoves());
        this.setNewMoveDefaults();
      });
    // subscribe to the active MSEL
    (this.mselQuery.selectActive() as Observable<MselPlus>)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((msel) => {
        if (msel && this.msel.id !== msel.id) {
          Object.assign(this.msel, msel);
          this.displayedMoves = this.getSortedMoves(this.getFilteredMoves());
          this.setNewMoveDefaults();
        }
      });
    this.filterControl.valueChanges
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((term) => {
        this.filterString = term;
        this.displayedMoves = this.getSortedMoves(this.getFilteredMoves());
      });
  }

  ngAfterViewInit() {
    this.moveDataSource.paginator = this.paginator();
  }

  getSortedMoves(moves: Move[]) {
    if (moves) {
      moves.sort((a, b) =>
        this.sortMoves(a, b, this.sort.active, this.sort.direction)
      );
    }
    this.moveDataSource.data = moves || [];
    return moves;
  }

  addOrEditMove(move: Move) {
    let dialogTitle = '';
    let editMove: Move = {};
    if (!move) {
      dialogTitle = 'Add a Move';
      editMove = {
        moveNumber: this.maxMoveNumber + 1,
        deltaSeconds: this.maxMoveStartSeconds,
        description: '',
        situationDescription: '',
        situationTime: new Date(),
        mselId: this.msel.id,
      };
    } else {
      dialogTitle = 'Edit Move';
      // make sure all move dates are actual dates
      editMove = { ...move };
      this.moveDataService.setAsDates(editMove);
    }
    const dialogRef = this.dialog.open(MoveEditDialogComponent, {
      maxWidth: '90vw',
      width: 'auto',
      minWidth: '900px',
      data: {
        move: editMove,
        mselStartTime: this.msel.startTime,
        title: dialogTitle,
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
      .confirm({ title: 'Delete Move', message: 'Are you sure that you want to delete ' + move.description + '?'
       }).afterClosed().subscribe((result) => {
        if (result) {
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
    this.moveDataSource.data = this.displayedMoves;
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
      case 'moveStartTime':
        return (a.moveStartTime < b.moveStartTime ? -1 : 1) * (isAsc ? 1 : -1);
        break;
      case 'situationTime':
        return (a.situationTime < b.situationTime ? -1 : 1) * (isAsc ? 1 : -1);
        break;
      case 'description':
        return (
          (a.description < b.description ? -1 : 1) *
          (isAsc ? 1 : -1)
        );
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

  // The move store can hold other MSELs' moves as well: a user with EditMsels is sent every
  // MSEL's move changes. Only this MSEL's moves are listed, or count toward a new move's
  // defaults and the start time order.
  private mselMoves(): Move[] {
    return (this.moveList ?? []).filter((m) => m.mselId === this.msel.id);
  }

  // A new move gets the next move number and the latest start offset of this MSEL's moves.
  private setNewMoveDefaults() {
    const moves = this.mselMoves();
    this.maxMoveNumber = moves.length > 0
      ? Math.max(...moves.map((o) => +o.moveNumber))
      : 0;
    this.maxMoveStartSeconds = moves.length > 0
      ? Math.max(...moves.map((o) => +o.deltaSeconds))
      : 0;
  }

  getFilteredMoves(): Move[] {
    let filteredMoves: Move[] = [];
    if (this.moveList) {
      filteredMoves = this.mselMoves().map((m) => ({ ...m }));
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
    const orderedMoves = this.mselMoves().sort((a, b) =>
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
