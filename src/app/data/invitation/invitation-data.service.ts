// Copyright 2023 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { InvitationStore } from './invitation.store';
import { InvitationQuery } from './invitation.query';
import { Injectable } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { LegacyPageEvent as PageEvent } from '@angular/material/legacy-paginator';
import { Router, ActivatedRoute } from '@angular/router';
import {
  Invitation,
  InvitationService,
} from 'src/app/generated/blueprint.api';
import { map, take, tap } from 'rxjs/operators';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class InvitationDataService {
  private _requestedInvitationId: string;
  private _requestedInvitationId$ = this.activatedRoute.queryParamMap.pipe(
    map((params) => params.get('invitationId') || '')
  );
  readonly InvitationList: Observable<Invitation[]>;
  readonly filterControl = new UntypedFormControl();
  private filterTerm: Observable<string>;
  private sortColumn: Observable<string>;
  private sortIsAscending: Observable<boolean>;
  private _pageEvent: PageEvent = { length: 0, pageIndex: 0, pageSize: 10 };
  readonly pageEvent = new BehaviorSubject<PageEvent>(this._pageEvent);
  private pageSize: Observable<number>;
  private pageIndex: Observable<number>;

  constructor(
    private invitationStore: InvitationStore,
    private invitationQuery: InvitationQuery,
    private invitationService: InvitationService,
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {
    this.filterTerm = activatedRoute.queryParamMap.pipe(
      map((params) => params.get('invitationmask') || '')
    );
    this.filterControl.valueChanges.subscribe((term) => {
      this.router.navigate([], {
        queryParams: { invitationmask: term },
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
    this.InvitationList = combineLatest([
      this.invitationQuery.selectAll(),
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
            ? (items as Invitation[])
              .sort((a: Invitation, b: Invitation) =>
                this.sortInvitations(a, b, sortColumn, sortIsAscending)
              )
              .filter(
                (invitation) =>
                  invitation.id
                    .toLowerCase()
                    .includes(filterTerm.toLowerCase())                )
            : []
      )
    );
  }

  private sortInvitations(
    a: Invitation,
    b: Invitation,
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
    this.invitationStore.setLoading(true);
    this.invitationService
      .getInvitations(mselId)
      .pipe(
        tap(() => {
          this.invitationStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (invitations) => {
          invitations.forEach(a => {
            this.setAsDates(a);
          });
          this.invitationStore.set(invitations);
        },
        (error) => {
          this.invitationStore.set([]);
        }
      );
  }

  loadById(id: string) {
    this.invitationStore.setLoading(true);
    return this.invitationService
      .getInvitation(id)
      .pipe(
        tap(() => {
          this.invitationStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.setAsDates(s);
        this.invitationStore.upsert(s.id, { ...s });
      });
  }

  unload() {
    this.invitationStore.set([]);
  }

  add(invitation: Invitation) {
    this.invitationStore.setLoading(true);
    this.invitationService
      .createInvitation(invitation)
      .pipe(
        tap(() => {
          this.invitationStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.setAsDates(s);
        this.invitationStore.add(s);
      });
  }

  update(invitation: Invitation) {
    this.invitationStore.setLoading(true);
    this.invitationService
      .updateInvitation(invitation.id, invitation)
      .pipe(
        tap(() => {
          this.invitationStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((n) => {
        this.setAsDates(n);
        this.updateStore(n);
      });
  }

  delete(id: string) {
    this.invitationService
      .deleteInvitation(id)
      .pipe(take(1))
      .subscribe((r) => {
        this.deleteFromStore(id);
      });
  }

  setActive(id: string) {
    this.invitationStore.setActive(id);
  }

  setPageEvent(pageEvent: PageEvent) {
    this.invitationStore.update({ pageEvent: pageEvent });
  }

  updateStore(invitation: Invitation) {
    this.invitationStore.upsert(invitation.id, invitation);
  }

  deleteFromStore(id: string) {
    this.invitationStore.remove(id);
  }

  setAsDates(invitation: Invitation) {
    // set to a date object.
    invitation.dateCreated = new Date(invitation.dateCreated);
    invitation.dateModified = new Date(invitation.dateModified);
  }

}
