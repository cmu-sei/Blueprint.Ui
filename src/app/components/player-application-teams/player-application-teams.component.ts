// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  Input,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { PageEvent, MatPaginator } from '@angular/material/paginator';
import { MatSort, MatSortable } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { PlayerApplicationTeam, SystemPermission, Team } from 'src/app/generated/blueprint.api';
import { PlayerApplicationTeamDataService } from 'src/app/data/team/player-application-team-data.service';
import { MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
    selector: 'app-player-application-teams',
    templateUrl: './player-application-teams.component.html',
    styleUrls: ['./player-application-teams.component.scss'],
    standalone: false
})

export class PlayerApplicationTeamsComponent implements OnDestroy, OnInit {
  @Input() loggedInUserId: string;
  @Input() playerApplicationId: string;
  @Input() mselTeamList: Team[] = [];
  @ViewChild('teamsInput') teamsInput: ElementRef<HTMLInputElement>;
  @ViewChild(MatPaginator, { static: true }) paginator: MatPaginator;
  @ViewChild(MatSort, { static: true }) sort: MatSort;
  msel = new MselPlus();
  teams: Team[];
  playerApplicationTeams: PlayerApplicationTeam[];
  mselTeamColumns: string[] = ['name', 'id'];
  playerApplicationTeamColumns: string[] = ['name', 'id'];
  displayedPlayerApplicationColumns: string[] = ['name', 'team'];
  teamDataSource = new MatTableDataSource<Team>(new Array<Team>());
  playerApplicationTeamDataSource = new MatTableDataSource<Team>(new Array<Team>());
  filterString = '';
  defaultPageSize = 100;
  pageEvent: PageEvent;
  private unsubscribe$ = new Subject();

  constructor(
    private playerApplicationTeamDataService: PlayerApplicationTeamDataService,
    private mselQuery: MselQuery,
    private permissionDataService: PermissionDataService,
    private changeDetectorRef: ChangeDetectorRef
  ) {
    // Subscribe to the active MSEL
    (this.mselQuery.selectActive() as Observable<MselPlus>).pipe(takeUntil(this.unsubscribe$)).subscribe(msel => {
      if (msel) {
        Object.assign(this.msel, msel);
      }
    });
  }

  ngOnInit() {
    // Load permissions and trigger change detection when loaded
    this.permissionDataService.load()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(() => {
        this.changeDetectorRef.markForCheck();
      });
    this.sort.sort(<MatSortable>{ id: 'name', start: 'asc' });
    this.teamDataSource.sort = this.sort;
    this.pageEvent = new PageEvent();
    this.pageEvent.pageIndex = 0;
    this.pageEvent.pageSize = this.defaultPageSize;
    this.playerApplicationTeamDataService.playerApplicationTeams
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((playerApplicationTeams) => {
        this.playerApplicationTeams = playerApplicationTeams
          ? playerApplicationTeams
            .filter(
              (et) => et.playerApplicationId === this.playerApplicationId
            )
            .sort((a, b) => {
              if (
                this.getTeamShortName(a.teamId).toLowerCase() <
                this.getTeamShortName(b.teamId).toLowerCase()
              ) {
                return -1;
              } else if (
                this.getTeamShortName(a.teamId).toLowerCase() >
                this.getTeamShortName(b.teamId).toLowerCase()
              ) {
                return 1;
              } else {
                return 0;
              }
            })
          : new Array<PlayerApplicationTeam>();
        this.setDataSources();
      });
  }

  applyFilter(filterValue: string) {
    this.filterString = filterValue;
    this.pageEvent.pageIndex = 0;
    filterValue = filterValue.toLowerCase(); // MatTableDataSource defaults to lowercase matches
    this.teamDataSource.filter = filterValue;
  }

  clearFilter() {
    this.applyFilter('');
  }

  setDataSources() {
    this.playerApplicationTeamDataSource.data = this.playerApplicationTeams;
    let mselTeams = new Array<Team>();
    if (this.mselTeamList) {
      mselTeams = this.mselTeamList.filter(mt => !this.playerApplicationTeams.some(ct => ct.teamId === mt.id));
    }
    this.teamDataSource = new MatTableDataSource(mselTeams);
    this.teamDataSource.sort = this.sort;
  }

  getTeamShortName(teamId: string) {
    const team = this.mselTeamList.find(t => t.id === teamId);
    return team ? team.shortName : teamId;
  }


  addTeamToPlayerApplication(team: Team): void {
    this.playerApplicationTeamDataService.addTeamToPlayerApplication(
      this.playerApplicationId,
      team,
      this.playerApplicationTeamDataSource.data.length + 1
    );
  }

  /**
   * Removes a team from the current playerApplication
   * @param team The team to remove from playerApplication
   */
  removeTeamFromPlayerApplication(playerApplicationTeamId: string): void {
    this.playerApplicationTeamDataService.removePlayerApplicationTeam(playerApplicationTeamId);
  }

  compare(a: string, b: string, isAsc: boolean) {
    if (a === null || b === null) {
      return 0;
    } else {
      return (a.toLowerCase() < b.toLowerCase() ? -1 : 1) * (isAsc ? 1 : -1);
    }
  }

  canEditMsel(): boolean {
    return this.permissionDataService.hasPermission(SystemPermission.EditMsels) ||
      this.msel.hasRole(this.loggedInUserId, '').editor;
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }

}
