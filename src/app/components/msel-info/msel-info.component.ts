// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, EventEmitter, Input, OnDestroy, Output, ViewChild } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TeamQuery } from 'src/app/data/team/team.query';
import { UserDataService } from 'src/app/data/user/user-data.service';
import {
  DataField,
  ItemStatus,
  MselPage,
  MselTeam,
  ScenarioEvent,
  Team,
  User,
  PlayerApiClientView
} from 'src/app/generated/blueprint.api';
import { MselDataService, MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { MatLegacyMenuTrigger as MatMenuTrigger } from '@angular/material/legacy-menu';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { CiteService } from 'src/app/generated/blueprint.api';
import { PlayerService } from 'src/app/generated/blueprint.api';
import { CiteApiClientScoringModel } from 'src/app/generated/blueprint.api/model/citeApiClientScoringModel';
import { DataFieldQuery } from 'src/app/data/data-field/data-field.query';
import { MselPageDataService } from 'src/app/data/msel-page/msel-page-data.service';
import { MselPageQuery } from 'src/app/data/msel-page/msel-page.query';
import { MselTeamQuery } from 'src/app/data/msel-team/msel-team.query';
import { UntypedFormControl } from '@angular/forms';

@Component({
  selector: 'app-msel-info',
  templateUrl: './msel-info.component.html',
  styleUrls: ['./msel-info.component.scss'],
})
export class MselInfoComponent implements OnDestroy {
  @Input() loggedInUserId: string;
  @Input() isContentDeveloper: boolean;
  @Output() deleteThisMsel = new EventEmitter<string>();
  msel = new MselPlus();
  originalMsel = new MselPlus();
  expandedScenarioEventIds: string[] = [];
  sortedScenarioEvents: ScenarioEvent[];
  private unsubscribe$ = new Subject();
  // context menu
  @ViewChild(MatMenuTrigger, { static: true }) contextMenu: MatMenuTrigger;
  contextMenuPosition = { x: '0px', y: '0px' };
  isChanged = false;
  userList: User[] = [];
  teamList: Team[] = [];
  mselTeamList: MselTeam[] = [];
  scoringModelList: CiteApiClientScoringModel[] = [];
  viewList: PlayerApiClientView[] = [];
  itemStatus: ItemStatus[] = [ItemStatus.Pending, ItemStatus.Entered, ItemStatus.Approved, ItemStatus.Complete];
  viewUrl: string;
  mselPages: MselPage[] = [];
  newMselPage = {} as MselPage;
  changedMselPage = {} as MselPage;
  currentTabIndex = 0;
  editingPageId = '';
  editorStyle = {
    'height': 'calc(100vh - 334px)',
    'width': '100%',
    'overflow': 'auto'
  };
  isBusy = true;
  dataFieldList: DataField[] = [];
  basePageUrl = location.origin + '/mselpage/';
  pushStatus = '';
  savedStartTime: Date;
  savedDurationSeconds = 0;
  endTimeFormControl = new UntypedFormControl();
  days = 0;
  hours = 0;
  minutes = 0;
  seconds = 0;

  constructor(
    public dialogService: DialogService,
    private teamQuery: TeamQuery,
    private userDataService: UserDataService,
    private dataFieldQuery: DataFieldQuery,
    private mselDataService: MselDataService,
    private mselQuery: MselQuery,
    private citeService: CiteService,
    private playerService: PlayerService,
    private mselPageDataService: MselPageDataService,
    private mselPageQuery: MselPageQuery,
    private mselTeamQuery: MselTeamQuery
  ) {
    // subscribe to the active MSEL
    (this.mselQuery.selectActive() as Observable<MselPlus>).pipe(takeUntil(this.unsubscribe$)).subscribe(msel => {
      if (msel) {
        const isNewMselId = this.msel.id !== msel.id;
        Object.assign(this.originalMsel, msel);
        Object.assign(this.msel, msel);
        if (isNewMselId) {
          this.viewUrl = window.location.origin + '/msel/' + this.msel.id + '/view';
          this.mselPageDataService.loadByMsel(msel.id);
          this.newMselPage.mselId = msel.id;
        }
        this.savedStartTime = new Date(msel.startTime);
        this.savedDurationSeconds = msel.durationSeconds;
        this.endTimeFormControl.setValue(this.getDateFromDurationSeconds(msel.durationSeconds));
        this.setDeltaValues();
      }
    });
    // subscribe to MSEL loading flag
    this.mselQuery.selectLoading().pipe(takeUntil(this.unsubscribe$)).subscribe(isLoading => {
      this.isBusy = isLoading;
    });
    // subscribe to MSEL push statuses
    this.mselDataService.mselPushStatuses.pipe(takeUntil(this.unsubscribe$)).subscribe(mselPushStatuses => {
      const mselPushStatus = mselPushStatuses.find(mps => mps.mselId === this.msel.id);
      this.pushStatus = mselPushStatus ? mselPushStatus.pushStatus : '';
    });
    // subscribe to users
    this.userDataService.users.pipe(takeUntil(this.unsubscribe$)).subscribe(users => {
      this.userList = users;
    });
    // subscribe to teams
    this.teamQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(teams => {
      this.teamList = teams;
    });
    // subscribe to mselTeams
    this.mselTeamQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(mselTeams => {
      this.mselTeamList = mselTeams;
    });
    // subscribe to MselPages
    this.mselPageQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(pages => {
      this.mselPages = pages;
    });
    // subscribe to views
    this.playerService.getViews().subscribe(views => {
      this.viewList = views;
    });
    // subscribe to scoring models
    this.citeService.getScoringModels().subscribe(scoringModels => {
      this.scoringModelList = scoringModels;
    });
    // subscribe to data fields
    this.dataFieldQuery.selectAll().subscribe(dataFields => {
      this.dataFieldList = dataFields;
    });
  }

  getUserName(userId: string) {
    const user = this.userList.find(u => u.id === userId);
    return user ? user.name : 'unknown';
  }

  saveChanges() {
    this.mselDataService.updateMsel(this.msel);
    this.isChanged = false;
  }

  cancelChanges() {
    this.isChanged = false;
    Object.assign(this.msel, this.originalMsel);
  }

  deleteMsel() {
    if (this.msel.hasRole(this.loggedInUserId, null).owner || this.isContentDeveloper) {
      this.deleteThisMsel.emit(this.msel.id);
    }
  }

  addViewTeamsToMsel() {
    this.playerService.addViewTeamsToMsel(this.msel.id).subscribe();
  }

  galleryWarningMessage() {
    let warningMessage = '';
    if (this.msel.useGallery && !this.msel.galleryExhibitId) {
      warningMessage = this.galleryToDo() ?
        '** There are unassigned Gallery Article Parameters in Data Fields **' : '';
    }
    return warningMessage;
  }

  citeWarningMessage() {
    let warningMessage = '';
    if (this.msel.useCite && !this.msel.citeEvaluationId) {
      warningMessage = this.mselTeamList.some(t => t.citeTeamTypeId) ?
        '' : '** WARNING: No teams have a CITE Team Type selected, so no teams will be pushed to CITE! **  ';
    }
    return warningMessage;
  }

  pushToCite() {
    this.dialogService
      .confirm(
        'Push to CITE',
        this.citeWarningMessage() + 'Are you sure that you want to push this MSEL to CITE?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.mselDataService.pushToCite(this.msel.id);
          this.pushStatus = 'Pushing to CITE';
        }
      });
  }

  pullFromCite() {
    this.dialogService
      .confirm(
        'Remove from CITE',
        'Are you sure you want to delete the Evaluation and all associated data from CITE?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.mselDataService.pullFromCite(this.msel.id);
        }
      });
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
          this.pushStatus = 'Pushing to Gallery';
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

  tabChange(event: any) {
    this.currentTabIndex = event.index;
    if (event.index > 0 && event.index <= this.mselPages.length) {
      this.changedMselPage = this.mselPages[event.index - 1];
    } else {
      this.changedMselPage = {} as MselPage;
    }
  }

  requestPageEdit(id: string) {
    this.editingPageId = id;
    this.changedMselPage = { ... this.mselPages.find(p => p.id === id) };
  }

  saveMselPageEdits() {
    this.changedMselPage.mselId = this.originalMsel.id;
    if (this.changedMselPage.id) {
      this.mselPageDataService.update(this.changedMselPage);
    } else {
      this.mselPageDataService.add(this.changedMselPage);
    }
    this.changedMselPage = {} as MselPage;
    this.editingPageId = '';
  }

  cancelMselPageEdits() {
    if (this.currentTabIndex > 0 && this.currentTabIndex <= this.mselPages.length) {
      this.changedMselPage = this.mselPages[this.currentTabIndex - 1];
    } else {
      this.changedMselPage = {} as MselPage;
    }
    this.editingPageId = '';
  }

  deletePage(page: MselPage): void {
    this.dialogService
      .confirm(
        'Delete Page',
        'Are you sure that you want to delete ' + page.name + '?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.mselPageDataService.delete(page.id);
        }
      });
  }

  openContent(id: string) {
    window.open(this.basePageUrl + id);
  }

  galleryToDo(): boolean {
    let hasToDos = false;
    let todoList = Object.assign([], this.msel.galleryArticleParameters);
    if (todoList && todoList.length > 0) {
      todoList = todoList.filter(x => !this.dataFieldList.some(df => df.galleryArticleParameter === x));
      hasToDos = todoList.length > 0;
    }
    return hasToDos;
  }

  startTimeCheck() {
    if (this.msel.startTime.toLocaleString() !== this.savedStartTime.toLocaleString()) {
      this.isChanged = true;
    }
  }

  durationSecondsCheck() {
    if (this.savedDurationSeconds !== this.msel.durationSeconds) {
      this.isChanged = true;
    }
  }

  getDateFromDurationSeconds(durationSeconds: number): Date {
    const startTime = new Date(this.msel.startTime);
    return new Date(startTime.getTime() + (durationSeconds * 1000));
  }

  getDurationSecondsFromDate() {
    const endTimeValue = this.endTimeFormControl.value;
    const endTimeSeconds = endTimeValue.getTime() / 1000;
    const startValue = new Date(this.msel.startTime);
    const startSeconds = startValue.getTime() / 1000;
    return endTimeSeconds - startSeconds;
  }

  setDeltaValues() {
    let durationSeconds = this.getDurationSecondsFromDate();
    this.msel.durationSeconds = durationSeconds;
    // get the number of days
    this.days = Math.floor(durationSeconds / 86400);
    durationSeconds = durationSeconds % 86400;
    // get the number of hours
    this.hours = Math.floor(durationSeconds / 3600);
    durationSeconds = durationSeconds % 3600;
    // get the number of minutes
    this.minutes = Math.floor(durationSeconds / 60);
    durationSeconds = durationSeconds % 60;
    // get the number of seconds
    this.seconds = +durationSeconds;
  }

  calculateDurationSeconds() {
    return this.days * 86400 + this.hours * 3600 + this.minutes * 60 + this.seconds;
  }

  deltaUpdated(event: any, whichValue: string) {
    let setValue = +event.target.value;
    switch (whichValue) {
      case 'd':
        setValue = setValue < 0 ? 0 : setValue;
        this.days = setValue;
        break;
      case 'h':
        setValue = setValue < 0 ? 0 : setValue > 23 ? 23 : setValue;
        this.hours = setValue;
        break;
      case 'm':
        setValue = setValue < 0 ? 0 : setValue > 59 ? 59 : setValue;
        this.minutes = setValue;
        break;
      case 's':
        setValue = setValue < 0 ? 0 : setValue > 59 ? 59 : setValue;
        this.seconds = setValue;
        break;
    }
    this.msel.durationSeconds = this.calculateDurationSeconds();
    this.endTimeFormControl.setValue(this.getDateFromDurationSeconds(this.msel.durationSeconds));
    this.durationSecondsCheck();
  }

  timeUpdated() {
    this.msel.durationSeconds = this.getDurationSecondsFromDate();
    this.setDeltaValues();
    this.durationSecondsCheck();
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
