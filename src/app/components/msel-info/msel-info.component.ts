// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, Input, OnDestroy, ViewChild } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TeamQuery } from 'src/app/data/team/team.query';
import { UserDataService } from 'src/app/data/user/user-data.service';
import {
  DataField,
  ItemStatus,
  MselPage,
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
import { MselPageDataService } from 'src/app/data/msel-page/msel-page-data.service';
import { MselPageQuery } from 'src/app/data/msel-page/msel-page.query';

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
  private unsubscribe$ = new Subject();
  // context menu
  @ViewChild(MatMenuTrigger, { static: true }) contextMenu: MatMenuTrigger;
  contextMenuPosition = { x: '0px', y: '0px' };
  isChanged = false;
  userList: User[] = [];
  teamList: Team[] = [];
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

  constructor(
    public dialogService: DialogService,
    private teamQuery: TeamQuery,
    private userDataService: UserDataService,
    private mselDataService: MselDataService,
    private mselQuery: MselQuery,
    private citeService: CiteService,
    private playerService: PlayerService,
    private mselPageDataService: MselPageDataService,
    private mselPageQuery: MselPageQuery
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
      }
    });
    //
    this.mselQuery.selectLoading().pipe(takeUntil(this.unsubscribe$)).subscribe(isLoading => {
      this.isBusy = isLoading;
    });
    // subscribe to users
    this.userDataService.users.pipe(takeUntil(this.unsubscribe$)).subscribe(users => {
      this.userList = users;
    });
    // subscribe to teams
    this.teamQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(teams => {
      this.teamList = teams;
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

  addViewTeamsToMsel() {
    this.playerService.addViewTeamsToMsel(this.msel.id).subscribe();
  }

  pushToCite() {
    this.dialogService
      .confirm(
        'Push to CITE',
        'Are you sure that you want to push this MSEL to CITE?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.mselDataService.pushToCite(this.msel.id);
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
    const url = location.origin + '/mselpage/' + id;
    window.open(url);
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
