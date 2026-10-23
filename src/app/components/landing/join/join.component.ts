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
import { MselImageDataService } from 'src/app/data/msel/msel-image-data.service';
import { TopbarView } from '../../shared/top-bar/topbar.models';
import { Title } from '@angular/platform-browser';
import { ErrorService } from 'src/app/services/error/error.service';
import { UIDataService } from 'src/app/data/ui/ui-data.service';
import { XApiService } from 'src/app/services/xapi/xapi.service';

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
  cardPhotos: { [id: string]: string } = {};
  private unsubscribe$ = new Subject();

  constructor(
    private userDataService: UserDataService,
    private userQuery: UserQuery,
    private settingsService: ComnSettingsService,
    private mselDataService: MselDataService,
    private mselImageDataService: MselImageDataService,
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private titleService: Title,
    private errorService: ErrorService,
    private uiDataService: UIDataService,
    private xApiService: XApiService
  ) {
    this.hideTopbar = this.uiDataService.inIframe();
    // set image
    this.imageFilePath = this.settingsService.settings.AppTopBarImage.replace(
      'white',
      'blue'
    );
    this.titleService.setTitle(this.appTitle);
    // Set the display settings from config file
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
    // Log xAPI viewed statement for join page
    this.xApiService.viewedJoinPage().subscribe();

    // Set current user for topbar
    this.userDataService.setCurrentUser();

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
        msels.forEach((msel) =>
          this.mselImageDataService
            .imageUrl(msel)
            .pipe(takeUntil(this.unsubscribe$))
            .subscribe((url) => {
              if (url) {
                this.cardPhotos[msel.id] = url;
              }
            })
        );
      });
  }

  // A card shows the MSEL's own image when it has one. Otherwise it gets a
  // pattern generated from the MSEL id, so the same event always looks the same.
  cardImage(msel: Msel): string {
    let hash = 0;
    for (const c of msel.id ?? msel.name ?? '') {
      hash = (hash * 31 + c.charCodeAt(0)) | 0;
    }
    const hue = Math.abs(hash) % 360;
    const angle = 30 + (Math.abs(hash >> 8) % 4) * 30;
    return `repeating-linear-gradient(${angle}deg, rgba(255, 255, 255, 0.08) 0 12px, transparent 12px 24px), ` +
      `linear-gradient(135deg, hsl(${hue}, 55%, 42%), hsl(${(hue + 40) % 360}, 60%, 30%))`;
  }

  initials(name: string): string {
    return (name ?? '')
      .split(/\s+/)
      .filter((word) => word)
      .slice(0, 2)
      .map((word) => word[0].toUpperCase())
      .join('');
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
