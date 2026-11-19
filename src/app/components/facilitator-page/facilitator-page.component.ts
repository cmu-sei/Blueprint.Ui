// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { AsyncPipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { ComnAuthQuery, ComnSettingsService } from '@cmusei/crucible-common';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  AutomationRunKind,
  Msel,
  MselRole,
  SystemPermission,
  UserMselRole,
} from 'src/app/generated/blueprint.api';
import { AutomationRunDataService } from 'src/app/data/automation-run/automation-run-data.service';
import { AutomationTaskDataService } from 'src/app/data/automation-task/automation-task-data.service';
import { CardDataService } from 'src/app/data/card/card-data.service';
import { DataFieldDataService } from 'src/app/data/data-field/data-field-data.service';
import { DataOptionDataService } from 'src/app/data/data-option/data-option-data.service';
import { DataValueDataService } from 'src/app/data/data-value/data-value-data.service';
import { MoveDataService } from 'src/app/data/move/move-data.service';
import { MselExecutionDataService } from 'src/app/data/msel-execution/msel-execution-data.service';
import { MselDataService } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { ScenarioEventDataService } from 'src/app/data/scenario-event/scenario-event-data.service';
import { TeamDataService } from 'src/app/data/team/team-data.service';
import { UserMselRoleDataService } from 'src/app/data/user-msel-role/user-msel-role-data.service';
import { UserMselRoleQuery } from 'src/app/data/user-msel-role/user-msel-role.query';
import { UserDataService } from 'src/app/data/user/user-data.service';
import { CurrentUserQuery } from 'src/app/data/user/user.query';
import { reloadOnReconnect } from 'src/app/services/hub-reconnect.service';
import {
  ApplicationArea,
  SignalRService,
} from 'src/app/services/signalr.service';
import {
  canFacilitate,
  canViewFacilitator,
} from 'src/app/utilities/facilitator-msels';
import { FacilitatorViewComponent } from '../facilitator-view/facilitator-view.component';
import { FacilitateComponent } from '../landing/facilitate/facilitate.component';
import { TopbarComponent } from '../shared/top-bar/topbar.component';
import { TopbarView } from '../shared/top-bar/topbar.models';

/**
 * The Facilitator View on a page of its own, at /facilitate?msel=…, as a facilitator opens it from the Facilitate
 * list. Unlike the Assessor page it follows the exercise live: runs, results and the MSEL's position arrive over
 * SignalR, and a reconnect reads them all again.
 */
@Component({
  selector: 'app-facilitator-page',
  templateUrl: './facilitator-page.component.html',
  styleUrls: ['./facilitator-page.component.scss'],
  imports: [
    AsyncPipe,
    FacilitateComponent,
    FacilitatorViewComponent,
    MatIcon,
    TopbarComponent,
  ],
})
export class FacilitatorPageComponent implements OnDestroy, OnInit {
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
  private automationRunDataService = inject(AutomationRunDataService);
  private automationTaskDataService = inject(AutomationTaskDataService);
  private cardDataService = inject(CardDataService);
  private dataFieldDataService = inject(DataFieldDataService);
  private dataOptionDataService = inject(DataOptionDataService);
  private dataValueDataService = inject(DataValueDataService);
  private executionDataService = inject(MselExecutionDataService);
  private moveDataService = inject(MoveDataService);
  private mselDataService = inject(MselDataService);
  private mselQuery = inject(MselQuery);
  private scenarioEventDataService = inject(ScenarioEventDataService);
  private teamDataService = inject(TeamDataService);
  private userDataService = inject(UserDataService);
  private currentUserQuery = inject(CurrentUserQuery);
  private authQuery = inject(ComnAuthQuery);
  private settingsService = inject(ComnSettingsService);
  private titleService = inject(Title);
  private userMselRoleDataService = inject(UserMselRoleDataService);
  private userMselRoleQuery = inject(UserMselRoleQuery);
  private permissionDataService = inject(PermissionDataService);
  private signalRService = inject(SignalRService);

  private unsubscribe$ = new Subject();
  private msel: Msel = { name: '' };
  selectedMselId = '';
  loggedInUserId: string;
  userTheme$ = this.authQuery.userTheme$;
  private readonly settings = this.settingsService.settings as {
    AppTopBarImage?: string;
    AppTitle?: string;
    AppTopBarText?: string;
  };
  topbarImage = this.settings.AppTopBarImage;
  TopbarView = TopbarView;
  topbarTextBase = 'Set AppTopBarText in Settings';
  topbarText = 'blank';
  appTitle = '';
  canViewFacilitatorPage = false;
  canFacilitatePage = false;
  // Whether the user may change which data fields the Facilitator View shows.
  canChooseFacilitatorFields = false;
  private canViewMsels = false;
  private canEditMsels = false;
  private connected = false;

  constructor() {
    this.activatedRoute.queryParamMap
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((params) => {
        this.topbarText = this.topbarTextBase;
        const mselId = params.get('msel');
        if (mselId && this.selectedMselId !== mselId) {
          this.selectedMselId = mselId;
          this.load(mselId);
          this.mselDataService.setActive(mselId);
          this.selectHub();
        } else if (!mselId) {
          // back to the list of exercises to facilitate
          this.selectedMselId = '';
          this.updateRolePermissions();
        }
      });
    // a reconnect may have missed broadcasts, so everything is read again
    reloadOnReconnect(() => {
      if (this.selectedMselId) this.load(this.selectedMselId);
    });

    (this.mselQuery.selectActive() as Observable<Msel>)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((msel) => {
        if (msel) {
          this.msel = msel;
          this.updateRolePermissions();
          const prefix = this.appTitle + ' - ';
          this.topbarText = prefix + msel.name;
          this.titleService.setTitle(prefix + msel.name);
        } else {
          this.msel = { name: '' };
        }
      });

    this.appTitle = this.settings.AppTitle || 'Set AppTitle in Settings';
    this.titleService.setTitle(this.appTitle);
    this.topbarTextBase = this.settings.AppTopBarText || this.topbarTextBase;
    this.topbarText = this.topbarTextBase;
  }

  ngOnInit() {
    this.userDataService.setCurrentUser();
    this.currentUserQuery
      .select()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((cu) => {
        this.loggedInUserId = cu.id;
        this.updateRolePermissions();
      });
    this.permissionDataService
      .load()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(() => {
        this.canViewMsels = this.permissionDataService.hasPermission(
          SystemPermission.ViewMsels,
        );
        this.canEditMsels = this.permissionDataService.hasPermission(
          SystemPermission.EditMsels,
        );
        this.updateRolePermissions();
      });
    this.userMselRoleQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(() => this.updateRolePermissions());
    this.signalRService
      .startConnection(ApplicationArea.home)
      .then(() => {
        this.connected = true;
        void this.signalRService.join();
        this.selectHub();
      })
      .catch((err) => console.log(err));
  }

  /** Everything the view shows, read with the queries it is kept current by. */
  private load(mselId: string) {
    this.mselDataService.loadById(mselId);
    this.moveDataService.loadByMsel(mselId);
    this.teamDataService.loadByMsel(mselId);
    this.cardDataService.loadByMsel(mselId);
    this.dataFieldDataService.loadByMsel(mselId);
    this.dataOptionDataService.loadByMsel(mselId);
    this.dataValueDataService.loadByMsel(mselId);
    this.scenarioEventDataService.loadByMsel(mselId);
    this.userMselRoleDataService.loadByMsel(mselId);
    this.userDataService.loadByMsel(mselId).subscribe();
    this.automationTaskDataService.loadByMsel(mselId);
    this.automationRunDataService.loadByMsel(
      mselId,
      AutomationRunKind.Exercise,
    );
    this.executionDataService.load(mselId);
  }

  // the MSEL's broadcasts, its facilitation group's among them, reach this page once it is selected on the hub
  private selectHub() {
    if (this.connected && this.selectedMselId) {
      this.signalRService.selectMsel(this.selectedMselId);
    }
  }

  private updateRolePermissions() {
    if (!this.loggedInUserId || !this.selectedMselId) {
      this.canViewFacilitatorPage = false;
      this.canFacilitatePage = false;
      this.canChooseFacilitatorFields = false;
      return;
    }
    // A user can hold several roles on one MSEL, so all of them count.
    const roles = this.userMselRoleQuery
      .getAll()
      .filter(
        (r) =>
          r.userId === this.loggedInUserId && r.mselId === this.selectedMselId,
      );
    const msel = this.mselWithRoles(roles);
    this.canViewFacilitatorPage = canViewFacilitator(
      msel,
      this.loggedInUserId,
      this.canViewMsels,
    );
    this.canFacilitatePage = canFacilitate(
      msel,
      this.loggedInUserId,
      this.canEditMsels,
    );
    this.canChooseFacilitatorFields =
      this.canEditMsels ||
      this.msel?.createdBy === this.loggedInUserId ||
      roles.some(
        (r) => r.role === MselRole.Owner || r.role === MselRole.Editor,
      );
  }

  // The loaded MSEL carries only the roles the API sent with it; the role store has the rest.
  private mselWithRoles(roles: UserMselRole[]): Msel {
    return {
      ...this.msel,
      id: this.selectedMselId,
      userMselRoles: [...(this.msel?.userMselRoles ?? []), ...roles],
    };
  }

  goToUrl(url: string): void {
    if (url !== '/') {
      void this.router.navigate([url], { queryParamsHandling: 'merge' });
    }
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
