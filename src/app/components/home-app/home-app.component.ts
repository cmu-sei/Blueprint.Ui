// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license, please see LICENSE.md in the project root for license information or contact permission@sei.cmu.edu for full terms.
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatSidenav } from '@angular/material/sidenav';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Observable, BehaviorSubject } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';
import {
  ComnSettingsService,
  Theme,
  ComnAuthQuery,
} from '@cmusei/crucible-common';
import { UserDataService } from 'src/app/data/user/user-data.service';
import { TopbarView } from './../shared/top-bar/topbar.models';
import {
  HealthCheckService,
  ItemStatus,
  Msel,
  Team
} from 'src/app/generated/blueprint.api';
import { MselDataService } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { MoveDataService } from 'src/app/data/move/move-data.service';
import { OrganizationDataService } from 'src/app/data/organization/organization-data.service';
import { TeamDataService } from 'src/app/data/team/team-data.service';
import { TeamQuery } from 'src/app/data/team/team.query';
import { ApplicationArea, SignalRService } from 'src/app/services/signalr.service';

export enum Section {
  info = 'info',
  moves = 'moves',
  injects = 'injects'
}

@Component({
  selector: 'app-home-app',
  templateUrl: './home-app.component.html',
  styleUrls: ['./home-app.component.scss'],
})
export class HomeAppComponent implements OnDestroy, OnInit {
  @ViewChild('sidenav') sidenav: MatSidenav;
  apiIsSick = false;
  apiMessage = 'The API web service is not responding.';
  topbarTextBase = 'Set AppTopBarText in Settings';
  topbarText = 'blank';
  section = Section;
  selectedSection = Section.injects;
  loggedInUserId = '';
  canAccessAdminSection$ = this.userDataService.canAccessAdminSection;
  isAuthorizedUser = false;
  isContentDeveloper$ = this.userDataService.isContentDeveloper;
  isSidebarOpen = true;
  private unsubscribe$ = new Subject();
  hideTopbar = false;
  topbarColor = '#ef3a47';
  topbarTextColor = '#FFFFFF';
  topbarImage = this.settingsService.settings.AppTopBarImage;
  TopbarView = TopbarView;
  theme$: Observable<Theme>;
  teamList: Team[] = [];
  isLoading$ = this.mselQuery.selectLoading();
  mselList = this.mselQuery.selectAll();
  selectedMselId = '';

  constructor(
    activatedRoute: ActivatedRoute,
    private router: Router,
    private userDataService: UserDataService,
    private settingsService: ComnSettingsService,
    private authQuery: ComnAuthQuery,
    private moveDataService: MoveDataService,
    private organizationDataService: OrganizationDataService,
    private teamDataService: TeamDataService,
    private teamQuery: TeamQuery,
    private mselDataService: MselDataService,
    private mselQuery: MselQuery,
    private signalRService: SignalRService,
    private healthCheckService: HealthCheckService,
    titleService: Title
  ) {
    this.healthCheck();

    var appTitle = this.settingsService.settings.AppTitle || 'Set AppTitle in Settings';
    titleService.setTitle(appTitle);
    this.topbarTextBase = this.settingsService.settings.AppTopBarText || this.topbarTextBase;
    this.topbarText = this.topbarTextBase;
    this.theme$ = this.authQuery.userTheme$;
    this.hideTopbar = this.inIframe();
    // subscribe to the logged in user
    this.userDataService.loggedInUser
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((user) => {
        if (user && user.profile && user.profile.sub != this.loggedInUserId) {
          this.loggedInUserId = user.profile.sub;
        }
      });
    // subscribe to authorizedUser
    this.userDataService.isAuthorizedUser
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((isAuthorized) => {
        this.isAuthorizedUser = isAuthorized;
      });
    // subscribe to route changes
    activatedRoute.queryParamMap.pipe(takeUntil(this.unsubscribe$)).subscribe(params => {
      this.selectedMselId = params.get('msel');
      if (this.selectedMselId) {
        // load the MSEL
        this.mselDataService.loadById(this.selectedMselId);
      }
    });
    // Set the display settings from config file
    this.topbarColor = this.settingsService.settings.AppTopBarHexColor
      ? this.settingsService.settings.AppTopBarHexColor
      : this.topbarColor;
    this.topbarTextColor = this.settingsService.settings.AppTopBarHexTextColor
      ? this.settingsService.settings.AppTopBarHexTextColor
      : this.topbarTextColor;
    // load the MSELs
    this.mselDataService.loadMine();
    // load the users
    this.userDataService.getUsersFromApi();
    // load the teams
    this.teamDataService.load();
    // load the organization templates
    this.organizationDataService.loadTemplates();
  }

  ngOnInit() {
    this.signalRService
      .startConnection(ApplicationArea.home)
      .then(() => {
        this.signalRService.join();
      })
      .catch((err) => {
        console.log(err);
      });
  }

  logout() {
    this.userDataService.logout();
  }

  inIframe() {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true;
    }
  }

  healthCheck() {
    this.healthCheckService
      .healthCheck()
      .pipe(take(1))
      .subscribe(
        (message) => {
          this.apiIsSick = message !== 'It is well';
          this.apiMessage = message;
        },
        (error) => {
          this.apiIsSick = true;
        }
      );
  }

  goToUrl(url): void {
    this.router.navigate([url]);
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
    this.signalRService.leave();
  }
}
