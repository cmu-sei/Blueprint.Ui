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
import { MatMenuTrigger } from '@angular/material/menu';
import { CardDataService } from 'src/app/data/card/card-data.service';
import { CardQuery } from 'src/app/data/card/card.query';
import { MoveQuery } from 'src/app/data/move/move.query';
import { MatDialog } from '@angular/material/dialog';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { CardEditDialogComponent } from '../card-edit-dialog/card-edit-dialog.component';
import { v4 as uuidv4 } from 'uuid';

@Component({
  selector: 'app-card-list',
  templateUrl: './card-list.component.html',
  styleUrls: ['./card-list.component.scss'],
})
export class CardListComponent implements OnDestroy {
  @Input() loggedInUserId: string;
  @Input() isContentDeveloper: boolean;
  @Input() showTemplates: boolean;
  // context menu
  @ViewChild(MatMenuTrigger, { static: true }) contextMenu: MatMenuTrigger;
  msel = new MselPlus();
  templateList: Card[] = [];
  cardList: Card[] = [];
  filteredCardList: Card[] = [];
  filterControl = new UntypedFormControl();
  filterString = '';
  sort: Sort = { active: '', direction: '' };
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
      this.sortChanged(this.sort);
    });
    // subscribe to moves
    this.moveQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(moves => {
      this.moveList = moves;
    });
    // subscribe to the active MSEL
    (this.mselQuery.selectActive() as Observable<MselPlus>).pipe(takeUntil(this.unsubscribe$)).subscribe(msel => {
      if (this.showTemplates) {
        this.msel = new MselPlus();
      } else {
        Object.assign(this.msel, msel);
      }
      this.sortedCards = this.getSortedCards(this.getFilteredCards(false));
    });
    this.filterControl.valueChanges
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((term) => {
        this.filterString = term;
        this.sortedCards = this.getSortedCards(this.getFilteredCards(false));
      });
    // load card templates
    this.cardDataService.loadTemplates();
  }

  expandCard(cardId: string) {
    if (cardId === this.expandedId) {
      this.expandedId = '';
    } else {
      this.expandedId = cardId;
    }
  }

  addOrEditCard(card: Card, makeTemplate: boolean, makeFromTemplate: boolean) {
    if (!card) {
      card = {
        mselId: this.showTemplates ? '' : this.msel.id,
        move: 0,
        isTemplate: this.showTemplates,
        inject: 0
      };
    } else {
      if (makeTemplate) {
        card = {
          name: card.name,
          description: card.description,
          isTemplate: true,
          move: 0,
          inject: 0
        };
      } else if (makeFromTemplate) {
        card = {
          name: card.name,
          description: card.description,
          mselId: this.msel.id,
          isTemplate: false,
          move: 0,
          inject: 0
        };
      } else {
        card = { ...card };
      }
    }
    const dialogRef = this.dialog.open(CardEditDialogComponent, {
      width: '90%',
      maxWidth: '800px',
      data: {
        card: { ...card },
        moveList: this.moveList
          .filter(m => m.mselId === this.msel.id)
          .sort((a, b) => +a.moveNumber < +b.moveNumber ? -1 : 1)
      },
    });
    dialogRef.componentInstance.editComplete.subscribe((result) => {
      if (result.saveChanges && result.card) {
        this.saveCard(result.card);
      }
      dialogRef.close();
    });
  }

  saveCard(card: Card) {
    if (card.id) {
      this.cardDataService.updateCard(card);
    } else {
      card.id = uuidv4();
      this.cardDataService.add(card);
    }
  }

  deleteCard(card: Card): void {
    this.dialogService
      .confirm(
        'Delete Card',
        'Are you sure that you want to delete ' + card.name + '?'
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
    this.sortedCards = this.getSortedCards(this.getFilteredCards(false));
    this.templateList = this.getSortedCards(this.getFilteredCards(true));
  }

  getFilteredCards(getTemplatesOnly: boolean): Card[] {
    const cards = this.cardList;
    const mselId = getTemplatesOnly || this.showTemplates ? '' : this.msel.id;
    let filteredCards: Card[] = [];
    if (cards) {
      cards.forEach(card => {
        if ((mselId && card.mselId === mselId) || (!mselId && !card.mselId)) {
          filteredCards.push({ ...card });
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
