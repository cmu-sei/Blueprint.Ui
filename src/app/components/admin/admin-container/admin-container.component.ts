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
import { map, tap, takeUntil } from 'rxjs/operators';
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
  filterControl: UntypedFormControl = this.userDataService.filterControl;
  filterString: Observable<string>;
  permissionList: Observable<Permission[]>;
  pageSize: Observable<number>;
  pageIndex: Observable<number>;
  hideTopbar = false;
  TopbarView = TopbarView;
  topbarColor = '#ef3a47';
  topbarTextColor = '#FFFFFF';
  topbarImage = this.settingsService.settings.AppTopBarImage;
  theme$: Observable<Theme>;
  private unsubscribe$ = new Subject();

  constructor(
    private router: Router,
    private teamDataService: TeamDataService,
    private userDataService: UserDataService,
    activatedRoute: ActivatedRoute,
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
    this.filterString = activatedRoute.queryParamMap.pipe(
      map((params) => params.get('filter') || '')
    );
    this.pageSize = activatedRoute.queryParamMap.pipe(
      map((params) => parseInt(params.get('pagesize') || '20', 10))
    );
    this.pageIndex = activatedRoute.queryParamMap.pipe(
      map((params) => parseInt(params.get('pageindex') || '0', 10))
    );
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
    titleService.setTitle(appTitle);
    this.topbarText = this.settingsService.settings.AppTopBarText || this.topbarText;
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
      queryParams: { section: section, filter: '', sorton: '', sortdir: '' },
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

  selectUser(userId: string) {
    this.router.navigate([], {
      queryParams: { userId: userId },
      queryParamsHandling: 'merge',
    });
  }

  addUserHandler(user: User) {
    this.userDataService.addUser(user);
  }

  deleteUserHandler(user: User) {
    this.userDataService.deleteUser(user);
  }

  addUserPermissionHandler(userPermission: UserPermission) {
    this.userDataService.addUserPermission(userPermission);
  }

  removeUserPermissionHandler(userPermission: UserPermission) {
    this.userDataService.deleteUserPermission(userPermission);
  }

  sortChangeHandler(sort: Sort) {
    this.router.navigate([], {
      queryParams: { sorton: sort.active, sortdir: sort.direction },
      queryParamsHandling: 'merge',
    });
  }

  pageChangeHandler(page: PageEvent) {
    this.router.navigate([], {
      queryParams: { pageindex: page.pageIndex, pagesize: page.pageSize },
      queryParamsHandling: 'merge',
    });
  }

  inIframe() {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true;
    }
  }

  ngOnDestroy() {
    this.signalRService.leave();
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
