// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, Observable } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';
import {
  ComnSettingsService,
} from '@cmusei/crucible-common';
import { UserDataService } from 'src/app/data/user/user-data.service';
import {
  Msel,
} from 'src/app/generated/blueprint.api';
import { MselDataService } from 'src/app/data/msel/msel-data.service';
import { User } from 'src/app/generated/blueprint.api';
import { TopbarView } from '../../shared/top-bar/topbar.models';
import { Title } from '@angular/platform-browser';
import { UIDataService } from 'src/app/data/ui/ui-data.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnDestroy {
  launchMselList: Msel[] = [];
  joinMselList: Msel[] = [];
  buildMselList: Msel[] = [];
  imageFilePath = '';
  userList: User[] = [];
  topbarText = 'Event Dashboard';
  hideTopbar = false;
  topbarColor = '#ef3a47';
  topbarTextColor = '#FFFFFF';
  topbarImage = this.settingsService.settings.AppTopBarImage;
  TopbarView = TopbarView;
  appTitle = 'Event Dashboard';
  joinClass = 'base-card';
  launchClass = 'base-card';
  buildClass = 'base-card';
  isStarted = false;
  private unsubscribe$ = new Subject();

  constructor(
    private userDataService: UserDataService,
    private settingsService: ComnSettingsService,
    private mselDataService: MselDataService,
    private router: Router,
    private titleService: Title,
    private uiDataService: UIDataService
  ) {
    this.hideTopbar = this.uiDataService.inIframe();
    // set image
    this.imageFilePath = this.settingsService.settings.AppTopBarImage.replace(
      'white',
      'blue'
    );
    this.titleService.setTitle(this.appTitle);
    // Set the display settings from config file
    this.topbarColor = this.settingsService.settings.AppTopBarHexColor
      ? this.settingsService.settings.AppTopBarHexColor
      : this.topbarColor;
    this.topbarTextColor = this.settingsService.settings.AppTopBarHexTextColor
      ? this.settingsService.settings.AppTopBarHexTextColor
      : this.topbarTextColor;
    this.userDataService.loggedInUser.pipe(takeUntil(this.unsubscribe$)).subscribe((user) => {
      if (user && user.profile && user.profile.sub) {
        this.startup();
      }
    });
    setTimeout(() => {
      if (!this.isStarted) {
        window.location.reload();
      }
    }, 10000);
  }

  startup() {
    // subscribe to users
    this.userDataService.users
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((users) => {
        this.userList = users;
      });
    // load the users
    this.userDataService.getUsersFromApi();
    // load the launch MSELs
    this.mselDataService
      .getMyLaunchMsels()
      .pipe(take(1))
      .subscribe((msels) => {
        this.launchMselList = msels;
      });
    // load the join MSELs
    this.mselDataService
      .getMyJoinMsels()
      .pipe(take(1))
      .subscribe((msels) => {
        this.joinMselList = msels;
      });
    // load the build MSELs
    this.mselDataService
      .getMyBuildMsels()
      .pipe(take(1))
      .subscribe((msels) => {
        this.buildMselList = msels;
      });
    this.isStarted = true;
  }

  topBarNavigate(url): void {
    this.router.navigate([url]);
  }

  gotoUrl(url: string) {
    this.router.navigate([url]);
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
