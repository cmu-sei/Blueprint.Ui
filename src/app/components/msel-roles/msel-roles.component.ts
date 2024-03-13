// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, Input, OnDestroy, ViewChild } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TeamDataService } from 'src/app/data/team/team-data.service';
import { TeamQuery } from 'src/app/data/team/team.query';
import { UserDataService } from 'src/app/data/user/user-data.service';
import {
  DataField,
  TeamRole,
  ScenarioEvent,
  Team,
  User,
  UserTeamRole
} from 'src/app/generated/blueprint.api';
import { MselDataService, MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { MatLegacyMenuTrigger as MatMenuTrigger } from '@angular/material/legacy-menu';
import { CiteApiClientTeamType } from 'src/app/generated/blueprint.api/model/citeApiClientTeamType';
import { CiteService } from 'src/app/generated/blueprint.api';
import { UserTeamRoleDataService } from 'src/app/data/user-team-role/user-team-role-data.service';
import { UserTeamRoleQuery } from 'src/app/data/user-team-role/user-team-role.query';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { TeamEditDialogComponent } from '../team-edit-dialog/team-edit-dialog.component';

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
  teamRoles: TeamRole[] = [
    TeamRole.Participant,
    TeamRole.Inviter,
    TeamRole.GalleryObserver,
    TeamRole.CiteObserver,
  ];
  isEditEnabled = false;
  userList: User[] = [];
  teamList: Team[] = [];
  userTeamRoles: UserTeamRole[] = [];
  filterString = '';
  private allTeams: Team[] = [];
  private unsubscribe$ = new Subject();

  constructor(
    private teamQuery: TeamQuery,
    private teamDataService: TeamDataService,
    private userDataService: UserDataService,
    private mselDataService: MselDataService,
    private mselQuery: MselQuery,
    private citeService: CiteService,
    private userTeamRoleDataService: UserTeamRoleDataService,
    private userTeamRoleQuery: UserTeamRoleQuery,
    private dialog: MatDialog,
    public dialogService: DialogService,
  ) {
    // subscribe to the active MSEL
    (this.mselQuery.selectActive() as Observable<MselPlus>).pipe(takeUntil(this.unsubscribe$)).subscribe(msel => {
      if (msel && this.msel.id !== msel.id) {
        Object.assign(this.originalMsel, msel);
        Object.assign(this.msel, msel);
        this.teamList = this.allTeams.filter(t => t.mselId === this.msel.id);
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
        this.teamList = this.allTeams.filter(t => t.mselId === this.msel.id);
      }
    });
    // subscribe to UserTeamRoles
    this.userTeamRoleQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(umrs => {
      this.userTeamRoles = umrs;
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

  getTeamList() {
    let teamList = this.allTeams;
    if (this.msel && this.teamList && this.teamList.length > 0 && teamList.length > 0) {
      const teamIds = new Set(this.teamList.map(mt => mt.id));
      teamList = this.allTeams.filter(t => !teamIds.has(t.id));
    }

    return teamList;
  }

  hasTeamRole(userId: string, teamId: string, teamRole: TeamRole): boolean {
    const hasRole = this.userTeamRoles.some(utr =>
      utr.userId === userId && utr.role === teamRole && utr.teamId === teamId);
    return hasRole;
  }

  toggleTeamRole(userId: string, teamId: string, teamRole: TeamRole, addIt: boolean) {
    if (addIt) {
      const umr = {
        userId: userId,
        teamId: teamId,
        role: teamRole
      } as UserTeamRole;
      this.userTeamRoleDataService.add(umr);
    } else {
      const umrId = this.userTeamRoles.find(umr =>
        umr.userId === userId &&
        umr.teamId === teamId &&
        umr.role === teamRole
      ).id;
      this.userTeamRoleDataService.delete(umrId);
    }
  }

  setTeamType(team: Team, value: string) {
    team.citeTeamTypeId = value;
    this.saveTeam(team);
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

  getTeamRolesToDisplay(): TeamRole[] {
    const teamRoles = [];
    this.teamRoles.forEach(mr => {
      if (mr.startsWith('Cite')) {
        if (this.msel.useCite) {
          teamRoles.push(mr);
        }
      } else if (mr.startsWith('Gallery')) {
        if (this.msel.useGallery) {
          teamRoles.push(mr);
        }
      } else {
        teamRoles.push(mr);
      }
    });
    return teamRoles;
  }

  addOrEditTeam(team: Team) {
    if (!team) {
      team = {
        name: '',
        shortName: ''
      };
    } else {
      team = {... team};
    }
    const dialogRef = this.dialog.open(TeamEditDialogComponent, {
      width: '800px',
      data: {
        team: team,
        userList: this.userList
      },
    });
    dialogRef.componentInstance.editComplete.subscribe((result) => {
      if (result.saveChanges && result.team) {
        this.saveTeam(result.team);
      }
      dialogRef.close();
    });
  }

  saveTeam(team: Team) {
    if (team.id) {
      this.teamDataService.updateTeam(team);
    } else {
      this.teamDataService.add(team);
    }
  }

  deleteTeam(team: Team): void {
    this.dialogService
      .confirm(
        'Delete Team',
        'Are you sure that you want to delete ' + team.name + '?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.teamDataService.delete(team.id);
        }
      });
  }

  applyFilter(filterValue: string) {
    this.filterString = filterValue;
    filterValue = filterValue.toLowerCase(); // MatTableDataSource defaults to lowercase matches
    this.teamList = this.allTeams
      .filter(team =>
        team.mselId === this.msel.id &&
        (team.name.toLowerCase().indexOf(filterValue) >= 0 ||
        team.shortName.toLowerCase().indexOf(filterValue) >= 0));
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
