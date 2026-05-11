// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { CompetencyFrameworkStore } from './competency-framework.store';
import { CompetencyFrameworkQuery } from './competency-framework.query';
import { Injectable } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { PageEvent } from '@angular/material/paginator';
import { Router, ActivatedRoute } from '@angular/router';
import {
  CompetencyFramework,
  CompetencyFrameworkService,
} from 'src/app/generated/blueprint.api';
import { map, take, tap } from 'rxjs/operators';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class CompetencyFrameworkDataService {
  readonly CompetencyFrameworkList: Observable<CompetencyFramework[]>;
  readonly filterControl = new UntypedFormControl();
  private filterTerm: Observable<string>;
  private sortColumn: Observable<string>;
  private sortIsAscending: Observable<boolean>;
  private _pageEvent: PageEvent = { length: 0, pageIndex: 0, pageSize: 10 };
  readonly pageEvent = new BehaviorSubject<PageEvent>(this._pageEvent);
  private pageSize: Observable<number>;
  private pageIndex: Observable<number>;

  constructor(
    private competencyFrameworkStore: CompetencyFrameworkStore,
    private competencyFrameworkQuery: CompetencyFrameworkQuery,
    private competencyFrameworkService: CompetencyFrameworkService,
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {
    this.filterTerm = activatedRoute.queryParamMap.pipe(
      map((params) => params.get('competencyFrameworkmask') || '')
    );
    this.filterControl.valueChanges.subscribe((term) => {
      this.router.navigate([], {
        queryParams: { competencyFrameworkmask: term },
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
    this.CompetencyFrameworkList = combineLatest([
      this.competencyFrameworkQuery.selectAll(),
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
            ? (items as CompetencyFramework[])
              .filter(
                (cf) =>
                  cf.name?.toLowerCase().includes(filterTerm.toLowerCase()) ||
                  cf.source?.toLowerCase().includes(filterTerm.toLowerCase()) ||
                  cf.version?.toLowerCase().includes(filterTerm.toLowerCase()))
            : []
      )
    );
  }

  load() {
    this.competencyFrameworkStore.setLoading(true);
    this.competencyFrameworkService
      .getCompetencyFrameworks()
      .pipe(
        tap(() => {
          this.competencyFrameworkStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (templates) => {
          this.competencyFrameworkStore.upsertMany(templates);
        },
        (error) => { }
      );
  }

  loadById(id: string) {
    this.competencyFrameworkStore.setLoading(true);
    return this.competencyFrameworkService
      .getCompetencyFramework(id)
      .pipe(
        tap(() => {
          this.competencyFrameworkStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.competencyFrameworkStore.upsert(s.id, { ...s });
      });
  }

  unload() {
    this.competencyFrameworkStore.set([]);
  }

  add(competencyFramework: CompetencyFramework) {
    this.competencyFrameworkStore.setLoading(true);
    this.competencyFrameworkService
      .createCompetencyFramework(competencyFramework)
      .pipe(
        tap(() => {
          this.competencyFrameworkStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.competencyFrameworkStore.add(s);
      });
  }

  update(competencyFramework: CompetencyFramework) {
    this.competencyFrameworkStore.setLoading(true);
    this.competencyFrameworkService
      .updateCompetencyFramework(competencyFramework.id, competencyFramework)
      .pipe(
        tap(() => {
          this.competencyFrameworkStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((n) => {
        this.updateStore(n);
      });
  }

  delete(id: string) {
    this.competencyFrameworkService
      .deleteCompetencyFramework(id)
      .pipe(take(1))
      .subscribe((r) => {
        this.deleteFromStore(id);
      });
  }

  setActive(id: string) {
    this.competencyFrameworkStore.setActive(id);
  }

  setPageEvent(pageEvent: PageEvent) {
    this.competencyFrameworkStore.update({ pageEvent: pageEvent });
  }

  updateStore(competencyFramework: CompetencyFramework) {
    this.competencyFrameworkStore.upsert(competencyFramework.id, competencyFramework);
  }

  deleteFromStore(id: string) {
    this.competencyFrameworkStore.remove(id);
  }

}
