// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Injectable, OnDestroy } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ComnAuthQuery, ComnAuthService } from '@cmusei/crucible-common';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { take } from 'rxjs/operators';
import { PlayerApplicationTeamService } from 'src/app/generated/blueprint.api/api/api';
import { PlayerApplicationTeam, Team } from 'src/app/generated/blueprint.api/model/models';

@Injectable({
  providedIn: 'root',
})
export class PlayerApplicationTeamDataService implements OnDestroy {
  unsubscribe$: Subject<null> = new Subject<null>();
  readonly filterControl = new UntypedFormControl();
  private _playerApplicationTeams: PlayerApplicationTeam[] = [];
  readonly playerApplicationTeams = new BehaviorSubject<
    PlayerApplicationTeam[]
  >(this._playerApplicationTeams);
  private filterTerm: Observable<string>;
  private sortColumn: Observable<string>;
  private sortIsAscending: Observable<boolean>;
  private pageSize: Observable<number>;
  private pageIndex: Observable<number>;

  constructor(
    private playerApplicationTeamService: PlayerApplicationTeamService,
    private authQuery: ComnAuthQuery,
    private authService: ComnAuthService,
    private router: Router,
    activatedRoute: ActivatedRoute
  ) {}

  getPlayerApplicationTeamsFromApi(mselId: string) {
    return this.playerApplicationTeamService
      .getMselPlayerApplicationTeams(mselId)
      .pipe(take(1))
      .subscribe(
        (teams) => {
          this.updatePlayerApplicationTeams(teams);
        },
        (error) => {
          this.updatePlayerApplicationTeams([]);
        }
      );
  }

  addTeamToPlayerApplication(
    playerApplicationId: string,
    team: Team,
    displayOrder: number
  ) {
    this.playerApplicationTeamService
      .createPlayerApplicationTeam({
        playerApplicationId: playerApplicationId,
        teamId: team.id,
        displayOrder: displayOrder,
      })
      .subscribe(
        (et) => {
          this.updateStore(et);
        },
        (error) => {
          this.updatePlayerApplicationTeams(this._playerApplicationTeams);
        }
      );
  }

  removePlayerApplicationTeam(id: string) {
    this.playerApplicationTeamService.deletePlayerApplicationTeam(id).subscribe(
      (response) => {
        this._playerApplicationTeams = this._playerApplicationTeams.filter(
          (u) => u.id !== id
        );
        this.updatePlayerApplicationTeams(this._playerApplicationTeams);
      },
      (error) => {
        this.updatePlayerApplicationTeams(this._playerApplicationTeams);
      }
    );
  }

  updatePlayerApplicationTeam(playerApplicationTeam: PlayerApplicationTeam) {
    this.playerApplicationTeamService
      .updatePlayerApplicationTeam(
        playerApplicationTeam.id,
        playerApplicationTeam
      )
      .subscribe(
        (et) => {
          this.updateStore(et);
        },
        (error) => {
          this.updatePlayerApplicationTeams(this._playerApplicationTeams);
        }
      );
  }

  updateStore(playerApplicationTeam: PlayerApplicationTeam) {
    const updatedPlayerApplicationTeams = this._playerApplicationTeams.filter(
      (tu) => tu.id !== playerApplicationTeam.id
    );
    updatedPlayerApplicationTeams.unshift(playerApplicationTeam);
    this.updatePlayerApplicationTeams(updatedPlayerApplicationTeams);
  }

  deleteFromStore(id: string) {
    const updatedPlayerApplicationTeams = this._playerApplicationTeams.filter(
      (tu) => tu.id !== id
    );
    this.updatePlayerApplicationTeams(updatedPlayerApplicationTeams);
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }

  private updatePlayerApplicationTeams(
    playerApplicationTeams: PlayerApplicationTeam[]
  ) {
    this._playerApplicationTeams = Object.assign([], playerApplicationTeams);
    this.playerApplicationTeams.next(this._playerApplicationTeams);
  }
}
