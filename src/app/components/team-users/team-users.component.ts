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
import { LegacyPageEvent as PageEvent, MatLegacyPaginator as MatPaginator } from '@angular/material/legacy-paginator';
import { MatSort, MatSortable } from '@angular/material/sort';
import { MatLegacyTableDataSource as MatTableDataSource } from '@angular/material/legacy-table';
import { TeamQuery } from 'src/app/data/team/team.query';
import { TeamRole, Team, TeamUser, User, UserTeamRole } from 'src/app/generated/blueprint.api';
import { TeamUserDataService } from 'src/app/data/team-user/team-user-data.service';
import { TeamUserQuery } from 'src/app/data/team-user/team-user.query';
import { UserDataService } from 'src/app/data/user/user-data.service';
import { UserTeamRoleDataService } from 'src/app/data/user-team-role/user-team-role-data.service';
import { UserTeamRoleQuery } from 'src/app/data/user-team-role/user-team-role.query';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
@Component({
  selector: 'app-team-users',
  templateUrl: './team-users.component.html',
  styleUrls: ['./team-users.component.scss'],
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
  filterControl = this.userDataService.filterControl;
  filterString = '';
  isAddMode = false;
  currentPageIndex = 0;
  pageSize = 7;
  itemCount = 0;
  teamRoles: string[] = ['Inviter', 'Observer', 'Incrementer', 'Modifier', 'Submitter'];
  private unsubscribe$ = new Subject();
  @ViewChild(MatPaginator, { static: true }) paginator: MatPaginator;
  @ViewChild(MatSort, { static: true }) sort: MatSort;

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
    this.sort.sort(<MatSortable>{ id: 'name', start: 'asc' });
    this.userDataSource.sort = this.sort;
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
    this.userDataSource.sort = this.sort;
    this.itemCount = this.userDataSource.data.length;
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

  handlePageEvent(pageEvent: PageEvent) {
    this.currentPageIndex = pageEvent.pageIndex;
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
