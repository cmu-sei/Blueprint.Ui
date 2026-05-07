// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { TeamCompetencyStore } from './team-competency.store';
import { TeamCompetencyQuery } from './team-competency.query';
import { Injectable } from '@angular/core';
import {
  TeamCompetency,
  TeamCompetencyService,
} from 'src/app/generated/blueprint.api';
import { take, tap } from 'rxjs/operators';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class TeamCompetencyDataService {
  readonly TeamCompetencyList: Observable<TeamCompetency[]>;

  constructor(
    private teamCompetencyStore: TeamCompetencyStore,
    private teamCompetencyQuery: TeamCompetencyQuery,
    private teamCompetencyService: TeamCompetencyService
  ) {
    this.TeamCompetencyList = this.teamCompetencyQuery.selectAll();
  }

  loadByMsel(mselId: string) {
    this.teamCompetencyStore.setLoading(true);
    this.teamCompetencyService
      .getMselTeamCompetencies(mselId)
      .pipe(
        tap(() => {
          this.teamCompetencyStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (teamCompetencies) => {
          this.teamCompetencyStore.set(teamCompetencies);
        },
        (error) => {
          this.teamCompetencyStore.set([]);
        }
      );
  }

  loadByTeam(teamId: string) {
    this.teamCompetencyStore.setLoading(true);
    this.teamCompetencyService
      .getTeamCompetencies(teamId)
      .pipe(
        tap(() => {
          this.teamCompetencyStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (teamCompetencies) => {
          this.teamCompetencyStore.set(teamCompetencies);
        },
        (error) => {
          this.teamCompetencyStore.set([]);
        }
      );
  }

  unload() {
    this.teamCompetencyStore.set([]);
  }

  add(teamCompetency: TeamCompetency) {
    this.teamCompetencyStore.setLoading(true);
    this.teamCompetencyService
      .createTeamCompetency(teamCompetency)
      .pipe(
        tap(() => {
          this.teamCompetencyStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.teamCompetencyStore.add(s);
      });
  }

  delete(id: string) {
    this.teamCompetencyService
      .deleteTeamCompetency(id)
      .pipe(take(1))
      .subscribe((r) => {
        this.teamCompetencyStore.remove(id);
      });
  }
}
