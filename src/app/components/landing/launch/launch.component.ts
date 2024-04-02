// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
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
import { ErrorService } from 'src/app/services/error/error.service';
import { ApplicationArea, SignalRService } from 'src/app/services/signalr.service';

@Component({
  selector: 'app-launch',
  templateUrl: './launch.component.html',
  styleUrls: ['./launch.component.scss'],
})
export class LaunchComponent implements OnDestroy, OnInit {
  launchMselList: Msel[] = [];
  imageFilePath = '';
  userList: User[] = [];
  topbarText = 'Start Event';
  hideTopbar = false;
  topbarColor = '#ef3a47';
  topbarTextColor = '#FFFFFF';
  topbarImage = this.settingsService.settings.AppTopBarImage;
  TopbarView = TopbarView;
  appTitle = 'Start Event';
  launchStatus = '';
  launchedMsel: Msel = {};
  private unsubscribe$ = new Subject();

  constructor(
    private userDataService: UserDataService,
    private settingsService: ComnSettingsService,
    private mselDataService: MselDataService,
    private router: Router,
    private titleService: Title,
    private errorService: ErrorService,
    private signalRService: SignalRService
  ) {
    // set image
    this.imageFilePath = this.settingsService.settings.AppTopBarImage.replace('white', 'blue');
    this.titleService.setTitle(this.appTitle);
    // Set the display settings from config file
    this.topbarColor = this.settingsService.settings.AppTopBarHexColor
      ? this.settingsService.settings.AppTopBarHexColor
      : this.topbarColor;
    this.topbarTextColor = this.settingsService.settings.AppTopBarHexTextColor
      ? this.settingsService.settings.AppTopBarHexTextColor
      : this.topbarTextColor;
    // subscribe to users
    this.userDataService.users.pipe(takeUntil(this.unsubscribe$)).subscribe(users => {
      this.userList = users;
    });
    // load the users
    this.userDataService.getUsersFromApi();
    // load the join MSELs
    this.mselDataService.getMyLaunchMsels().pipe(take(1)).subscribe((msels) => {
      this.launchMselList = msels;
    });
    // subscribe to MSEL push statuses
    this.mselDataService.mselPushStatuses.pipe(takeUntil(this.unsubscribe$)).subscribe(mselPushStatuses => {
      const mselPushStatus = mselPushStatuses.find(mps => mps.mselId === this.launchedMsel.id);
      if (mselPushStatus) {
        if (mselPushStatus.pushStatus) {
          this.launchStatus = mselPushStatus.pushStatus;
        } else {
          if (this.launchStatus) {
            this.launchStatus = '';
          }
        }
        if (this.launchStatus === '' && this.launchedMsel.playerViewId) {
          this.launchStatus = 'Preparing to display your event ...';
          let url = this.settingsService.settings.PlayerUrl;
          if (url.slice(-1) !== '/') {
            url = url + '/';
          }
          url = url + 'view/' + this.launchedMsel.playerViewId;
          this.launchedMsel = {};
          console.log('sending to the player view in 5 seconds');
          setTimeout(() => {
            location.href = url;
          }, 5000);
        }
      }
    });
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

  topBarNavigate(url): void {
    this.router.navigate([url]);
  }

  launch(id: string) {
    this.launchStatus = 'Starting the event ...';
    this.mselDataService.launch(id).pipe(take(1)).subscribe((msel) => {
      // join signalR for this MSEL
      this.signalRService.selectMsel(msel.id);
      this.launchedMsel = msel;
    },
    (error) => {
      this.launchStatus = '';
      this.launchedMsel = {};
      this.errorService.handleError(error);
    });
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
    this.signalRService.leave();
  }
}
