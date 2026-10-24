// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, OnDestroy, OnInit, inject, input } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  ComnSettingsService,
  Theme,
  ComnAuthQuery,
} from '@cmusei/crucible-common';
import { Msel, SystemPermission } from 'src/app/generated/blueprint.api';
import { CatalogDataService } from 'src/app/data/catalog/catalog-data.service';
import { DataFieldDataService } from 'src/app/data/data-field/data-field-data.service';
import { DataOptionDataService } from 'src/app/data/data-option/data-option-data.service';
import { DataValueDataService } from 'src/app/data/data-value/data-value-data.service';
import { MoveDataService } from 'src/app/data/move/move-data.service';
import { MselDataService } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { OrganizationDataService } from 'src/app/data/organization/organization-data.service';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { ScenarioEventDataService } from 'src/app/data/scenario-event/scenario-event-data.service';
import {
  ApplicationArea,
  SignalRService,
} from 'src/app/services/signalr.service';
import { TeamDataService } from 'src/app/data/team/team-data.service';
import { TeamUserDataService } from 'src/app/data/team-user/team-user-data.service';
import { TopbarView } from '../shared/top-bar/topbar.models';
import { UnitDataService } from 'src/app/data/unit/unit-data.service';
import { UserDataService } from 'src/app/data/user/user-data.service';
import { CurrentUserQuery } from 'src/app/data/user/user.query';
import { UserMselRoleDataService } from 'src/app/data/user-msel-role/user-msel-role-data.service';
import { UserTeamRoleDataService } from 'src/app/data/user-team-role/user-team-role-data.service';
import { TopbarComponent } from '../shared/top-bar/topbar.component';
import { ScenarioEventListComponent } from '../scenario-event-list/scenario-event-list.component';
import { AsyncPipe } from '@angular/common';

@Component({
    selector: 'app-starter',
    templateUrl: './starter.component.html',
    styleUrls: ['./starter.component.scss'],
    imports: [TopbarComponent, ScenarioEventListComponent, AsyncPipe]
})
export class StarterComponent implements OnDestroy, OnInit {
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
  private catalogDataService = inject(CatalogDataService);
  private dataFieldDataService = inject(DataFieldDataService);
  private dataOptionDataService = inject(DataOptionDataService);
  private dataValueDataService = inject(DataValueDataService);
  private moveDataService = inject(MoveDataService);
  private mselDataService = inject(MselDataService);
  private mselQuery = inject(MselQuery);
  private organizationDataService = inject(OrganizationDataService);
  private permissionDataService = inject(PermissionDataService);
  private scenarioEventDataService = inject(ScenarioEventDataService);
  private signalRService = inject(SignalRService);
  private teamDataService = inject(TeamDataService);
  private teamUserDataService = inject(TeamUserDataService);
  private unitDataService = inject(UnitDataService);
  private userDataService = inject(UserDataService);
  private currentUserQuery = inject(CurrentUserQuery);
  private userMselRoleDataService = inject(UserMselRoleDataService);
  private userTeamRoleDataService = inject(UserTeamRoleDataService);
  private authQuery = inject(ComnAuthQuery);
  private settingsService = inject(ComnSettingsService);
  private titleService = inject(Title);

  readonly canAccessAdminSection = input<boolean>(undefined);
  private unsubscribe$ = new Subject();
  private msel: Msel = { name: '' };
  selectedIndex = 1;
  selectedMselId = '';
  theme$: Observable<Theme>;
  loggedInUserId: string;
  isContentDeveloper = false;
  userTheme$ = this.authQuery.userTheme$;
  hideTopbar = false;
  topbarColor = '#ef3a47';
  topbarTextColor = '#FFFFFF';
  topbarImage = this.settingsService.settings.AppTopBarImage;
  TopbarView = TopbarView;
  topbarTextBase = 'Set AppTopBarText in Settings';
  topbarText = 'blank';
  appTitle = '';

  constructor() {
    this.theme$ = this.authQuery.userTheme$;
    // subscribe to route changes
    this.activatedRoute.queryParamMap
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((params) => {
        this.topbarText = this.topbarTextBase;
        // load the selected MSEL data
        const mselId = params.get('msel');
        if (mselId && this.selectedMselId !== mselId) {
          // load the selected MSEL and make it active
          this.mselDataService.loadById(mselId);
          this.mselDataService.setActive(mselId);
          // load the MSELs moves
          this.moveDataService.loadByMsel(mselId);
          // load the MSEL Teams
          this.teamDataService.loadByMsel(mselId);
          // load the MSEL organizations and templates
          this.organizationDataService.loadByMsel(mselId);
          // load data fields, options, and values
          this.dataFieldDataService.loadByMsel(mselId);
          this.dataOptionDataService.loadByMsel(mselId);
          this.dataValueDataService.loadByMsel(mselId);
          // load scenario events
          this.scenarioEventDataService.loadByMsel(mselId);
          // load user msel roles
          this.userMselRoleDataService.loadByMsel(mselId);
          // load user team roles
          this.userTeamRoleDataService.loadByMsel(mselId);
          // load the Msel TeamUsers
          this.teamUserDataService.loadByMsel(mselId);
          // load the Catalogs
          this.catalogDataService.loadMine();
          // load the users
          this.userDataService.loadByMsel(mselId).subscribe();
          // set the selected MSEL
          this.selectedMselId = mselId;
          this.mselDataService.setActive(mselId);
        }
      });
    // subscribe to the active MSEL
    (this.mselQuery.selectActive() as Observable<Msel>)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((msel) => {
        if (msel) {
          this.msel = msel;
          // set appTitle and topbarText for the selected MSEL
          const prefix = this.appTitle + ' - ';
          this.topbarText = msel ? prefix + msel.name : this.topbarTextBase;
          this.titleService.setTitle(prefix + msel.name);
        } else {
          this.msel = { name: '' };
        }
      });
    // load units
    this.unitDataService.load();
    // load the organization templates
    this.organizationDataService.loadTemplates();
    // Set the display settings from config file
    this.appTitle =
      this.settingsService.settings.AppTitle || 'Set AppTitle in Settings';
    this.titleService.setTitle(this.appTitle);
    this.topbarTextBase =
      this.settingsService.settings.AppTopBarText || this.topbarTextBase;
    this.topbarText = this.topbarTextBase;
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
        this.isContentDeveloper = this.permissionDataService.hasPermission(SystemPermission.CreateMsels);
      });
    // Start SignalR connection
    this.signalRService
      .startConnection(ApplicationArea.home)
      .then(() => {
        this.signalRService.join();
        // select MSEL in signalR updates
        this.signalRService.selectMsel(this.selectedMselId);
      })
      .catch((err) => {
        console.log(err);
      });
  }

  goToUrl(url): void {
    if (url !== '/') {
      this.router.navigate([url], {
        queryParamsHandling: 'merge',
      });
    }
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
