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
  MselItemStatus,
  MselPage,
  MselUnit,
  ScenarioEvent,
  Team,
  User
} from 'src/app/generated/blueprint.api';
import { MselDataService, MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { MatLegacyMenuTrigger as MatMenuTrigger } from '@angular/material/legacy-menu';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { CiteService } from 'src/app/generated/blueprint.api';
import { PlayerService } from 'src/app/generated/blueprint.api';
import { ScoringModel } from 'src/app/generated/blueprint.api/model/scoringModel';
import { DataFieldQuery } from 'src/app/data/data-field/data-field.query';
import { MselPageDataService } from 'src/app/data/msel-page/msel-page-data.service';
import { MselPageQuery } from 'src/app/data/msel-page/msel-page.query';
import { MselUnitQuery } from 'src/app/data/msel-unit/msel-unit.query';
import { AngularEditorConfig } from '@kolkov/angular-editor';

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
  mselUnitList: MselUnit[] = [];
  scoringModelList: ScoringModel[] = [];
  itemStatus: MselItemStatus[] = [
    MselItemStatus.Pending,
    MselItemStatus.Entered,
    MselItemStatus.Approved,
    MselItemStatus.Deployed,
    MselItemStatus.Complete,
    MselItemStatus.Archived,
  ];
  viewUrl: string;
  starterUrl: string;
  mselPages: MselPage[] = [];
  newMselPage = {} as MselPage;
  changedMselPage = {} as MselPage;
  currentTabIndex = 0;
  editingPageId = '';
  editorConfig: AngularEditorConfig = {
    editable: true,
    spellcheck: true,
    height: 'auto',
    minHeight: '0',
    maxHeight: 'auto',
    width: 'auto',
    minWidth: '0',
    translate: 'yes',
    enableToolbar: true,
    showToolbar: true,
    placeholder: 'Enter text here...',
    defaultParagraphSeparator: '',
    defaultFontName: '',
    defaultFontSize: '',
    fonts: [
      { class: 'arial', name: 'Arial' },
      { class: 'times-new-roman', name: 'Times New Roman' },
      { class: 'calibri', name: 'Calibri' },
      { class: 'comic-sans-ms', name: 'Comic Sans MS' },
    ],
    uploadUrl: '',
    uploadWithCredentials: false,
    sanitize: false,
    toolbarPosition: 'top',
    toolbarHiddenButtons: [['backgroundColor']],
  };
  viewConfig: AngularEditorConfig = {
    editable: false,
    height: 'auto',
    minHeight: '1200px',
    width: '100%',
    minWidth: '0',
    translate: 'yes',
    enableToolbar: false,
    showToolbar: false,
    placeholder: '',
    defaultParagraphSeparator: '',
    defaultFontName: '',
    defaultFontSize: '',
    sanitize: false,
  };
  isBusy = true;
  dataFieldList: DataField[] = [];
  basePageUrl = document.baseURI + '/mselpage/';
  pushStatus = '';
  savedStartTime: Date;
  savedDurationSeconds = 0;
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
    private mselUnitQuery: MselUnitQuery
  ) {
    // subscribe to the active MSEL
    (this.mselQuery.selectActive() as Observable<MselPlus>)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((msel) => {
        if (msel) {
          const isNewMselId = this.msel.id !== msel.id;
          Object.assign(this.originalMsel, msel);
          Object.assign(this.msel, msel);
          if (isNewMselId) {
            this.viewUrl = document.baseURI + '/msel/' + this.msel.id + '/view';
            this.starterUrl =
              document.baseURI + '/starter/?msel=' + this.msel.id;
            this.mselPageDataService.loadByMsel(msel.id);
            this.newMselPage.mselId = msel.id;
          }
          this.savedStartTime = new Date(msel.startTime);
          this.savedDurationSeconds = msel.durationSeconds;
        }
      });
    // subscribe to MSEL loading flag
    this.mselQuery
      .selectLoading()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((isLoading) => {
        this.isBusy = isLoading;
      });
    // subscribe to MSEL push statuses
    this.mselDataService.mselPushStatuses
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((mselPushStatuses) => {
        const mselPushStatus = mselPushStatuses.find(
          (mps) => mps.mselId === this.msel.id
        );
        if (mselPushStatus) {
          if (mselPushStatus.pushStatus) {
            this.pushStatus = mselPushStatus.pushStatus;
          } else {
            if (this.pushStatus) {
              this.pushStatus = '';
              // added this, because signalR is not updating the actual msel data during a push
              this.mselDataService.loadById(this.msel.id);
            }
          }
        }
      });
    // subscribe to users
    this.userDataService.users
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((users) => {
        this.userList = users;
      });
    // subscribe to teams
    this.teamQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((teams) => {
        this.teamList = teams;
      });
    // subscribe to mselUnits
    this.mselUnitQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((mselUnits) => {
        this.mselUnitList = mselUnits;
      });
    // subscribe to MselPages
    this.mselPageQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((pages) => {
        this.mselPages = pages;
      });
    // subscribe to scoring models
    this.citeService.getScoringModels().subscribe((scoringModels) => {
      this.scoringModelList = scoringModels;
    });
    // subscribe to data fields
    this.dataFieldQuery.selectAll().subscribe((dataFields) => {
      this.dataFieldList = dataFields;
    });
  }

  getUserName(userId: string) {
    const user = this.userList.find((u) => u.id === userId);
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
    if (
      this.msel.hasRole(this.loggedInUserId, null).owner ||
      this.isContentDeveloper
    ) {
      this.deleteThisMsel.emit(this.msel.id);
    }
  }

  galleryWarningMessage() {
    let warningMessage = '';
    if (this.msel.useGallery && !this.msel.galleryExhibitId) {
      warningMessage = this.galleryToDo()
        ? '** There are unassigned Gallery Article Parameters in Data Fields **'
        : '';
    }
    return warningMessage;
  }

  citeWarningMessage() {
    let warningMessage = '';
    if (this.msel.useCite && !this.msel.citeEvaluationId) {
      warningMessage = this.teamList.some((t) => t.citeTeamTypeId)
        ? ''
        : '** WARNING: No teams have a CITE Team Type selected, so no teams will be pushed to CITE! **  ';
    }
    return warningMessage;
  }

  pushIntegrations() {
    this.dialogService
      .confirm(
        'Push Integrations',
        'Are you sure that you want to push MSEL data to the selected applications?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.mselDataService.pushIntegrations(this.msel.id);
          this.pushStatus = 'Pushing Integrations';
        }
      });
  }

  pullIntegrations() {
    this.dialogService
      .confirm(
        'Remove Integrations',
        'Are you sure you want to remove this MSEL from the associated applications?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.mselDataService.pullIntegrations(this.msel.id);
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
    this.changedMselPage = { ...this.mselPages.find((p) => p.id === id) };
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
    if (
      this.currentTabIndex > 0 &&
      this.currentTabIndex <= this.mselPages.length
    ) {
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
      todoList = todoList.filter(
        (x) =>
          !this.dataFieldList.some((df) => df.galleryArticleParameter === x)
      );
      hasToDos = todoList.length > 0;
    }
    return hasToDos;
  }

  startTimeCheck() {
    if (
      this.msel.startTime.toLocaleString() !==
      this.savedStartTime.toLocaleString()
    ) {
      this.isChanged = true;
    }
  }

  hasStartTime(): boolean {
    return this.msel.startTime && this.msel.startTime.valueOf() > 0;
  }

  toggleStartTime(event: any) {
    this.msel.startTime = event.checked
      ? new Date()
      : new Date('0001-01-01T00:00:00');
    this.msel.startTime.setHours(8, 0, 0, 0);
    this.msel.startTime.setDate(this.msel.startTime.getDate() + 1);
    this.startTimeCheck();
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
