// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import { map, tap, take, takeUntil } from 'rxjs/operators';
import { TeamDataService } from 'src/app/data/team/team-data.service';
import { UserDataService } from 'src/app/data/user/user-data.service';
import { TopbarView } from 'src/app/components/shared/top-bar/topbar.models';
import {
  ComnSettingsService,
  ComnAuthQuery,
  Theme,
} from '@cmusei/crucible-common';
import { ApplicationArea, SignalRService } from 'src/app/services/signalr.service';
import { environment } from 'src/environments/environment';
import { HealthCheckService } from 'src/app/generated/blueprint.api/api/api';
import { UIDataService } from 'src/app/data/ui/ui-data.service';

@Component({
  selector: 'app-admin-container',
  templateUrl: './admin-container.component.html',
  styleUrls: ['./admin-container.component.scss'],
})
export class AdminContainerComponent implements OnDestroy, OnInit {
  loggedInUser = this.userDataService.loggedInUser;
  usersText = 'Users';
  scoringModelsText = 'Scoring Models';
  rolesText = 'Roles';
  teamsText = 'Teams';
  dataFieldsText = 'Data Fields';
  organizationsText = 'Organizations';
  galleryCardsText = 'Gallery Cards';
  citeActionsText = 'CITE Actions';
  citeRolesText = 'CITE Roles';
  topbarText = 'Set AppTopBarText in Settings';
  selectedTab = 'Organizations';
  displayedSection = '';
  exitSection = '';
  isSidebarOpen = true;
  isSuperUser = false;
  canAccessAdminSection = false;
  hideTopbar = false;
  TopbarView = TopbarView;
  topbarColor = '#ef3a47';
  topbarTextColor = '#FFFFFF';
  topbarImage = this.settingsService.settings.AppTopBarImage;
  theme$: Observable<Theme>;
  uiVersion = environment.VERSION;
  apiVersion = 'API ERROR!';
  private unsubscribe$ = new Subject();

  constructor(
    private router: Router,
    private teamDataService: TeamDataService,
    private userDataService: UserDataService,
    activatedRoute: ActivatedRoute,
    private healthCheckService: HealthCheckService,
    private settingsService: ComnSettingsService,
    private authQuery: ComnAuthQuery,
    titleService: Title,
    private signalRService: SignalRService,
    private uiDataService: UIDataService
  ) {
    this.theme$ = this.authQuery.userTheme$;
    this.hideTopbar = this.inIframe();
    this.userDataService.isSuperUser
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((result) => {
        this.isSuperUser = result;
        if (this.isSuperUser) {
          this.teamDataService.load();
          this.userDataService.getUsersFromApi();
        }
      });
    this.userDataService.canAccessAdminSection
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((result) => {
        this.canAccessAdminSection = result;
      });
    // Set the display settings from config file
    this.topbarColor = this.settingsService.settings.AppTopBarHexColor
      ? this.settingsService.settings.AppTopBarHexColor
      : this.topbarColor;
    this.topbarTextColor = this.settingsService.settings.AppTopBarHexTextColor
      ? this.settingsService.settings.AppTopBarHexTextColor
      : this.topbarTextColor;
    const appTitle = this.settingsService.settings.AppTitle || 'Set AppTitle in Settings';
    titleService.setTitle(appTitle + ' - Admin');
    this.topbarText = this.settingsService.settings.AppTopBarText || this.topbarText;
    this.getApiVersion();
    // set the selected tab
    let selectedTab = this.uiDataService.getAdminTab();
    if (!selectedTab) {
      this.uiDataService.setAdminTab(this.organizationsText);
      selectedTab = this.organizationsText;
    }
    this.selectedTab = selectedTab;
  }

  ngOnInit() {
    this.signalRService
      .startConnection(ApplicationArea.admin)
      .then(() => {
        this.signalRService.join();
      })
      .catch((err) => {
        console.log(err);
      });
  }

  gotoSection(section: string) {
    this.selectedTab = section;
    this.uiDataService.setAdminTab(section);
  }

  goToUrl(url): void {
    this.router.navigate([url], {
      queryParamsHandling: 'merge',
    });
  }

  getSelectedClass(section: string) {
    if (section === this.selectedTab) {
      return 'selected-item';
    } else {
      return null;
    }
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

  getApiVersion() {
    this.healthCheckService
      .getVersion()
      .pipe(take(1))
      .subscribe(
        (message) => {
          this.apiVersion = message;
        },
        (error) => {
          this.apiVersion = 'API ERROR!';
        }
      );
  }

  ngOnDestroy() {
    this.signalRService.leave();
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
