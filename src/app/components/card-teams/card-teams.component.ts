// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import {
  Component,
  OnDestroy,
  OnInit,
  Input,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { LegacyPageEvent as PageEvent, MatLegacyPaginator as MatPaginator } from '@angular/material/legacy-paginator';
import { MatSort, MatSortable } from '@angular/material/sort';
import { MatLegacyTableDataSource as MatTableDataSource } from '@angular/material/legacy-table';
import { Team } from 'src/app/generated/blueprint.api';
import { CardTeamDataService } from 'src/app/data/team/card-team-data.service';
import { TeamDataService } from 'src/app/data/team/team-data.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-card-teams',
  templateUrl: './card-teams.component.html',
  styleUrls: ['./card-teams.component.scss'],
})

export class CardTeamsComponent implements OnDestroy, OnInit {
  @Input() cardId: string;
  @Input() teamList: Team[];
  @ViewChild('teamsInput') teamsInput: ElementRef<HTMLInputElement>;
  @ViewChild(MatPaginator, { static: true }) paginator: MatPaginator;
  @ViewChild(MatSort, { static: true }) sort: MatSort;  teams: Team[];
  cardTeams: Team[];
  displayedTeamColumns: string[] = ['name', 'id'];
  displayedCardColumns: string[] = ['name', 'team'];
  teamDataSource = new MatTableDataSource<Team>(new Array<Team>());
  cardTeamDataSource = new MatTableDataSource<Team>(new Array<Team>());
  filterString = '';
  defaultPageSize = 100;
  pageEvent: PageEvent;
  private unsubscribe$ = new Subject();

  constructor(
    private cardTeamDataService: CardTeamDataService,
    private teamDataService: TeamDataService
  ) {}

  ngOnInit() {
    this.sort.sort(<MatSortable>{ id: 'name', start: 'asc' });
    this.teamDataSource.sort = this.sort;
    this.pageEvent = new PageEvent();
    this.pageEvent.pageIndex = 0;
    this.pageEvent.pageSize = this.defaultPageSize;
    this.cardTeamDataService.cardTeams.pipe(takeUntil(this.unsubscribe$)).subscribe(cardTeams => {
      const teams: Team[] = [];
      cardTeams.filter(et => et.cardId === this.cardId).forEach(et => {
        teams.push(this.teamList.find(t => t.id === et.teamId));
      });
      this.setDataSources(teams);
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

  setDataSources(cardTeams: Team[]) {
    // Now that all of the observables are returned, process accordingly.
    this.cardTeamDataSource.data = !cardTeams ? new Array<Team>() : cardTeams.sort((a, b) => {
      if (a.name < b.name) {
        return -1;
      } else if (a.name > b.name) {
        return 1;
      } else {
        return 0;
      }
    });
    const newAllTeams = !this.teamList ? new Array<Team>() : this.teamList.slice(0);
    this.cardTeamDataSource.data.forEach((et) => {
      const index = newAllTeams.findIndex((u) => u.id === et.id);
      newAllTeams.splice(index, 1);
    });
    this.teamDataSource = new MatTableDataSource(newAllTeams);
    this.teamDataSource.sort = this.sort;
    this.teamDataSource.paginator = this.paginator;
  }


  addTeamToCard(team: Team): void {
    const index = this.cardTeamDataSource.data.findIndex(
      (tu) => tu.id === team.id
    );
    if (index === -1) {
      this.cardTeamDataService.addTeamToCard(this.cardId, team);
    }
  }

  /**
   * Removes a team from the current card
   * @param team The team to remove from card
   */
  removeTeamFromCard(team: Team): void {
    const index = this.cardTeamDataSource.data.findIndex(
      (et) => et.id === team.id
    );
    if (index !== -1) {
      this.cardTeamDataService.removeCardTeam(this.cardId, team.id);
    }
  }

  compare(a: string, b: string, isAsc: boolean) {
    if (a === null || b === null) {
      return 0;
    } else {
      return (a.toLowerCase() < b.toLowerCase() ? -1 : 1) * (isAsc ? 1 : -1);
    }
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }

}
