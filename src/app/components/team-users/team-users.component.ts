// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license, please see LICENSE.md in the
// project root for license information or contact permission@sei.cmu.edu for full terms.

import {
  Component,
  OnDestroy,
  OnInit,
  Input,
  ViewChild,
} from '@angular/core';
import { Sort, MatSortable } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { TeamQuery } from 'src/app/data/team/team.query';
import { TeamRole, Team, TeamUser, User, UserTeamRole } from 'src/app/generated/blueprint.api';
import { TeamUserDataService } from 'src/app/data/team-user/team-user-data.service';
import { TeamUserQuery } from 'src/app/data/team-user/team-user.query';
import { UserDataService } from 'src/app/data/user/user-data.service';
import { UserTeamRoleDataService } from 'src/app/data/user-team-role/user-team-role-data.service';
import { UserTeamRoleQuery } from 'src/app/data/user-team-role/user-team-role.query';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { UntypedFormControl } from '@angular/forms';
@Component({
    selector: 'app-team-users',
    templateUrl: './team-users.component.html',
    styleUrls: ['./team-users.component.scss'],
    standalone: false
})
export class TeamUsersComponent implements OnDestroy, OnInit {
  @Input() team: Team;
  userList: User[] = [];
  teamUsers: TeamUser[] = [];
  otherTeamUsers: TeamUser[] = [];
  teamList: Team[] = [];
  userTeamRoles: UserTeamRole[] = [];
  minUserColumns: string[] = ['name', 'id'];
  allUserColumns: string[] = ['name', 'Inviter', 'Observer', 'Incrementer', 'Modifier', 'Submitter', 'id'];
  displayedTeamUserColumns: string[] = [];
  userDataSource = new MatTableDataSource<User>(new Array<User>());
  teamUserDataSource = new MatTableDataSource<TeamUser>(new Array<TeamUser>());
  filterControl = new UntypedFormControl();
  filterString = '';
  isAddMode = false;
  sort: Sort = { active: 'name', direction: 'asc' };
  teamRoles: string[] = ['Inviter', 'Observer', 'Incrementer', 'Modifier', 'Submitter'];
  private unsubscribe$ = new Subject();

  constructor(
    private teamQuery: TeamQuery,
    private teamUserDataService: TeamUserDataService,
    private teamUserQuery: TeamUserQuery,
    private userDataService: UserDataService,
    private userTeamRoleDataService: UserTeamRoleDataService,
    private userTeamRoleQuery: UserTeamRoleQuery
  ) {
    this.userDataService.userList.pipe(takeUntil(this.unsubscribe$)).subscribe(users => {
      this.userList = users;
      this.setDataSources();
    });
    this.teamUserQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(tUsers => {
      this.teamUsers = tUsers.filter(tu => tu.teamId === this.team?.id);
      this.otherTeamUsers = tUsers.filter(tu => tu.teamId !== this.team?.id);
      this.setDataSources();
    });
    // observe the evaluation teams
    this.teamQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(teams => {
      this.teamList = teams ? teams : [];
    });
    // subscribe to UserTeamRoles
    this.userTeamRoleQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(umrs => {
      this.userTeamRoles = umrs;
    });
    this.displayedTeamUserColumns = this.allUserColumns;
  }

  ngOnInit() {
    this.filterControl.valueChanges.pipe(takeUntil(this.unsubscribe$)).subscribe(() => {
      this.filterString = this.filterControl.value;
      this.applyFilter();
    });
    this.userDataService.userList.pipe(takeUntil(this.unsubscribe$)).subscribe(users => {
      this.userList = users;
      this.applyFilter();
    });
    this.filterControl.setValue('');
    this.teamUsers = this.teamUserQuery.getAll().filter(tu => tu.teamId === this.team?.id);
    this.otherTeamUsers = this.teamUserQuery.getAll().filter(tu => tu.teamId !== this.team?.id);
    this.setDataSources();
  }

  clearFilter() {
    this.filterControl.setValue('');
  }

  setDataSources() {
    // Now that all of the observables are returned, process accordingly.
    // get users from the TeamUsers
    // sort the list and add it as the data source
    this.teamUserDataSource.data = this.teamUsers.sort((a, b) => {
      const aName = this.getUserName(a.userId).toLowerCase();
      const bName = this.getUserName(b.userId).toLowerCase();
      if (aName < bName) {
        return -1;
      } else if (aName > bName) {
        return 1;
      } else {
        return 0;
      }
    });
    const newAllUsers = !this.userList ? new Array<User>() : this.userList.slice(0);
    this.teamUserDataSource.data.forEach((tu) => {
      const index = newAllUsers.findIndex((u) => u.id === tu.userId);
      if (index >= 0) {
        newAllUsers.splice(index, 1);
      }
    });
    this.userDataSource = new MatTableDataSource(newAllUsers);
  }

  applyFilter() {
    const searchTerm = this.filterControl.value ? this.filterControl.value.toLowerCase() : '';
    const filteredData = this.userList.filter(user =>
      !searchTerm || user.name.toLowerCase().includes(searchTerm)
    );
    this.sortUserData(filteredData);
  }

  sortUserData(data: User[]) {
    data.sort((a, b) => {
      const isAsc = this.sort.direction === 'asc';
      switch (this.sort.active) {
        case 'name':
          return this.compare(a.name, b.name, isAsc);
        case 'id':
          return this.compare(a.id, b.id, isAsc);
        default:
          return 0;
      }
    });
    this.userDataSource.data = data;
  }

  sortTeamUserData(teamUserData: TeamUser[]) {
    teamUserData.sort((a, b) => {
      const aName = this.getUserName(a.userId).toLowerCase(); // Assumption: getUserName resolves the user's name by ID
      const bName = this.getUserName(b.userId).toLowerCase();
      const isAsc = this.sort.direction === 'asc';
      switch (this.sort.active) {
        case 'name':
          return this.compare(aName, bName, isAsc);
        default:
          return 0;
      }
    });
    this.teamUserDataSource.data = teamUserData;
  }

  compare(a: string, b: string, isAsc: boolean) {
    return (a < b ? -1 : 1) * (isAsc ? 1 : -1);
  }

  onSortChange(sort: Sort) {
    this.sort = sort;
    this.applyFilter();
  }

  onSortTeamChange(sort: Sort) {
    this.sort = sort;
    this.sortTeamUserData(this.teamUsers);
  }

  getUserName(id: string) {
    const user = this.userList.find(u => u.id === id);
    return user ? user.name : '?';
  }

  addUserToTeam(user: User): void {
    const teamUser = {
      teamId: this.team?.id,
      userId: user.id
    } as TeamUser;
    this.teamUserDataService.add(teamUser);
  }

  /**
   * Removes a user from the current team
   * @param user The user to remove from team
   */
  removeUserFromTeam(teamUser: TeamUser): void {
    this.teamUserDataService.delete(teamUser.id);
  }

  hasTeamRole(userId: string, teamRole: string): boolean {
    // if all members can invite, don't have to check each user
    if (this.team.canTeamMemberInvite && teamRole === TeamRole.Inviter) {
      return true;
    } else {
      const hasRole = this.userTeamRoles.some(utr =>
        utr.userId === userId && utr.role === teamRole && utr.teamId === this.team?.id);
      return hasRole;
    }
  }

  toggleTeamRole(userId: string, teamId: string, teamRole: string, addIt: boolean) {
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

  toggleAddMode(value: boolean) {
    this.isAddMode = value;
    if (value) {
      this.displayedTeamUserColumns = this.minUserColumns;

    } else {
      this.displayedTeamUserColumns = this.allUserColumns;
    }
  }

  onAnotherTeam(userId: string): boolean {
    return this.otherTeamUsers.some(tu => tu.userId === userId);
  }

  getUserTeamName(userId: string): string {
    let teamName = '';
    const teamUser = this.otherTeamUsers.find(tu => tu.userId === userId);
    if (teamUser && teamUser.teamId) {
      const team = this.teamList.find(t => t.id === teamUser.teamId);
      if (team) {
        teamName = team.shortName;
      }
    }
    return teamName;
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }

}
