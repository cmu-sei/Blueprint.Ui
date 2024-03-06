// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort, MatSortable, Sort } from '@angular/material/sort';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  ComnSettingsService,
} from '@cmusei/crucible-common';
import { UserDataService } from 'src/app/data/user/user-data.service';
import {
  Msel,
} from 'src/app/generated/blueprint.api';
import { MselDataService } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { SignalRService } from 'src/app/services/signalr.service';
import { UntypedFormControl } from '@angular/forms';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { User } from 'src/app/generated/blueprint.api';

export enum Section {
  info = 'info',
  moves = 'moves',
  injects = 'injects'
}

@Component({
  selector: 'app-launch',
  templateUrl: './launch.component.html',
  styleUrls: ['./launch.component.scss'],
})
export class LaunchComponent implements OnDestroy, OnInit {
  @ViewChild(MatSort, { static: true }) sort: MatSort;
  mselList: Msel[] = [];
  isReady = false;
  uploadProgress = 0;
  uploadMselId = '';
  uploadTeamId = '';
  fileType = '';
  filteredMselList: Msel[] = [];
  filterControl = new UntypedFormControl();
  filterString = '';
  sortedMselList: Msel[] = [];
  defaultTab = 'Info';
  isLoading = true;
  areButtonsDisabled = false;
  mselDataSource: MatTableDataSource<Msel>;
  displayedColumns: string[] = ['action', 'name', 'description'];
  imageFilePath = '';
  userList: User[] = [];
  selectedMselType = 'all';
  selectedMselStatus = 'all';
  private unsubscribe$ = new Subject();

  constructor(
    public dialogService: DialogService,
    private userDataService: UserDataService,
    private settingsService: ComnSettingsService,
    private mselDataService: MselDataService,
    private mselQuery: MselQuery,
    private signalRService: SignalRService
  ) {
    // Initial datasource
    this.mselDataSource = new MatTableDataSource<Msel>(
      new Array<Msel>()
    );
    // load the MSELs
    this.mselDataService.loadMine();
    // subscribe to users
    this.userDataService.users.pipe(takeUntil(this.unsubscribe$)).subscribe(users => {
      this.userList = users;
    });
    // load the users
    this.userDataService.getUsersFromApi();
    // load the MSELs
    this.mselDataService.loadMine();
  }

  ngOnInit() {
    this.sort.sort(<MatSortable>{ id: 'name', start: 'asc' });
    this.mselDataSource.sort = this.sort;
    // subscribe to MSELs
    (this.mselQuery.selectAll() as Observable<Msel[]>).pipe(takeUntil(this.unsubscribe$)).subscribe((msels) => {
      this.mselList = msels;
      this.filterMsels();
      this.isLoading = false;
      this.areButtonsDisabled = false;
    });
    // subscribe to filter control changes
    this.filterControl.valueChanges.pipe(takeUntil(this.unsubscribe$)).subscribe((term) => {
      this.filterString = term;
      this.filterMsels();
    });
    // set image
    this.imageFilePath = this.settingsService.settings.AppTopBarImage.replace('white', 'blue');
    // remove case sensitivity from mat-table sort
    this.mselDataSource.sortingDataAccessor = (data: any, sortHeaderId: string): string => {
      if (typeof data[sortHeaderId] === 'string') {
        return data[sortHeaderId].toLocaleLowerCase();
      }
      return data[sortHeaderId];
    };
  }

  filterMsels() {
    this.mselDataSource.data = this.mselList.filter(m => m.isTemplate  && m.status.toString() === 'Approved');
    this.mselDataSource.filter = this.filterString.toLowerCase().trim(); //  MatTableDataSource defaults to lowercase matches
  }

  invite(id: string) {
    alert('Not Implemented');
  }

  launch(id: string) {
    alert('Not Implemented');
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
    this.signalRService.leave();
  }
}
