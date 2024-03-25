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
  Unit,
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
import { TeamAddDialogComponent } from '../team-add-dialog/team-add-dialog.component';
import { TeamEditDialogComponent } from '../team-edit-dialog/team-edit-dialog.component';
import { UnitQuery } from 'src/app/data/unit/unit.query';
import { UserAddDialogComponent } from '../user-add-dialog/user-add-dialog.component';

@Component({
  selector: 'app-msel-roles',
  templateUrl: './msel-teams.component.html',
  styleUrls: ['./msel-teams.component.scss'],
})
export class MselTeamsComponent implements OnDestroy {
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
    TeamRole.Inviter,
    TeamRole.GalleryObserver,
    TeamRole.CiteObserver,
  ];
  isEditEnabled = false;
  userList: User[] = [];
  teamList: Team[] = [];
  unitList: Unit[] = [];
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
    private unitQuery: UnitQuery,
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
    // subscribe to units
    this.unitQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(units => {
      if (units && units.length > 0) {
        this.unitList = units.sort((a, b) => a.shortName?.toLowerCase() > b.shortName?.toLowerCase() ? 1 : -1);
      }
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

  hasTeamRole(userId: string, team: Team, teamRole: TeamRole): boolean {
    // if all members can invite, don't have to check each user
    if (team.canTeamMemberInvite && teamRole === TeamRole.Inviter) {
      return true;
    } else {
      const hasRole = this.userTeamRoles.some(utr =>
        utr.userId === userId && utr.role === teamRole && utr.teamId === team.id);
      return hasRole;
    }
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

  getCiteTeamTypeName(id: string): string {
    const teamType = this.teamTypeList?.find(x => x.id === id);
    return teamType ? teamType.name : ' ';
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
        shortName: '',
        mselId: this.msel.id
      };
    } else {
      team = {... team};
    }
    const dialogRef = this.dialog.open(TeamEditDialogComponent, {
      width: '800px',
      data: {
        team: team,
        useCite: this.msel.useCite,
        teamTypeList: this.teamTypeList
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

  addTeamFromUnit() {
    const dialogRef = this.dialog.open(TeamAddDialogComponent, {
      width: '800px',
      height: '80%',
      data: {
        unitList: this.unitList
      },
    });
    dialogRef.componentInstance.editComplete.subscribe((result) => {
      if (result.saveChanges && result.unitId) {
        this.teamDataService.addFromUnit(this.msel.id, result.unitId);
      }
      dialogRef.close();
    });
  }

  addRemoveUsers(team: Team) {
    const dialogRef = this.dialog.open(UserAddDialogComponent, {
      width: '800px',
      height: '80vh',
      data: {
        team: team,
        availableUsers: this.getAvailableUsers(team.id)
      },
    });
    dialogRef.componentInstance.editComplete.subscribe((result) => {
      dialogRef.close();
      this.teamDataService.loadById(team.id);
    });
  }

  getAvailableUsers(teamId: string): any {
    const otherTeamUsers = [] as User[];
    this.teamList.forEach(t => {
      if (t.id !== teamId) {
        t.users.forEach(u => {
          otherTeamUsers.push(u);
        });
      }
    });
    const availableUsers = [];
    this.userList.forEach(u => {
      const availableUser = {...u} as any;
      availableUser.onATeam = otherTeamUsers.some(tu => tu.id === u.id);
      availableUsers.push(availableUser);
    });
    return availableUsers;
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
