// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license, please see LICENSE.md in the
// project root for license information or contact permission@sei.cmu.edu for full terms.

import { TeamUserStore } from './team-user.store';
import { TeamUserQuery } from './team-user.query';
import { Injectable } from '@angular/core';
import {
  TeamUser,
  TeamUserService,
} from 'src/app/generated/blueprint.api';
import { take, tap } from 'rxjs/operators';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class TeamUserDataService {
  readonly TeamUserList: Observable<TeamUser[]>;

  constructor(
    private teamUserStore: TeamUserStore,
    private teamUserQuery: TeamUserQuery,
    private teamUserService: TeamUserService
  ) {}

  loadByMsel(mselId: string) {
    this.teamUserStore.setLoading(true);
    this.teamUserService
      .getMselTeamUsers(mselId)
      .pipe(
        tap(() => {
          this.teamUserStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (teamUsers) => {
          teamUsers.forEach(e => {
            this.setAsDates(e);
          });
          this.teamUserStore.set(teamUsers);
        },
        (error) => {
          this.teamUserStore.set([]);
        }
      );
  }

  loadByTeam(teamId: string) {
    this.teamUserStore.setLoading(true);
    this.teamUserService
      .getTeamTeamUsers(teamId)
      .pipe(
        tap(() => {
          this.teamUserStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (teamUsers) => {
          teamUsers.forEach(e => {
            this.setAsDates(e);
          });
          this.teamUserStore.set(teamUsers);
        },
        (error) => {
          this.teamUserStore.set([]);
        }
      );
  }

  loadById(id: string) {
    this.teamUserStore.setLoading(true);
    return this.teamUserService
      .getTeamUser(id)
      .pipe(
        tap(() => {
          this.teamUserStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.teamUserStore.upsert(s.id, { ...s });
      });
  }

  unload() {
    this.teamUserStore.setActive('');
    this.teamUserStore.set([]);
  }

  add(teamUser: TeamUser) {
    this.teamUserStore.setLoading(true);
    this.teamUserService
      .createTeamUser(teamUser)
      .pipe(
        tap(() => {
          this.teamUserStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.setAsDates(s);
        this.teamUserStore.add(s);
      });
  }

  delete(id: string) {
    this.teamUserService
      .deleteTeamUser(id)
      .pipe(take(1))
      .subscribe((r) => {
        if (this.teamUserQuery.getActiveId.toString() === id) {
          this.teamUserStore.setActive('');
        }
        this.deleteFromStore(id);
      });
  }

  updateStore(teamUser: TeamUser) {
    this.setAsDates(teamUser);
    this.teamUserStore.upsert(teamUser.id, teamUser);
  }

  deleteFromStore(id: string) {
    this.teamUserStore.remove(id);
  }

  setAsDates(teamUser: TeamUser) {
    // set to a date object.
    teamUser.dateCreated = new Date(teamUser.dateCreated);
    teamUser.dateModified = new Date(teamUser.dateModified);
  }

}
