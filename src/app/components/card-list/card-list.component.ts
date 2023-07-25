// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, Input, OnDestroy, ViewChild } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  Card,
  Move
} from 'src/app/generated/blueprint.api';
import { MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { Sort } from '@angular/material/sort';
import { MatLegacyMenuTrigger as MatMenuTrigger } from '@angular/material/legacy-menu';
import { CardDataService } from 'src/app/data/card/card-data.service';
import { CardQuery } from 'src/app/data/card/card.query';
import { MoveQuery } from 'src/app/data/move/move.query';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { CardEditDialogComponent } from '../card-edit-dialog/card-edit-dialog.component';

@Component({
  selector: 'app-card-list',
  templateUrl: './card-list.component.html',
  styleUrls: ['./card-list.component.scss'],
})
export class CardListComponent implements OnDestroy {
  @Input() loggedInUserId: string;
  @Input() isContentDeveloper: boolean;
  // context menu
  @ViewChild(MatMenuTrigger, { static: true }) contextMenu: MatMenuTrigger;
  msel = new MselPlus();
  cardList: Card[] = [];
  filteredCardList: Card[] = [];
  filterControl = new UntypedFormControl();
  filterString = '';
  sort: Sort = {active: '', direction: ''};
  sortedCards: Card[] = [];
  expandedId = '';
  contextMenuPosition = { x: '0px', y: '0px' };
  moveList: Move[] = [];
  private unsubscribe$ = new Subject();

  constructor(
    private mselQuery: MselQuery,
    private cardDataService: CardDataService,
    private cardQuery: CardQuery,
    private moveQuery: MoveQuery,
    public dialog: MatDialog,
    public dialogService: DialogService
  ) {
    // subscribe to cards
    this.cardQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(cards => {
      this.cardList = cards;
      this.sortedCards = this.getSortedCards(this.getFilteredCards(this.cardList));
    });
    // subscribe to moves
    this.moveQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(moves => {
      this.moveList = moves;
    });
    // subscribe to the active MSEL
    (this.mselQuery.selectActive() as Observable<MselPlus>).pipe(takeUntil(this.unsubscribe$)).subscribe(msel => {
      Object.assign(this.msel, msel);
      this.sortedCards = this.getSortedCards(this.getFilteredCards(this.cardList));
    });
    this.filterControl.valueChanges
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((term) => {
        this.filterString = term;
        this.sortedCards = this.getSortedCards(this.getFilteredCards(this.cardList));
      });
  }

  expandCard(cardId: string) {
    if (cardId === this.expandedId) {
      this.expandedId = '';
    } else {
      this.expandedId = cardId;
    }
  }

  addCard() {
    const card = {
      mselId: this.msel.id,
      move: 0,
      inject: 0
    };
    this.editCard(card);
  }

  editCard(card: Card) {
    const dialogRef = this.dialog.open(CardEditDialogComponent, {
      width: '90%',
      maxWidth: '800px',
      data: {
        card: card,
        moveList: this.moveList
          .filter(m => m.mselId === this.msel.id)
          .sort((a, b) => +a.moveNumber < +b.moveNumber ? -1 : 1)
      },
    });
    dialogRef.componentInstance.editComplete.subscribe((result) => {
      if (result.saveChanges && result.card) {
        if (result.card.id) {
          this.cardDataService.updateCard(card);
        } else {
          this.cardDataService.add(card);
        }
      }
      dialogRef.close();
    });
  }

  deleteCard(card: Card): void {
    this.dialogService
      .confirm(
        'Delete Card',
        'Are you sure that you want to delete ' + card.description + '?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.cardDataService.delete(card.id);
          this.expandedId = '';
        }
      });
  }

  sortChanged(sort: Sort) {
    this.sort = sort;
    this.sortedCards = this.getSortedCards(this.getFilteredCards(this.cardList));
  }

  getFilteredCards(cards: Card[]): Card[] {
    let filteredCards: Card[] = [];
    if (cards) {
      cards.forEach(se => {
        if (se.mselId === this.msel.id) {
          filteredCards.push({... se});
        }
      });
      if (filteredCards && filteredCards.length > 0 && this.filterString) {
        const filterString = this.filterString.toLowerCase();
        filteredCards = filteredCards
          .filter((a) =>
            a.description.toLowerCase().includes(filterString)
          );
      }
    }
    return filteredCards;
  }

  getSortedCards(cards: Card[]) {
    const dir = this.sort.direction === 'desc' ? -1 : 1;
    if (cards) {
      switch (this.sort.active) {
        case 'move':
          cards.sort((a, b) => +a.move > +b.move ? dir : -dir);
          break;
        case 'inject':
          cards.sort((a, b) => +a.inject > +b.inject ? dir : -dir);
          break;
        case 'description':
          cards.sort((a, b) => (a.description ? a.description : '').toLowerCase() >
            (b.description ? b.description : '').toLowerCase() ? dir : -dir);
          break;
        default:
          cards.sort((a, b) => a.name.toLowerCase() > b.name.toLowerCase() ? dir : -dir);
          break;
      }
    }
    return cards;
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
