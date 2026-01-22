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
import { UserQuery } from 'src/app/data/user/user.query';
import {
  Msel,
  User,
} from 'src/app/generated/blueprint.api';
import { MselDataService } from 'src/app/data/msel/msel-data.service';
import { TopbarView } from '../../shared/top-bar/topbar.models';
import { Title } from '@angular/platform-browser';
import { ErrorService } from 'src/app/services/error/error.service';
import { UIDataService } from 'src/app/data/ui/ui-data.service';

@Component({
    selector: 'app-join',
    templateUrl: './join.component.html',
    styleUrls: ['./join.component.scss'],
    standalone: false
})
export class JoinComponent implements OnDestroy, OnInit {
  joinMselList: Msel[] = [];
  joiningMselId = '';
  imageFilePath = '';
  userList: User[] = [];
  topbarText = 'Join Event';
  hideTopbar = false;
  topbarColor = '#ef3a47';
  topbarTextColor = '#FFFFFF';
  topbarImage = this.settingsService.settings.AppTopBarImage;
  TopbarView = TopbarView;
  appTitle = 'Join Event';
  joinStatus: { [id: string]: string } = {};
  isJoined: { [id: string]: boolean } = {};
  showChoices = false;
  private unsubscribe$ = new Subject();

  constructor(
    private userDataService: UserDataService,
    private userQuery: UserQuery,
    private settingsService: ComnSettingsService,
    private mselDataService: MselDataService,
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private titleService: Title,
    private errorService: ErrorService,
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
    // subscribe to route changes
    this.activatedRoute.queryParamMap
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((params) => {
        const mselId = params.get('msel');
        const teamId = params.get('team');
        if (mselId) {
          // launch the msel
          this.join(mselId, teamId);
          this.showChoices = false;
        } else {
          this.showChoices = true;
        }
      });
  }

  ngOnInit() {
    // subscribe to users
    this.userQuery.selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((users) => {
        this.userList = users;
      });
    // load the users
    this.userDataService.load().pipe(take(1)).subscribe();
    // load the join MSELs
    this.mselDataService
      .getMyJoinMsels()
      .pipe(take(1))
      .subscribe((msels) => {
        this.joinMselList = msels;
      });
  }

  topBarNavigate(url): void {
    this.router.navigate([url]);
  }

  join(mselId: string, teamId: string) {
    this.joinStatus[mselId] = 'Processing your request ...';
    this.joiningMselId = mselId;
    this.mselDataService
      .join(mselId, teamId)
      .pipe(take(1))
      .subscribe(
        (playerViewId) => {
          let playerUrl = this.settingsService.settings.PlayerUrl;
          if (playerUrl.slice(-1) !== '/') {
            playerUrl = playerUrl + '/';
          }
          playerUrl = playerUrl + 'view/' + playerViewId;
          location.href = playerUrl;
        },
        (error) => {
          this.joinStatus[mselId] = '';
          this.isJoined[mselId] = false;
          this.showChoices = true;
          this.errorService.handleError(error);
        }
      );
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
