// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatSidenav } from '@angular/material/sidenav';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Observable } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';
import {
  ComnSettingsService,
  Theme,
  ComnAuthQuery,
} from '@cmusei/crucible-common';
import { UserDataService } from 'src/app/data/user/user-data.service';
import { TopbarView } from '../shared/top-bar/topbar.models';
import {
  HealthCheckService,
  Msel,
  Team
} from 'src/app/generated/blueprint.api';
import { MselDataService } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { ApplicationArea, SignalRService } from 'src/app/services/signalr.service';
import { UIDataService } from 'src/app/data/ui/ui-data.service';

export enum Section {
  info = 'info',
  moves = 'moves',
  injects = 'injects',
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
  isSystemAdmin$ = this.userDataService.isSuperUser;
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
  appTitle = '';

  constructor(
    activatedRoute: ActivatedRoute,
    private router: Router,
    private userDataService: UserDataService,
    private settingsService: ComnSettingsService,
    private authQuery: ComnAuthQuery,
    private mselDataService: MselDataService,
    private mselQuery: MselQuery,
    private signalRService: SignalRService,
    private healthCheckService: HealthCheckService,
    private titleService: Title,
    private uiDataService: UIDataService
  ) {
    this.healthCheck();
    this.appTitle =
      this.settingsService.settings.AppTitle || 'Set AppTitle in Settings';
    this.titleService.setTitle(this.appTitle);
    this.topbarTextBase =
      this.settingsService.settings.AppTopBarText || this.topbarTextBase;
    this.topbarText = this.topbarTextBase;
    this.theme$ = this.authQuery.userTheme$;
    this.hideTopbar = this.uiDataService.inIframe();
    // subscribe to the logged in user
    this.userDataService.loggedInUser
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((user) => {
        if (user && user.profile && user.profile.sub !== this.loggedInUserId) {
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
    activatedRoute.queryParamMap
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((params) => {
        this.selectedMselId = params.get('msel');
        if (!this.selectedMselId) {
          // set appTitle and topbarText for top level
          this.mselDataService.setActive('');
          this.topbarText = this.topbarTextBase;
          this.titleService.setTitle(this.appTitle);
        }
      });
    // subscribe to the selected MSEL
    (this.mselQuery.selectActive() as Observable<Msel>)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((m) => {
        if (m) {
          // set appTitle and topbarText for the selected MSEL
          const prefix = this.appTitle + ' - ';
          this.topbarText = m ? prefix + m.name : this.topbarTextBase;
          this.titleService.setTitle(prefix + m.name);
        }
      });
    // Set the display settings from config file
    this.topbarColor = this.settingsService.settings.AppTopBarHexColor
      ? this.settingsService.settings.AppTopBarHexColor
      : this.topbarColor;
    this.topbarTextColor = this.settingsService.settings.AppTopBarHexTextColor
      ? this.settingsService.settings.AppTopBarHexTextColor
      : this.topbarTextColor;
  }

  ngOnInit() {
    this.signalRService
      .startConnection(ApplicationArea.home)
      .then(() => {
        this.signalRService.join();
        if (this.selectedMselId) {
          // join signalR for this MSEL
          setTimeout(
            () => this.signalRService.selectMsel(this.selectedMselId),
            1000
          );
        }
      })
      .catch((err) => {
        console.log(err);
      });
  }

  logout() {
    this.userDataService.logout();
  }

  healthCheck() {
    this.healthCheckService
      .getReadiness()
      .pipe(take(1))
      .subscribe(
        (healthReport) => {
          this.apiIsSick =
            !healthReport ||
            !healthReport.status ||
            healthReport.status !== 'Healthy';
          if (!healthReport || !healthReport.status) {
            this.apiIsSick = true;
            if (healthReport.status !== 'Healthy') {
              this.apiMessage =
                'The API web service is not healthy (' +
                healthReport.status +
                ').';
            }
          }
          this.apiMessage = healthReport.status;
        },
        (error) => {
          this.apiIsSick = true;
          this.apiMessage = 'The API web service is not responding.';
        }
      );
  }

  topBarNavigate(url): void {
    if (url === '/') {
      this.router.navigate([url]);
    } else {
      this.router.navigate([url], {
        queryParamsHandling: 'merge',
      });
    }
  }

  deleteMsel(id: string) {
    this.mselDataService.delete(id);
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
    this.signalRService.leave();
  }
}
