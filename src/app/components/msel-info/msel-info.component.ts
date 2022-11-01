// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license, please see LICENSE.md in the project root for license information or contact permission@sei.cmu.edu for full terms.
import { Component, Input, OnDestroy, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TeamQuery } from 'src/app/data/team/team.query';
import { UserDataService } from 'src/app/data/user/user-data.service';
import {
  DataField,
  ScenarioEvent,
  Team,
  User
} from 'src/app/generated/blueprint.api';
import { MselDataService, MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { MatMenuTrigger } from '@angular/material/menu';
import { DialogService } from 'src/app/services/dialog/dialog.service';

@Component({
  selector: 'app-msel-info',
  templateUrl: './msel-info.component.html',
  styleUrls: ['./msel-info.component.scss'],
})
export class MselInfoComponent implements OnDestroy {
  @Input() loggedInUserId: string;
  @Input() isContentDeveloper: boolean;
  msel = new MselPlus();
  originalMsel = new MselPlus();
  expandedScenarioEventIds: string[] = [];
  sortedScenarioEvents: ScenarioEvent[];
  sortedDataFields: DataField[];
  private unsubscribe$ = new Subject();
  // context menu
  @ViewChild(MatMenuTrigger, { static: true }) contextMenu: MatMenuTrigger;
  contextMenuPosition = { x: '0px', y: '0px' };
  isEditEnabled = false;
  userList: User[] = [];
  teamList: Team[] = [];

  constructor(
    private teamQuery: TeamQuery,
    private userDataService: UserDataService,
    private mselDataService: MselDataService,
    private mselQuery: MselQuery,
    public dialogService: DialogService
  ) {
    // subscribe to the active MSEL
    (this.mselQuery.selectActive() as Observable<MselPlus>).pipe(takeUntil(this.unsubscribe$)).subscribe(msel => {
      if (msel) {
        Object.assign(this.originalMsel, msel);
        Object.assign(this.msel, msel);
        this.sortedDataFields = this.getSortedDataFields(msel.dataFields);
      }
    });
    // subscribe to users
    this.userDataService.users.pipe(takeUntil(this.unsubscribe$)).subscribe(users => {
      this.userList = users;
    });
    // subscribe to teams
    this.teamQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(teams => {
      this.teamList = teams;
    });
  }

  getUserName(userId: string) {
    const user = this.userList.find(u => u.id === userId);
    return user ? user.name : 'unknown';
  }

  getSortedDataFields(dataFields: DataField[]): DataField[] {
    const sortedDataFields: DataField[] = [];
    if (dataFields) {
      dataFields.forEach(df => {
        sortedDataFields.push({... df});
      });
      sortedDataFields.sort((a, b) => +a.displayOrder > +b.displayOrder ? 1 : -1);
    }
    return sortedDataFields;
  }

  saveChanges() {
    this.mselDataService.updateMsel(this.msel);
    this.isEditEnabled = false;
  }

  cancelChanges() {
    this.isEditEnabled = false;
    Object.assign(this.msel, this.originalMsel);
  }

  pushToGallery() {
    this.dialogService
    .confirm(
      'Push to Gallery',
      'Are you sure that you want to push this MSEL to Gallery?'
    )
    .subscribe((result) => {
      if (result['confirm']) {
        this.mselDataService.pushToGallery(this.msel.id);
      }
    });
  }

  pullFromGallery() {
    this.dialogService
    .confirm(
      'Remove from Gallery',
      'Are you sure you want to delete the Collection and all associated data from Gallery?'
    )
    .subscribe((result) => {
      if (result['confirm']) {
        this.mselDataService.pullFromGallery(this.msel.id);
      }
    });
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
