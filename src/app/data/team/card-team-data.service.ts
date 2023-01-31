// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Injectable, OnDestroy } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ComnAuthQuery, ComnAuthService } from '@cmusei/crucible-common';
import { BehaviorSubject, combineLatest, Observable, Subject } from 'rxjs';
import { filter, map, take, takeUntil } from 'rxjs/operators';
import { CardTeamService } from 'src/app/generated/blueprint.api/api/api';
import { CardTeam, Team } from 'src/app/generated/blueprint.api/model/models';

@Injectable({
  providedIn: 'root',
})
export class CardTeamDataService implements OnDestroy {
  private _cardTeams: CardTeam[] = [];
  readonly cardTeams = new BehaviorSubject<CardTeam[]>(this._cardTeams);
  readonly filterControl = new UntypedFormControl();
  private filterTerm: Observable<string>;
  private sortColumn: Observable<string>;
  private sortIsAscending: Observable<boolean>;
  private pageSize: Observable<number>;
  private pageIndex: Observable<number>;
  unsubscribe$: Subject<null> = new Subject<null>();

  constructor(
    private cardTeamService: CardTeamService,
    private authQuery: ComnAuthQuery,
    private authService: ComnAuthService,
    private router: Router,
    activatedRoute: ActivatedRoute
  ) {}

  private updateCardTeams(cardTeams: CardTeam[]) {
    this._cardTeams = Object.assign([], cardTeams);
    this.cardTeams.next(this._cardTeams);
  }

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
    this.cardTeamService.createCardTeam({cardId: cardId, teamId: team.id}).subscribe(
      (et) => {
        this._cardTeams.unshift(et);
        this.updateCardTeams(this._cardTeams);
      },
      (error) => {
        this.updateCardTeams(this._cardTeams);
      }
    );
  }

  removeCardTeam(cardId: string, teamId: string) {
    this.cardTeamService.deleteCardTeamByIds(cardId, teamId).subscribe(
      (response) => {
        this._cardTeams = this._cardTeams.filter((u) => u.teamId !== teamId);
        this.updateCardTeams(this._cardTeams);
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
}
