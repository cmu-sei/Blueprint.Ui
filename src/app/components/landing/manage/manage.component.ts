// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  ComnSettingsService,
  ComnAuthService,
} from '@cmusei/crucible-common';
import { UserDataService } from 'src/app/data/user/user-data.service';
import { CurrentUserQuery } from 'src/app/data/user/user.query';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { MselDataService, MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { TopbarView } from '../../shared/top-bar/topbar.models';
import { Title } from '@angular/platform-browser';
import { ErrorService } from 'src/app/services/error/error.service';
import { MatDialog } from '@angular/material/dialog';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { InvitationDataService } from 'src/app/data/invitation/invitation-data.service';
import { TeamDataService } from 'src/app/data/team/team-data.service';
import { MselItemStatus, SystemPermission } from 'src/app/generated/blueprint.api';
import { UIDataService } from 'src/app/data/ui/ui-data.service';

@Component({
    selector: 'app-manage',
    templateUrl: './manage.component.html',
    styleUrls: ['./manage.component.scss'],
    standalone: false
})
export class ManageComponent implements OnDestroy, OnInit {
  msel: MselPlus = new MselPlus();
  imageFilePath = '';
  hideTopbar = false;
  topbarColor = '#ef3a47';
  topbarTextColor = '#FFFFFF';
  topbarText = 'Manage Event';
  topbarImage = this.settingsService.settings.AppTopBarImage;
  TopbarView = TopbarView;
  appTitle = 'Manage Event';
  manageStatus = '';
  startTime = new Date();
  endTime = new Date();
  loggedInUserId = '';
  canEditMsels = false;
  private unsubscribe$ = new Subject();

  constructor(
    private userDataService: UserDataService,
    private currentUserQuery: CurrentUserQuery,
    private permissionDataService: PermissionDataService,
    private authService: ComnAuthService,
    private settingsService: ComnSettingsService,
    private mselDataService: MselDataService,
    private mselQuery: MselQuery,
    private invitationDataService: InvitationDataService,
    private teamDataService: TeamDataService,
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private titleService: Title,
    public dialog: MatDialog,
    public dialogService: DialogService,
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
        if (mselId) {
          // reset and subscribe to the msel
          this.unsubscribe$.next(null);
          this.unsubscribe$.complete();
          this.unsubscribe$ = new Subject();
          this.mselDataService.setActive(mselId);
          (this.mselQuery.selectActive() as Observable<MselPlus>)
            .pipe(takeUntil(this.unsubscribe$))
            .subscribe((msel) => {
              if (msel) {
                if (msel.status !== MselItemStatus.Deployed) {
                  const url =
                    this.settingsService.settings.OIDCSettings
                      .post_logout_redirect_uri;
                  window.top.location.href = url;
                }
                this.msel = Object.assign(this.msel, msel);
                this.startTime = new Date(this.msel.startTime);
                this.endTime = new Date(
                  this.startTime.getTime() + this.msel.durationSeconds * 1000
                );
                this.invitationDataService.loadByMsel(msel.id);
                this.teamDataService.loadByMsel(mselId);
              }
            });
          // set appTitle and topbarText for top level
          this.mselDataService.loadById(mselId);
        }
      });
  }

  ngOnInit() {
    // Set up current user
    this.userDataService.setCurrentUser();
    // Subscribe to current user
    this.currentUserQuery
      .select()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((cu) => {
        this.loggedInUserId = cu.id;
      });
    // Load permissions
    this.permissionDataService.load()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(() => {
        this.canEditMsels = this.permissionDataService.hasPermission(SystemPermission.EditMsels);
      });
  }

  topBarNavigate(url): void {
    this.router.navigate([url]);
  }

  endEvent() {
    this.dialogService
      .confirm('End the Event', 'Are you sure that you want to end this event?')
      .subscribe((result) => {
        if (result['confirm']) {
          this.mselDataService.archive(this.msel.id);
        }
      });
  }

  invite() {
    alert('put invite modal here');
  }

  updateEndTime() {
    if (this.endTime) {
      this.msel.durationSeconds = Math.round(
        (this.endTime.getTime() - this.startTime.getTime()) / 1000
      );
      this.mselDataService.updateMsel(this.msel);
    }
  }

  logout() {
    this.authService.logout();
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
