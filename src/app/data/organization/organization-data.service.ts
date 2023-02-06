/*
 Copyright 2023 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { OrganizationStore } from './organization.store';
import { OrganizationQuery } from './organization.query';
import { Injectable } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { LegacyPageEvent as PageEvent } from '@angular/material/legacy-paginator';
import { Router, ActivatedRoute } from '@angular/router';
import {
  Organization,
  OrganizationService,
} from 'src/app/generated/blueprint.api';
import { map, take, tap } from 'rxjs/operators';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class OrganizationDataService {
  readonly OrganizationList: Observable<Organization[]>;
  readonly filterControl = new UntypedFormControl();  private _requestedOrganizationId: string;
  private _requestedOrganizationId$ = this.activatedRoute.queryParamMap.pipe(
    map((params) => params.get('organizationId') || '')
  );

  private filterTerm: Observable<string>;
  private sortColumn: Observable<string>;
  private sortIsAscending: Observable<boolean>;
  private _pageEvent: PageEvent = { length: 0, pageIndex: 0, pageSize: 10 };
  readonly pageEvent = new BehaviorSubject<PageEvent>(this._pageEvent);
  private pageSize: Observable<number>;
  private pageIndex: Observable<number>;

  constructor(
    private organizationStore: OrganizationStore,
    private organizationQuery: OrganizationQuery,
    private organizationService: OrganizationService,
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {
    this.filterTerm = activatedRoute.queryParamMap.pipe(
      map((params) => params.get('organizationmask') || '')
    );
    this.filterControl.valueChanges.subscribe((term) => {
      this.router.navigate([], {
        queryParams: { organizationmask: term },
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
    this.OrganizationList = combineLatest([
      this.organizationQuery.selectAll(),
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
            ? (items as Organization[])
              .sort((a: Organization, b: Organization) =>
                this.sortOrganizations(a, b, sortColumn, sortIsAscending)
              )
              .filter(
                (organization) =>
                  ('' + organization.description)
                    .toLowerCase()
                    .includes(filterTerm.toLowerCase()) ||
                    organization.id
                      .toLowerCase()
                      .includes(filterTerm.toLowerCase())
              )
            : []
      )
    );
  }

  loadTemplates() {
    this.organizationStore.setLoading(true);
    this.organizationService
      .getOrganizationTemplates()
      .pipe(
        tap(() => {
          this.organizationStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (templates) => {
          this.organizationStore.upsertMany(templates);
        },
        (error) => {}
      );
  }

  loadByMsel(mselId: string) {
    this.organizationStore.setLoading(true);
    this.organizationService
      .getByMsel(mselId)
      .pipe(
        tap(() => {
          this.organizationStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (organizations) => {
          this.organizationStore.upsertMany(organizations);
        },
        (error) => {}
      );
  }

  loadById(id: string) {
    this.organizationStore.setLoading(true);
    return this.organizationService
      .getOrganization(id)
      .pipe(
        tap(() => {
          this.organizationStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.organizationStore.upsert(s.id, { ...s });
      });
  }

  unload() {
    this.organizationStore.set([]);
  }

  add(organization: Organization) {
    this.organizationStore.setLoading(true);
    this.organizationService
      .createOrganization(organization)
      .pipe(
        tap(() => {
          this.organizationStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.organizationStore.add(s);
      });
  }

  updateOrganization(organization: Organization) {
    this.organizationStore.setLoading(true);
    this.organizationService
      .updateOrganization(organization.id, organization)
      .pipe(
        tap(() => {
          this.organizationStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((n) => {
        this.updateStore(n);
      });
  }

  delete(id: string) {
    this.organizationService
      .deleteOrganization(id)
      .pipe(take(1))
      .subscribe((r) => {
        this.deleteFromStore(id);
      });
  }

  setPageEvent(pageEvent: PageEvent) {
    this.organizationStore.update({ pageEvent: pageEvent });
  }

  updateStore(organization: Organization) {
    this.organizationStore.upsert(organization.id, organization);
  }

  deleteFromStore(id: string) {
    this.organizationStore.remove(id);
  }

  private sortOrganizations(
    a: Organization,
    b: Organization,
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
}
