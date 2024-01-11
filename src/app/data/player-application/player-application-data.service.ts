/*
 Copyright 2023 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { PlayerApplicationStore } from './player-application.store';
import { PlayerApplicationQuery } from './player-application.query';
import { Injectable } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { LegacyPageEvent as PageEvent } from '@angular/material/legacy-paginator';
import { Router, ActivatedRoute } from '@angular/router';
import {
  PlayerApplication,
  PlayerApplicationService,
} from 'src/app/generated/blueprint.api';
import { map, take, tap } from 'rxjs/operators';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class PlayerApplicationDataService {
  readonly PlayerApplicationList: Observable<PlayerApplication[]>;
  readonly filterControl = new UntypedFormControl();
  private _requestedPlayerApplicationId$ = this.activatedRoute.queryParamMap.pipe(
    map((params) => params.get('playerApplicationId') || '')
  );
  private filterTerm: Observable<string>;
  private sortColumn: Observable<string>;
  private sortIsAscending: Observable<boolean>;
  private _pageEvent: PageEvent = { length: 0, pageIndex: 0, pageSize: 10 };
  readonly pageEvent = new BehaviorSubject<PageEvent>(this._pageEvent);  private _requestedPlayerApplicationId: string;
  private pageSize: Observable<number>;
  private pageIndex: Observable<number>;

  constructor(
    private playerApplicationStore: PlayerApplicationStore,
    private playerApplicationQuery: PlayerApplicationQuery,
    private playerApplicationService: PlayerApplicationService,
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {
    this.filterTerm = activatedRoute.queryParamMap.pipe(
      map((params) => params.get('playerApplicationmask') || '')
    );
    this.filterControl.valueChanges.subscribe((term) => {
      this.router.navigate([], {
        queryParams: { playerApplicationmask: term },
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
    this.PlayerApplicationList = combineLatest([
      this.playerApplicationQuery.selectAll(),
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
            ? (items as PlayerApplication[])
              .sort((a: PlayerApplication, b: PlayerApplication) =>
                this.sortPlayerApplications(a, b, sortColumn, sortIsAscending)
              )
              .filter(
                (playerApplication) =>
                  ('' + playerApplication.name)
                    .toLowerCase()
                    .includes(filterTerm.toLowerCase()) ||
                    playerApplication.id
                      .toLowerCase()
                      .includes(filterTerm.toLowerCase())
              )
            : []
      )
    );
  }

  loadByMsel(mselId: string) {
    this.playerApplicationStore.setLoading(true);
    this.playerApplicationService
      .getByMsel(mselId)
      .pipe(
        tap(() => {
          this.playerApplicationStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (playerApplications) => {
          this.playerApplicationStore.set(playerApplications);
        },
        (error) => {
          this.playerApplicationStore.set([]);
        }
      );
  }

  loadById(id: string) {
    this.playerApplicationStore.setLoading(true);
    return this.playerApplicationService
      .getPlayerApplication(id)
      .pipe(
        tap(() => {
          this.playerApplicationStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.playerApplicationStore.upsert(s.id, { ...s });
      });
  }

  unload() {
    this.playerApplicationStore.set([]);
  }

  add(playerApplication: PlayerApplication) {
    this.playerApplicationStore.setLoading(true);
    this.playerApplicationService
      .createPlayerApplication(playerApplication)
      .pipe(
        tap(() => {
          this.playerApplicationStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.playerApplicationStore.add(s);
      });
  }

  updatePlayerApplication(playerApplication: PlayerApplication) {
    this.playerApplicationStore.setLoading(true);
    this.playerApplicationService
      .updatePlayerApplication(playerApplication.id, playerApplication)
      .pipe(
        tap(() => {
          this.playerApplicationStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((n) => {
        this.updateStore(n);
      });
  }

  delete(id: string) {
    this.playerApplicationService
      .deletePlayerApplication(id)
      .pipe(take(1))
      .subscribe((r) => {
        this.deleteFromStore(id);
      });
  }

  setPageEvent(pageEvent: PageEvent) {
    this.playerApplicationStore.update({ pageEvent: pageEvent });
  }

  updateStore(playerApplication: PlayerApplication) {
    this.playerApplicationStore.upsert(playerApplication.id, playerApplication);
  }

  deleteFromStore(id: string) {
    this.playerApplicationStore.remove(id);
  }

  private sortPlayerApplications(
    a: PlayerApplication,
    b: PlayerApplication,
    column: string,
    isAsc: boolean
  ) {
    switch (column) {
      case 'name':
        return (
          (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1) *
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
}
