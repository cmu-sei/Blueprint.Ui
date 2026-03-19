// Copyright 2025 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, Input, OnDestroy, ViewChild } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  PlayerApplication,
  PlayerApplicationTeam,
  Team,
} from 'src/app/generated/blueprint.api';
import { PlayerApplicationQuery } from 'src/app/data/player-application/player-application.query';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { PlayerApplicationTeamDataService } from 'src/app/data/team/player-application-team-data.service';
import { TeamQuery } from 'src/app/data/team/team.query';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { animate, state, style, transition, trigger } from '@angular/animations';

@Component({
  selector: 'app-player-team-app-order',
  templateUrl: './player-team-app-order.component.html',
  styleUrls: ['./player-team-app-order.component.scss'],
  animations: [
    trigger('detailExpand', [
      state('collapsed', style({ height: '0px', minHeight: '0', visibility: 'hidden' })),
      state('expanded', style({ height: '*', visibility: 'visible' })),
      transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
    ]),
  ],
  standalone: false
})
export class PlayerTeamAppOrderComponent implements OnDestroy {
  @Input() loggedInUserId: string;
  @Input() canEdit: boolean;
  @Input() mselTeamList: Team[];
  @ViewChild('teamAppTable', { static: false }) teamAppTable: MatTable<any>;
  playerApplicationList: PlayerApplication[];
  editTeamId = '';
  playerApplicationTeamList: PlayerApplicationTeam[] = [];
  filterString = '';
  teamDataSource = new MatTableDataSource<Team>(new Array<Team>());
  displayedColumns: string[] = ['name'];
  expandedElementId = '';
  isExpansionDetailRow = (i: number, row: Object) => (row as Team).id === this.expandedElementId;
  private allTeams: Team[] = [];
  activeTeams: Team[] = [];
  private unsubscribe$ = new Subject();

  constructor(
    private playerApplicationQuery: PlayerApplicationQuery,
    private playerApplicationTeamDataService: PlayerApplicationTeamDataService,
    private teamQuery: TeamQuery,
    public dialogService: DialogService,
  ) {
    this.playerApplicationTeamDataService.playerApplicationTeams
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((playerApplicationTeams) => {
        this.playerApplicationTeamList = playerApplicationTeams;
      });
    // subscribe to playerApplications
    this.playerApplicationQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(playerApplications => {
      this.playerApplicationList = playerApplications;
    });
    // subscribe to teams directly from the store
    this.teamQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(teams => {
      this.activeTeams = teams;
      this.teamDataSource.data = teams;
    });
  }

  getActiveTeams(): Team[] {
    return this.activeTeams;
  }

  trackByFn(index, item) {
    return item.id;
  }

  rowClicked(row: Team) {
    if (this.expandedElementId === row.id) {
      this.expandedElementId = '';
    } else {
      this.expandedElementId = row.id;
    }
    this.teamAppTable.renderRows();
  }

  getRowClass(id: string) {
    return this.expandedElementId === id
      ? 'element-row element-row-expanded'
      : 'element-row element-row-not-expanded';
  }

  getTeamApplications(teamId: string): PlayerApplicationTeam[] {
    const tas = this.playerApplicationTeamList.filter(m => m.teamId === teamId).sort((a, b) => +a.displayOrder > +b.displayOrder ? 1 : -1);
    return tas;
  }

  getTeamName(teamId: string): string {
    const team = this.activeTeams.find(m => m.id === teamId);
    return team ? team.shortName + ' - ' + team.name : '';
  }

  getApplicationName(applicationId: string): string {
    const playerApplication = this.playerApplicationList.find(m => m.id === applicationId);
    return playerApplication ? playerApplication.name : 'not found';
  }

  moveUp(item: PlayerApplicationTeam) {
    const itemList = this.getTeamApplications(item.teamId);
    const index = itemList.findIndex(m => m.id === item.id);
    if (index > 0) {
      item.displayOrder = index;
    } else {
      item.displayOrder = 1;
    }
    this.playerApplicationTeamDataService.updatePlayerApplicationTeam(item);
  }

  moveDown(item: PlayerApplicationTeam) {
    const itemList = this.getTeamApplications(item.teamId);
    const index = itemList.findIndex(m => m.id === item.id);
    if (index < itemList.length - 1) {
      item.displayOrder = index + 2;
    } else {
      item.displayOrder = itemList.length;
    }
    this.playerApplicationTeamDataService.updatePlayerApplicationTeam(item);
  }

  saveTeamApplicationOrder(playerApplicationTeam: PlayerApplicationTeam) {
    this.playerApplicationTeamDataService.updatePlayerApplicationTeam(playerApplicationTeam);
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
