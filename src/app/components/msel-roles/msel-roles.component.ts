// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license, please see LICENSE.md in the project root for license information or contact permission@sei.cmu.edu for full terms.
import { Component, Input, OnDestroy, ViewChild } from '@angular/core';
import { MatSidenav } from '@angular/material/sidenav';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Observable, BehaviorSubject } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';
import {
  ComnSettingsService,
  Theme,
  ComnAuthQuery,
} from '@cmusei/crucible-common';
import { TeamQuery } from 'src/app/data/team/team.query';
import { UserDataService } from 'src/app/data/user/user-data.service';
import { TopbarView } from './../shared/top-bar/topbar.models';
import {
  ItemStatus,
  DataField,
  MselRole,
  ScenarioEvent,
  Team,
  User,
  UserMselRoleService
} from 'src/app/generated/blueprint.api';
import { MselDataService, MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { MoveDataService } from 'src/app/data/move/move-data.service';
import { Sort } from '@angular/material/sort';
import { MatMenuTrigger } from '@angular/material/menu';
import { utimes } from 'fs';

@Component({
  selector: 'app-msel-roles',
  templateUrl: './msel-roles.component.html',
  styleUrls: ['./msel-roles.component.scss'],
})
export class MselRolesComponent implements OnDestroy {
  @Input() loggedInUserId: string;
  @Input() isContentDeveloper: boolean;
  msel = new MselPlus();
  originalMsel = new MselPlus();
  expandedSectionIds: string[] = [];
  sortedScenarioEvents: ScenarioEvent[];
  sortedDataFields: DataField[];
  private unsubscribe$ = new Subject();
  // context menu
  @ViewChild(MatMenuTrigger, { static: true }) contextMenu: MatMenuTrigger;
  contextMenuPosition = { x: '0px', y: '0px' };
  isEditEnabled = false;
  userList: User[] = [];
  private allTeams: Team[] = [];
  mselRoles: MselRole[] = [MselRole.Editor, MselRole.Approver, MselRole.Owner];

  constructor(
    activatedRoute: ActivatedRoute,
    private router: Router,
    private teamQuery: TeamQuery,
    private userDataService: UserDataService,
    private settingsService: ComnSettingsService,
    private authQuery: ComnAuthQuery,
    private moveDataService: MoveDataService,
    private mselDataService: MselDataService,
    private mselQuery: MselQuery
  ) {
    // subscribe to the active MSEL
    (this.mselQuery.selectActive() as Observable<MselPlus>).pipe(takeUntil(this.unsubscribe$)).subscribe(msel => {
      if (msel) {
        Object.assign(this.originalMsel, msel);
        Object.assign(this.msel, msel);
        this.sortedDataFields = this.getSortedDataFields(msel.dataFields);
      }
    });
    // subscribe to users
    this.userDataService.users.pipe(takeUntil(this.unsubscribe$)).subscribe(users => {
      this.userList = users;
    });
    // subscribe to teams
    this.teamQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(teams => {
      this.allTeams = teams;
    });
  }

  getUserName(userId: string) {
    var user = this.userList.find(u => u.id === userId);
    return user ? user.name : 'unknown';
  }

  getSortedDataFields(dataFields: DataField[]): DataField[] {
    const sortedDataFields: DataField[] = [];
    if (dataFields) {
      dataFields.forEach(df => {
        sortedDataFields.push({... df});
      });
      sortedDataFields.sort((a, b) => +a.displayOrder > +b.displayOrder ? 1 : -1);
    }
    return sortedDataFields;
  }

  getTeamList() {
    let teamList = this.allTeams;
    if (this.msel && this.msel.teams && this.msel.teams.length > 0 && teamList.length > 0) {
      const mselTeamIds = new Set(this.msel.teams
        .map(({ id }) => id));
      teamList = this.allTeams
        .filter(({ id }) => !mselTeamIds.has(id));
    }

    return teamList;
  }

  addTeamToMsel(teamId: string) {
    this.mselDataService.addTeamToMsel(this.msel.id, teamId);
  }

  removeTeamFromMsel(teamId: string) {
    this.mselDataService.removeTeamFromMsel(this.msel.id, teamId);
  }

  hasMselRole(userId: string, mselRole: MselRole): boolean {
    const hasRole = this.msel.userMselRoles.some(umr =>
      umr.userId === userId && umr.role === mselRole);
    return hasRole;
  }

  toggleMselRole(userId: string, mselRole: MselRole, addIt: boolean) {
    if (addIt) {
      this.mselDataService.addUserMselRole(userId, this.msel.id, mselRole)
    } else {
      this.mselDataService.removeUserMselRole(userId, this.msel.id, mselRole)
    }
  }

  saveChanges() {
    this.mselDataService.updateMsel(this.msel);
    this.isEditEnabled = false;
  }

  cancelChanges() {
    this.isEditEnabled = false;
    Object.assign(this.msel, this.originalMsel);
  }

  trackByFn(index, item) {
    return item.id;
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
