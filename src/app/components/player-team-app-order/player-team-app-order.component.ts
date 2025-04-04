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

@Component({
  selector: 'app-player-team-app-order',
  templateUrl: './player-team-app-order.component.html',
  styleUrls: ['./player-team-app-order.component.scss'],
})
export class PlayerTeamAppOrderComponent implements OnDestroy {
  @Input() loggedInUserId: string;
  @Input() canEdit: boolean;
  @Input() mselTeamList: Team[];
  playerApplicationList: PlayerApplication[];
  editTeamId = '';
  playerApplicationTeamList: PlayerApplicationTeam[] = [];
  filterString = '';
  private allTeams: Team[] = [];
  private unsubscribe$ = new Subject();

  constructor(
    private playerApplicationQuery: PlayerApplicationQuery,
    private playerApplicationTeamDataService: PlayerApplicationTeamDataService,
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
  }

  trackByFn(index, item) {
    return item.id;
  }

  getTeamApplications(teamId: string): PlayerApplicationTeam[] {
    return this.playerApplicationTeamList.filter(m => m.teamId === teamId).sort((a, b) => +a.displayOrder > +b.displayOrder ? 1 : -1);
  }

  getTeamName(teamId: string): string {
    const team = this.mselTeamList.find(m => m.id === teamId);
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
