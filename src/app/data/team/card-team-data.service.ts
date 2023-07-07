// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Injectable, OnDestroy } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ComnAuthQuery, ComnAuthService } from '@cmusei/crucible-common';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { take } from 'rxjs/operators';
import { CardTeamService } from 'src/app/generated/blueprint.api/api/api';
import { CardTeam, Team } from 'src/app/generated/blueprint.api/model/models';

@Injectable({
  providedIn: 'root',
})
export class CardTeamDataService implements OnDestroy {
  unsubscribe$: Subject<null> = new Subject<null>();
  readonly filterControl = new UntypedFormControl();
  private _cardTeams: CardTeam[] = [];
  readonly cardTeams = new BehaviorSubject<CardTeam[]>(this._cardTeams);
  private filterTerm: Observable<string>;
  private sortColumn: Observable<string>;
  private sortIsAscending: Observable<boolean>;
  private pageSize: Observable<number>;
  private pageIndex: Observable<number>;

  constructor(
    private cardTeamService: CardTeamService,
    private authQuery: ComnAuthQuery,
    private authService: ComnAuthService,
    private router: Router,
    activatedRoute: ActivatedRoute
  ) {}

  getCardTeamsFromApi(mselId: string) {
    return this.cardTeamService
      .getMselCardTeams(mselId)
      .pipe(take(1))
      .subscribe(
        (teams) => {
          this.updateCardTeams(teams);
        },
        (error) => {
          this.updateCardTeams([]);
        }
      );
  }

  addTeamToCard(cardId: string, team: Team) {
    this.cardTeamService.createCardTeam({
      cardId: cardId,
      teamId: team.id,
      isShownOnWall: true,
      canPostArticles: false
    }).subscribe(
      (et) => {
        this._cardTeams.unshift(et);
        this.updateCardTeams(this._cardTeams);
      },
      (error) => {
        this.updateCardTeams(this._cardTeams);
      }
    );
  }

  removeCardTeam(id: string) {
    this.cardTeamService.deleteCardTeam(id).subscribe(
      (response) => {
        this._cardTeams = this._cardTeams.filter((u) => u.id !== id);
        this.updateCardTeams(this._cardTeams);
      },
      (error) => {
        this.updateCardTeams(this._cardTeams);
      }
    );
  }

  updateCardTeam(cardTeam: CardTeam) {
    this.cardTeamService.updateCardTeam(cardTeam.id, cardTeam).subscribe(
      (et) => {
        this.updateStore(et);
      },
      (error) => {
        this.updateCardTeams(this._cardTeams);
      }
    );
  }

  updateStore(cardTeam: CardTeam) {
    const updatedCardTeams = this._cardTeams.filter(tu => tu.id !== cardTeam.id);
    updatedCardTeams.unshift(cardTeam);
    this.updateCardTeams(updatedCardTeams);
  }

  deleteFromStore(id: string) {
    const updatedCardTeams = this._cardTeams.filter(tu => tu.id !== id);
    this.updateCardTeams(updatedCardTeams);
  }

  setAsDates(cardTeam: CardTeam) {
    // set to a date object.
    cardTeam.dateCreated = new Date(cardTeam.dateCreated);
    cardTeam.dateModified = new Date(cardTeam.dateModified);
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }

  private updateCardTeams(cardTeams: CardTeam[]) {
    this._cardTeams = Object.assign([], cardTeams);
    this.cardTeams.next(this._cardTeams);
  }
}
