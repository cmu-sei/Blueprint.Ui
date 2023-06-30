// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, Input, OnDestroy, ViewChild } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  Card,
} from 'src/app/generated/blueprint.api';
import { MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { Sort } from '@angular/material/sort';
import { MatLegacyMenuTrigger as MatMenuTrigger } from '@angular/material/legacy-menu';
import { CardDataService } from 'src/app/data/card/card-data.service';
import { CardQuery } from 'src/app/data/card/card.query';
import { CardTeamDataService } from 'src/app/data/team/card-team-data.service';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { v4 as uuidv4 } from 'uuid';

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
  changedCard: Card = {};
  filteredCardList: Card[] = [];
  filterControl = new UntypedFormControl();
  filterString = '';
  sort: Sort = {active: '', direction: ''};
  sortedCards: Card[] = [];
  isAddingCard = false;
  editingId = '';
  contextMenuPosition = { x: '0px', y: '0px' };
  private unsubscribe$ = new Subject();

  constructor(
    private mselQuery: MselQuery,
    private cardDataService: CardDataService,
    private cardQuery: CardQuery,
    private cardTeamDataService: CardTeamDataService,
    public dialog: MatDialog,
    public dialogService: DialogService
  ) {
    // subscribe to cards
    this.cardQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(cards => {
      this.cardList = cards;
      this.sortedCards = this.getSortedCards(this.getFilteredCards(this.cardList));
    });
    // subscribe to the active MSEL
    (this.mselQuery.selectActive() as Observable<MselPlus>).pipe(takeUntil(this.unsubscribe$)).subscribe(msel => {
      if (msel && this.msel.id !== msel.id) {
        Object.assign(this.msel, msel);
        this.sortedCards = this.getSortedCards(this.getFilteredCards(this.cardList));
      }
    });
    this.filterControl.valueChanges
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((term) => {
        this.filterString = term;
        this.sortedCards = this.getSortedCards(this.getFilteredCards(this.cardList));
      });
  }

  getSortedCards(cards: Card[]) {
    if (cards) {
      cards.sort((a, b) => +a.move > +b.move ? 1 : -1);
    }
    return cards;
  }

  noExpansionChangeAllowed() {
    return this.isAddingCard || this.valuesHaveBeenChanged();
  }

  editCard(card: Card) {
    if (this.isAddingCard) {
      return;
    }
    // previous edit has not been saved, so prompt
    if (this.valuesHaveBeenChanged()) {
      this.dialogService
        .confirm(
          'Changes have been made!',
          'Do you want to save them?'
        )
        .subscribe((result) => {
          if (result['confirm']) {
            this.cardDataService.updateCard(this.changedCard);
          }
          this.setEditing(card);
        });
    // if adding a new card, don't start editing another one
    } else {
      this.setEditing(card);
    }
  }

  setEditing(card) {
    if (card.id === this.editingId) {
      this.editingId = '';
      this.changedCard = {};
    } else {
      this.editingId = card.id;
      this.changedCard = {... card};
    }
  }

  valuesHaveBeenChanged() {
    let isChanged = false;
    const original = this.cardList.find(df => df.id === this.editingId);
    if (original) {
      isChanged = this.changedCard.move !== original.move ||
      this.changedCard.inject !== original.inject ||
      this.changedCard.name !== original.name ||
      this.changedCard.description !== original.description;
    }
    return isChanged;
  }

  saveCard() {
    this.cardDataService.updateCard(this.changedCard);
    this.editingId = '';
  }

  resetCard() {
    this.changedCard = {};
    this.editingId = '';
  }

  addCard() {
    this.changedCard = {
      id: uuidv4(),
      mselId: this.msel.id,
      move: 0,
      inject: 0
    };
    this.isAddingCard = true;
  }

  saveNewCard() {
    this.isAddingCard = false;
    this.cardDataService.add(this.changedCard);
  }

  cancelNewCard() {
    this.isAddingCard = false;
  }

  deleteCard(card: Card): void {
    if (this.isAddingCard || (this.editingId && this.editingId !== card.id)) {
      return;
    }
    this.dialogService
      .confirm(
        'Delete Card',
        'Are you sure that you want to delete ' + card.description + '?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.cardDataService.delete(card.id);
          this.editingId = '';
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

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
