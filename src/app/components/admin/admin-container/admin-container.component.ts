// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, OnDestroy, OnInit } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { LegacyPageEvent as PageEvent } from '@angular/material/legacy-paginator';
import { Sort } from '@angular/material/sort';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import { map, tap, take, takeUntil } from 'rxjs/operators';
import { PermissionService } from 'src/app/generated/blueprint.api/api/api';
import {
  Permission,
  User,
  UserPermission,
} from 'src/app/generated/blueprint.api/model/models';
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
  topbarText = 'Set AppTopBarText in Settings';
  showSection: Observable<string>;
  displayedSection = '';
  exitSection = '';
  isSidebarOpen = true;
  isSuperUser = false;
  canAccessAdminSection = false;
  teamList = this.teamDataService.teamList;
  userList = this.userDataService.userList;
  permissionList: Observable<Permission[]>;
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
    private permissionService: PermissionService,
    private settingsService: ComnSettingsService,
    private authQuery: ComnAuthQuery,
    titleService: Title,
    private signalRService: SignalRService
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
          this.userDataService
            .getPermissionsFromApi()
            .pipe(takeUntil(this.unsubscribe$))
            .subscribe();
          this.permissionList = this.permissionService.getPermissions();
        }
      });
    this.userDataService.canAccessAdminSection
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((result) => {
        this.canAccessAdminSection = result;
      });
    this.showSection = activatedRoute.queryParamMap.pipe(
      tap((params) => this.displayedSection = params.get('section')),
      map((params) => params.get('section') || this.usersText)
    );

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
    this.router.navigate([], {
      queryParams: { section: section },
      queryParamsHandling: 'merge',
    });
  }

  getSelectedClass(section: string) {
    if (section === this.displayedSection) {
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
