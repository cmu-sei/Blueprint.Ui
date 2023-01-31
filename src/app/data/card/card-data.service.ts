// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license, please see LICENSE.md in the project root for license information or contact permission@sei.cmu.edu for full terms.

import { CardStore } from './card.store';
import { CardQuery } from './card.query';
import { Injectable } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { LegacyPageEvent as PageEvent } from '@angular/material/legacy-paginator';
import { Router, ActivatedRoute } from '@angular/router';
import {
  Card,
  CardService,
  ItemStatus
} from 'src/app/generated/blueprint.api';
import { map, take, tap } from 'rxjs/operators';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class CardDataService {
  private _requestedCardId: string;
  private _requestedCardId$ = this.activatedRoute.queryParamMap.pipe(
    map((params) => params.get('cardId') || '')
  );
  readonly CardList: Observable<Card[]>;
  readonly filterControl = new UntypedFormControl();
  private filterTerm: Observable<string>;
  private sortColumn: Observable<string>;
  private sortIsAscending: Observable<boolean>;
  private _pageEvent: PageEvent = { length: 0, pageIndex: 0, pageSize: 10 };
  readonly pageEvent = new BehaviorSubject<PageEvent>(this._pageEvent);
  private pageSize: Observable<number>;
  private pageIndex: Observable<number>;

  constructor(
    private cardStore: CardStore,
    private cardQuery: CardQuery,
    private cardService: CardService,
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {
    this.filterTerm = activatedRoute.queryParamMap.pipe(
      map((params) => params.get('cardmask') || '')
    );
    this.filterControl.valueChanges.subscribe((term) => {
      this.router.navigate([], {
        queryParams: { cardmask: term },
        queryParamsHandling: 'merge',
      });
    });
    this.sortColumn = activatedRoute.queryParamMap.pipe(
      map((params) => params.get('sorton') || 'name')
    );
    this.sortIsAscending = activatedRoute.queryParamMap.pipe(
      map((params) => (params.get('sortdir') || 'asc') === 'asc')
    );
    this.pageSize = activatedRoute.queryParamMap.pipe(
      map((params) => parseInt(params.get('pagesize') || '20', 10))
    );
    this.pageIndex = activatedRoute.queryParamMap.pipe(
      map((params) => parseInt(params.get('pageindex') || '0', 10))
    );
    this.CardList = combineLatest([
      this.cardQuery.selectAll(),
      this.filterTerm,
      this.sortColumn,
      this.sortIsAscending,
      this.pageSize,
      this.pageIndex,
    ]).pipe(
      map(
        ([
          items,
          filterTerm,
          sortColumn,
          sortIsAscending,
          pageSize,
          pageIndex,
        ]) =>
          items
            ? (items as Card[])
                .sort((a: Card, b: Card) =>
                  this.sortCards(a, b, sortColumn, sortIsAscending)
                )
                .filter(
                  (card) =>
                    ('' + card.description)
                      .toLowerCase()
                      .includes(filterTerm.toLowerCase()) ||
                    card.id
                      .toLowerCase()
                      .includes(filterTerm.toLowerCase())
                )
            : []
      )
    );
  }

  private sortCards(
    a: Card,
    b: Card,
    column: string,
    isAsc: boolean
  ) {
    switch (column) {
      case 'description':
        return (
          (a.description.toLowerCase() < b.description.toLowerCase() ? -1 : 1) *
          (isAsc ? 1 : -1)
        );
      case 'dateCreated':
        return (
          (a.dateCreated.valueOf() < b.dateCreated.valueOf() ? -1 : 1) *
          (isAsc ? 1 : -1)
        );
      default:
        return 0;
    }
  }

  loadByMsel(mselId: string) {
    this.cardStore.setLoading(true);
    this.cardService
      .getByMsel(mselId)
      .pipe(
        tap(() => {
          this.cardStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (cards) => {
          this.cardStore.set(cards);
        },
        (error) => {
          this.cardStore.set([]);
        }
      );
  }

  loadById(id: string) {
    this.cardStore.setLoading(true);
    return this.cardService
      .getCard(id)
      .pipe(
        tap(() => {
          this.cardStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.cardStore.upsert(s.id, { ...s });
      });
  }

  unload() {
    this.cardStore.set([]);
  }

  add(card: Card) {
    this.cardStore.setLoading(true);
    this.cardService
      .createCard(card)
      .pipe(
        tap(() => {
          this.cardStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.cardStore.add(s);
      });
  }

  updateCard(card: Card) {
    this.cardStore.setLoading(true);
    this.cardService
      .updateCard(card.id, card)
      .pipe(
        tap(() => {
          this.cardStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((n) => {
        this.updateStore(n);
      });
  }

  delete(id: string) {
    this.cardService
      .deleteCard(id)
      .pipe(take(1))
      .subscribe((r) => {
        this.deleteFromStore(id);
      });
  }

  setPageEvent(pageEvent: PageEvent) {
    this.cardStore.update({ pageEvent: pageEvent });
  }

  updateStore(card: Card) {
    this.cardStore.upsert(card.id, card);
  }

  deleteFromStore(id: string) {
    this.cardStore.remove(id);
  }
}
