// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, OnDestroy } from '@angular/core';
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
import { ErrorService } from 'src/app/services/error/error.service';

@Component({
  selector: 'app-join',
  templateUrl: './join.component.html',
  styleUrls: ['./join.component.scss'],
})
export class JoinComponent implements OnDestroy {
  joinMselList: Msel[] = [];
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
  private unsubscribe$ = new Subject();

  constructor(
    private userDataService: UserDataService,
    private settingsService: ComnSettingsService,
    private mselDataService: MselDataService,
    private router: Router,
    private titleService: Title,
    private errorService: ErrorService
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
    this.mselDataService.getMyJoinMsels().pipe(take(1)).subscribe((msels) => {
      this.joinMselList = msels;
    });
  }

  topBarNavigate(url): void {
    this.router.navigate([url]);
  }

  join(id: string) {
    this.joinStatus[id] = 'Starting the event ...';
    this.mselDataService.join(id).pipe(take(1)).subscribe((playerViewId) => {
      let url = this.settingsService.settings.PlayerUrl;
      if (url.slice(-1) !== '/') {
        url = url + '/';
      }
      url = url + 'view/' + playerViewId;
      location.href = url;
    },
    (error) => {
      this.joinStatus[id] = '';
      this.isJoined[id] = false;
      this.errorService.handleError(error);
    });
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
