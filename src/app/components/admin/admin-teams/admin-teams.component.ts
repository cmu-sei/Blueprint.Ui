// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, Input, OnDestroy } from '@angular/core';
import { LegacyPageEvent as PageEvent } from '@angular/material/legacy-paginator';
import { Sort } from '@angular/material/sort';
import { Team, User } from 'src/app/generated/blueprint.api/model/models';
import { TeamDataService } from 'src/app/data/team/team-data.service';
import { TeamQuery } from 'src/app/data/team/team.query';
import { UserDataService } from 'src/app/data/user/user-data.service';
import { ComnSettingsService } from '@cmusei/crucible-common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { AdminTeamEditDialogComponent } from 'src/app/components/admin/admin-team-edit-dialog/admin-team-edit-dialog.component';
import { DialogService } from 'src/app/services/dialog/dialog.service';

@Component({
  selector: 'app-admin-teams',
  templateUrl: './admin-teams.component.html',
  styleUrls: ['./admin-teams.component.scss'],
})
export class AdminTeamsComponent implements OnDestroy {
  userList: User[] = [];
  allTeams: Team[] = [];
  teamList: Team[] = [];
  filterString = '';
  pageEvent: PageEvent;
  pageIndex = 0;
  pageSize = 20;
  sort: Sort = { active: 'shortName', direction: 'asc' };
  newTeam: Team = { id: '', name: '' };
  isLoading = false;
  topbarColor = '#ef3a47';
  addingNewTeam = false;
  newTeamName = '';
  editTeam: Team = {};
  originalTeamName = '';
  originalTeamShortName = '';
  defaultScoringModelId = this.settingsService.settings.DefaultScoringModelId;
  private unsubscribe$ = new Subject();

  constructor(
    private settingsService: ComnSettingsService,
    private dialog: MatDialog,
    public dialogService: DialogService,
    private teamDataService: TeamDataService,
    private teamQuery: TeamQuery,
    private userDataService: UserDataService
  ) {
    this.topbarColor = this.settingsService.settings.AppTopBarHexColor
      ? this.settingsService.settings.AppTopBarHexColor
      : this.topbarColor;
    // subscribe to all teams
    this.teamQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(teams => {
      this.allTeams = teams;
      this.applyFilter(this.filterString);
    });
    // load the teams
    this.teamDataService.load();
    // subscribe to all users
    this.userDataService.userList.pipe(takeUntil(this.unsubscribe$)).subscribe(users => {
      this.userList = users;
    });
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
    const dialogRef = this.dialog.open(AdminTeamEditDialogComponent, {
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

  togglePanel(team: Team) {
    this.editTeam = this.editTeam.id === team.id ? this.editTeam = {} : this.editTeam = { ...team};
  }

  selectTeam(team: Team) {
    this.editTeam = { ...team };
    this.originalTeamName = team.name;
    this.originalTeamShortName = team.shortName;
    return false;
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
    this.pageIndex = 0;
    filterValue = filterValue.toLowerCase(); // MatTableDataSource defaults to lowercase matches
    this.teamList = this.allTeams
      .filter(team =>
        team.name.toLowerCase().indexOf(filterValue) >= 0 ||
        team.shortName.toLowerCase().indexOf(filterValue) >= 0)
      .sort((a, b) => this.sortTeams(a, b));
  }

  sortChanged(sort: Sort) {
    this.sort = sort;
    this.applyFilter(this.filterString);
  }

  sortTeams(a: Team, b: Team): number {
    const dir = this.sort.direction === 'desc' ? -1 : 1;
    switch (this.sort.active) {
      case 'name':
        return a.name.toLowerCase() < b.name.toLowerCase() ? -dir : dir;
        break;
      default:
        return a.shortName.toLowerCase() < b.shortName.toLowerCase() ? -dir : dir;
        break;
    }
  }

  paginatorEvent(page: PageEvent) {
    this.pageIndex = page.pageIndex;
    this.pageSize = page.pageSize;
  }

  paginateTeams(pageIndex: number, pageSize: number) {
    if (!this.teamList) {
      return [];
    }
    const startIndex = pageIndex * pageSize;
    const copy = this.teamList.slice();
    return copy.splice(startIndex, pageSize);
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }

}
