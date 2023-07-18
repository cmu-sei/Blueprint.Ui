// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, Input, OnDestroy, ViewChild } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TeamQuery } from 'src/app/data/team/team.query';
import { UserDataService } from 'src/app/data/user/user-data.service';
import {
  DataField,
  MselRole,
  MselTeam,
  ScenarioEvent,
  Team,
  User,
  UserMselRole
} from 'src/app/generated/blueprint.api';
import { MselDataService, MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { MselTeamDataService } from 'src/app/data/msel-team/msel-team-data.service';
import { MselTeamQuery } from 'src/app/data/msel-team/msel-team.query';
import { MatLegacyMenuTrigger as MatMenuTrigger } from '@angular/material/legacy-menu';
import { CiteApiClientTeamType } from 'src/app/generated/blueprint.api/model/citeApiClientTeamType';
import { CiteService } from 'src/app/generated/blueprint.api';
import { UserMselRoleDataService } from 'src/app/data/user-msel-role/user-msel-role-data.service';
import { UserMselRoleQuery } from 'src/app/data/user-msel-role/user-msel-role.query';

@Component({
  selector: 'app-msel-roles',
  templateUrl: './msel-roles.component.html',
  styleUrls: ['./msel-roles.component.scss'],
})
export class MselRolesComponent implements OnDestroy {
  @Input() loggedInUserId: string;
  @Input() isContentDeveloper: boolean;
  @Input() teamTypeList: CiteApiClientTeamType[];
  // context menu
  @ViewChild(MatMenuTrigger, { static: true }) contextMenu: MatMenuTrigger;
  contextMenuPosition = { x: '0px', y: '0px' };
  msel = new MselPlus();
  originalMsel = new MselPlus();
  expandedSectionIds: string[] = [];
  sortedScenarioEvents: ScenarioEvent[];
  sortedDataFields: DataField[];
  mselRoles: MselRole[] = [MselRole.Editor, MselRole.Approver, MselRole.MoveEditor, MselRole.Owner, MselRole.Viewer];
  isEditEnabled = false;
  userList: User[] = [];
  mselTeamList: MselTeam[] = [];
  userMselRoles: UserMselRole[] = [];
  private allTeams: Team[] = [];
  private unsubscribe$ = new Subject();

  constructor(
    private teamQuery: TeamQuery,
    private userDataService: UserDataService,
    private mselDataService: MselDataService,
    private mselQuery: MselQuery,
    private mselTeamDataService: MselTeamDataService,
    private mselTeamQuery: MselTeamQuery,
    private citeService: CiteService,
    private userMselRoleDataService: UserMselRoleDataService,
    private userMselRoleQuery: UserMselRoleQuery
  ) {
    // subscribe to the active MSEL
    (this.mselQuery.selectActive() as Observable<MselPlus>).pipe(takeUntil(this.unsubscribe$)).subscribe(msel => {
      if (msel && this.msel.id !== msel.id) {
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
      if (teams && teams.length > 0) {
        this.allTeams = teams.sort((a, b) => a.shortName?.toLowerCase() > b.shortName?.toLowerCase() ? 1 : -1);
      }
    });
    // subscribe to mselTeams
    this.mselTeamQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(mselTeams => {
      this.mselTeamList = [];
      mselTeams.forEach(mt => {
        const mselTeam = {} as MselTeam;
        if (mt) {
          this.mselTeamList.push(Object.assign(mselTeam, mt));
        }
      });
      if (this.mselTeamList.length > 0) {
        this.mselTeamList = this.mselTeamList.sort((a, b) =>
          this.getTeam(a.teamId).shortName?.toLowerCase() > this.getTeam(b.teamId).shortName?.toLowerCase() ? 1 : -1);
      }
    });
    // subscribe to UserMselRoles
    this.userMselRoleQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(umrs => {
      this.userMselRoles = umrs;
    });
    // subscribe to TeamTypes
    this.citeService.getTeamTypes().subscribe(teamTypes => {
      this.teamTypeList = teamTypes;
    });
  }

  getUserName(userId: string) {
    const user = this.userList.find(u => u.id === userId);
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
    if (this.msel && this.mselTeamList && this.mselTeamList.length > 0 && teamList.length > 0) {
      const mselTeamIds = new Set(this.mselTeamList.map(mt => mt.teamId));
      teamList = this.allTeams.filter(t => !mselTeamIds.has(t.id));
    }

    return teamList;
  }

  getTeam(id: string) {
    const team = this.allTeams.find(t => t.id === id);
    return team ? team : {};
  }

  getMselTeamUsers(id: string) {
    const team = this.mselTeamList.find(mt => mt.teamId === id).team;
    return team ? team.users : [];
  }

  addTeamToMsel(teamId: string) {
    const mselTeam: MselTeam = {
      mselId: this.msel.id,
      teamId: teamId
    };
    this.mselTeamDataService.add(mselTeam);
  }

  removeTeamFromMsel(id: string) {
    this.mselTeamDataService.delete(id);
  }

  hasMselRole(userId: string, mselRole: MselRole): boolean {
    const hasRole = this.userMselRoles.some(umr =>
      umr.userId === userId && umr.role === mselRole && umr.mselId === this.msel.id);
    return hasRole;
  }

  toggleMselRole(userId: string, mselRole: MselRole, addIt: boolean) {
    if (addIt) {
      const umr = {
        userId: userId,
        mselId: this.msel.id,
        role: mselRole
      } as UserMselRole;
      this.userMselRoleDataService.add(umr);
    } else {
      const umrId = this.userMselRoles.find(umr =>
        umr.userId === userId &&
        umr.mselId === this.msel.id &&
        umr.role === mselRole
      ).id;
      this.userMselRoleDataService.delete(umrId);
    }
  }

  setTeamType(mselTeam: MselTeam, value: string) {
    mselTeam.citeTeamTypeId = value;
    this.mselTeamDataService.updateMselTeam(mselTeam);
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
