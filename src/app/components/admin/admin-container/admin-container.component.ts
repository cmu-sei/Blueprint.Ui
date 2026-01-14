// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';
import { UnitDataService } from 'src/app/data/unit/unit-data.service';
import { UserDataService } from 'src/app/data/user/user-data.service';
import { UserQuery, CurrentUserQuery } from 'src/app/data/user/user.query';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { TopbarView } from 'src/app/components/shared/top-bar/topbar.models';
import {
  ComnSettingsService,
  ComnAuthQuery,
  ComnAuthService,
  Theme,
} from '@cmusei/crucible-common';
import { ApplicationArea, SignalRService } from 'src/app/services/signalr.service';
import { environment } from 'src/environments/environment';
import { HealthCheckService, SystemPermission, User } from 'src/app/generated/blueprint.api';
import { UIDataService } from 'src/app/data/ui/ui-data.service';
import { InjectTypeDataService } from 'src/app/data/inject-type/inject-type-data.service';

@Component({
  selector: 'app-admin-container',
  templateUrl: './admin-container.component.html',
  styleUrls: ['./admin-container.component.scss'],
  standalone: false
})
export class AdminContainerComponent implements OnDestroy, OnInit {
  usersText = 'Users';
  scoringModelsText = 'Scoring Models';
  rolesText = 'Roles';
  groupsText = 'Groups';
  unitsText = 'Units';
  dataFieldsText = 'Data Fields';
  injectTypesText = 'Inject Types';
  catalogsText = 'Catalogs';
  organizationsText = 'Organizations';
  galleryCardsText = 'Gallery Cards';
  citeActionsText = 'CITE Actions';
  citeDutiesText = 'CITE Duties';
  selectedTab = 'Organizations';
  displayedSection = '';
  exitSection = '';
  isSidebarOpen = true;
  loggedInUserId = '';
  username = '';
  canAccessAdminSection = false;
  // Permission-based access flags
  canViewUsers = false;
  canViewRoles = false;
  canViewGroups = false;
  hideTopbar = false;
  TopbarView = TopbarView;
  topbarColor = '#ef3a47';
  topbarTextColor = '#FFFFFF';
  topbarImage = this.settingsService.settings.AppTopBarImage;
  theme$: Observable<Theme>;
  userList$: Observable<User[]>;
  uiVersion = environment.VERSION;
  apiVersion = 'API ERROR!';
  private unsubscribe$ = new Subject();

  constructor(
    private router: Router,
    private unitDataService: UnitDataService,
    private userDataService: UserDataService,
    private userQuery: UserQuery,
    private currentUserQuery: CurrentUserQuery,
    private permissionDataService: PermissionDataService,
    private healthCheckService: HealthCheckService,
    private settingsService: ComnSettingsService,
    private authQuery: ComnAuthQuery,
    private authService: ComnAuthService,
    titleService: Title,
    private signalRService: SignalRService,
    private uiDataService: UIDataService,
    private injectTypeDataService: InjectTypeDataService,
  ) {
    this.theme$ = this.authQuery.userTheme$;
    this.hideTopbar = this.uiDataService.inIframe();
    // Set the display settings from config file
    this.topbarColor = this.settingsService.settings.AppTopBarHexColor
      ? this.settingsService.settings.AppTopBarHexColor
      : this.topbarColor;
    this.topbarTextColor = this.settingsService.settings.AppTopBarHexTextColor
      ? this.settingsService.settings.AppTopBarHexTextColor
      : this.topbarTextColor;
    const appTitle = this.settingsService.settings.AppTitle || 'Set AppTitle in Settings';
    titleService.setTitle(appTitle + ' Admin');
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
    // Set up user list observable
    this.userList$ = this.userQuery.selectAll();
    // Load users
    this.userDataService.load().pipe(take(1)).subscribe();
    // Set up current user
    this.userDataService.setCurrentUser();
    // Subscribe to current user
    this.currentUserQuery
      .select()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((cu) => {
        this.username = cu.name;
        this.loggedInUserId = cu.id;
      });
    // Load permissions
    this.permissionDataService.load()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(() => {
        this.canViewUsers = this.permissionDataService.hasPermission(SystemPermission.ViewUsers);
        this.canViewRoles = this.permissionDataService.hasPermission(SystemPermission.ViewRoles);
        this.canViewGroups = this.permissionDataService.hasPermission(SystemPermission.ViewGroups);
        // Update canAccessAdminSection based on having any admin permission
        this.canAccessAdminSection = this.canViewUsers || this.canViewRoles || this.canViewGroups;
        // Load additional data if user has permissions
        if (this.canAccessAdminSection) {
          this.unitDataService.load();
        }
      });
    // load injectTypes
    this.injectTypeDataService.load();
    // Start SignalR connection
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
      return 'non-selected-item';
    }
  }

  logout() {
    this.authService.logout();
  }

  getApiVersion() {
    this.healthCheckService
      .getVersion()
      .pipe(take(1))
      .subscribe(
        (message) => {
          const messageParts = message.split('+');
          this.apiVersion = messageParts[0];
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
