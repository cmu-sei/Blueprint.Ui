// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { MselTeamStore } from './msel-team.store';
import { MselTeamQuery } from './msel-team.query';
import { Injectable } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { LegacyPageEvent as PageEvent } from '@angular/material/legacy-paginator';
import { Router, ActivatedRoute } from '@angular/router';
import {
  MselTeam,
  MselTeamService,
} from 'src/app/generated/blueprint.api';
import { map, take, tap } from 'rxjs/operators';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class MselTeamDataService {
  private _requestedMselTeamId: string;
  private _requestedMselTeamId$ = this.activatedRoute.queryParamMap.pipe(
    map((params) => params.get('mselTeamId') || '')
  );
  readonly MselTeamList: Observable<MselTeam[]>;
  readonly filterControl = new UntypedFormControl();
  private filterTerm: Observable<string>;
  private sortColumn: Observable<string>;
  private sortIsAscending: Observable<boolean>;
  private _pageEvent: PageEvent = { length: 0, pageIndex: 0, pageSize: 10 };
  readonly pageEvent = new BehaviorSubject<PageEvent>(this._pageEvent);
  private pageSize: Observable<number>;
  private pageIndex: Observable<number>;

  constructor(
    private mselTeamStore: MselTeamStore,
    private mselTeamQuery: MselTeamQuery,
    private mselTeamService: MselTeamService,
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {
    this.filterTerm = activatedRoute.queryParamMap.pipe(
      map((params) => params.get('mselTeammask') || '')
    );
    this.filterControl.valueChanges.subscribe((term) => {
      this.router.navigate([], {
        queryParams: { mselTeammask: term },
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
    this.MselTeamList = combineLatest([
      this.mselTeamQuery.selectAll(),
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
            ? (items as MselTeam[])
              .sort((a: MselTeam, b: MselTeam) =>
                this.sortMselTeams(a, b, sortColumn, sortIsAscending)
              )
              .filter(
                (mselTeam) =>
                  mselTeam.id
                    .toLowerCase()
                    .includes(filterTerm.toLowerCase())                )
            : []
      )
    );
  }

  private sortMselTeams(
    a: MselTeam,
    b: MselTeam,
    column: string,
    isAsc: boolean
  ) {
    switch (column) {
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
    this.mselTeamStore.setLoading(true);
    this.mselTeamService
      .getMselTeams(mselId)
      .pipe(
        tap(() => {
          this.mselTeamStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (mselTeams) => {
          mselTeams.forEach(a => {
            this.setAsDates(a);
          });
          this.mselTeamStore.set(mselTeams);
        },
        (error) => {
          this.mselTeamStore.set([]);
        }
      );
  }

  loadById(id: string) {
    this.mselTeamStore.setLoading(true);
    return this.mselTeamService
      .getMselTeam(id)
      .pipe(
        tap(() => {
          this.mselTeamStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.setAsDates(s);
        this.mselTeamStore.upsert(s.id, { ...s });
      });
  }

  unload() {
    this.mselTeamStore.set([]);
  }

  add(mselTeam: MselTeam) {
    this.mselTeamStore.setLoading(true);
    this.mselTeamService
      .createMselTeam(mselTeam)
      .pipe(
        tap(() => {
          this.mselTeamStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.setAsDates(s);
        this.mselTeamStore.add(s);
      });
  }

  updateMselTeam(mselTeam: MselTeam) {
    this.mselTeamStore.setLoading(true);
    this.mselTeamService
      .updateMselTeam(mselTeam.id, mselTeam)
      .pipe(
        tap(() => {
          this.mselTeamStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((n) => {
        this.setAsDates(n);
        this.updateStore(n);
      });
  }

  delete(id: string) {
    this.mselTeamService
      .deleteMselTeam(id)
      .pipe(take(1))
      .subscribe((r) => {
        this.deleteFromStore(id);
      });
  }

  setActive(id: string) {
    this.mselTeamStore.setActive(id);
  }

  setPageEvent(pageEvent: PageEvent) {
    this.mselTeamStore.update({ pageEvent: pageEvent });
  }

  updateStore(mselTeam: MselTeam) {
    this.mselTeamStore.upsert(mselTeam.id, mselTeam);
  }

  deleteFromStore(id: string) {
    this.mselTeamStore.remove(id);
  }

  setAsDates(mselTeam: MselTeam) {
    // set to a date object.
    mselTeam.dateCreated = new Date(mselTeam.dateCreated);
    mselTeam.dateModified = new Date(mselTeam.dateModified);
  }

}
