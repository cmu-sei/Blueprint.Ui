// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
import { PlayerApplicationDataService } from 'src/app/data/player-application/player-application-data.service';
import { User } from 'src/app/generated/blueprint.api';
import { TopbarView } from '../../shared/top-bar/topbar.models';
import { Title } from '@angular/platform-browser';
import { ErrorService } from 'src/app/services/error/error.service';
import { ApplicationArea, SignalRService } from 'src/app/services/signalr.service';
import { UIDataService } from 'src/app/data/ui/ui-data.service';

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
  launchingMselId = '';
  launchedMsel: Msel = {};
  showChoices = false;
  private unsubscribe$ = new Subject();

  constructor(
    private userDataService: UserDataService,
    private settingsService: ComnSettingsService,
    private mselDataService: MselDataService,
    private playerApplicationDataService: PlayerApplicationDataService,
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private titleService: Title,
    private errorService: ErrorService,
    private signalRService: SignalRService,
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
    // subscribe to users
    this.userDataService.users
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((users) => {
        this.userList = users;
      });
    // load the users
    this.userDataService.getUsersFromApi();
    // load the join MSELs
    this.mselDataService
      .getMyLaunchMsels()
      .pipe(take(1))
      .subscribe((msels) => {
        this.launchMselList = msels;
      });
    // subscribe to MSEL push statuses
    this.mselDataService.mselPushStatuses
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((mselPushStatuses) => {
        const mselPushStatus = mselPushStatuses.find(
          (mps) => mps.mselId === this.launchedMsel.id
        );
        if (mselPushStatus) {
          console.log('mselPushStatus is ' + mselPushStatus.pushStatus);
          if (mselPushStatus.pushStatus) {
            console.log('set launch status to ' + mselPushStatus.pushStatus);
            this.launchStatus = mselPushStatus.pushStatus;
          } else {
            if (this.launchedMsel.playerViewId) {
              console.log('set launch status to Adding event management ...');
              this.launchStatus = 'Adding event management ...';
              // add a manage event application
              const playerApplication = {
                mselId: this.launchedMsel.id,
                name: 'Manage Event',
                url:
                  document.baseURI +
                  '/manage?msel=' +
                  this.launchedMsel.id +
                  '&{theme}',
                icon: document.baseURI + '/assets/img/pencil-ruler-blue.png',
                embeddable: true,
                loadInBackground: false,
              };
              console.log('add new player application');
              this.playerApplicationDataService
                .addAndPush(playerApplication)
                .pipe(take(1))
                .subscribe((s) => {
                  // redirect to player view
                  this.launchStatus = 'Completing event processing ...';
                  let playerUrl = this.settingsService.settings.PlayerUrl;
                  if (playerUrl.slice(-1) !== '/') {
                    playerUrl = playerUrl + '/';
                  }
                  playerUrl =
                    playerUrl + 'view/' + this.launchedMsel.playerViewId;
                  location.href = playerUrl;
                });
            } else {
              console.log('clearing launch status');
              this.launchStatus = '';
            }
          }
        }
      });
    // subscribe to route changes
    this.activatedRoute.queryParamMap
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((params) => {
        const mselId = params.get('msel');
        const teamId = params.get('team');
        if (mselId) {
          // launch the msel
          this.launch(mselId, teamId);
          this.showChoices = false;
        } else {
          this.showChoices = true;
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

  launch(mselId: string, teamId: string) {
    this.launchingMselId = mselId;
    this.launchStatus = 'Starting the event ...';
    this.mselDataService
      .launch(mselId, teamId)
      .pipe(take(1))
      .subscribe(
        (msel) => {
          // join signalR for this MSEL
          this.signalRService.selectMsel(msel.id);
          this.launchedMsel = msel;
        },
        (error) => {
          this.launchingMselId = '';
          this.launchStatus = '';
          this.launchedMsel = {};
          this.showChoices = true;
          this.errorService.handleError(error);
        }
      );
  }

  logout() {
    this.userDataService.logout();
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
    this.signalRService.leave();
  }
}
