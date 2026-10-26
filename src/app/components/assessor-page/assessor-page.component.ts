// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  ComnSettingsService,
  ComnAuthQuery,
} from '@cmusei/crucible-common';
import { Msel, MselRole, UserMselRole, SystemPermission } from 'src/app/generated/blueprint.api';
import { DataFieldDataService } from 'src/app/data/data-field/data-field-data.service';
import { DataOptionDataService } from 'src/app/data/data-option/data-option-data.service';
import { DataValueDataService } from 'src/app/data/data-value/data-value-data.service';
import { MoveDataService } from 'src/app/data/move/move-data.service';
import { MselDataService } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { ScenarioEventDataService } from 'src/app/data/scenario-event/scenario-event-data.service';
import { TeamDataService } from 'src/app/data/team/team-data.service';
import { UserDataService } from 'src/app/data/user/user-data.service';
import { CurrentUserQuery } from 'src/app/data/user/user.query';
import { UserMselRoleDataService } from 'src/app/data/user-msel-role/user-msel-role-data.service';
import { UserMselRoleQuery } from 'src/app/data/user-msel-role/user-msel-role.query';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { ASSESS_ROLES } from 'src/app/utilities/assessable-msels';
import { TopbarView } from '../shared/top-bar/topbar.models';
import { TopbarComponent } from '../shared/top-bar/topbar.component';
import { MatIcon } from '@angular/material/icon';
import { AssessorViewComponent } from '../assessor-view/assessor-view.component';
import { AssessComponent } from '../landing/assess/assess.component';
import { AsyncPipe } from '@angular/common';

@Component({
    selector: 'app-assessor-page',
    templateUrl: './assessor-page.component.html',
    styleUrls: ['./assessor-page.component.scss'],
    imports: [TopbarComponent, MatIcon, AssessorViewComponent, AssessComponent, AsyncPipe]
})
export class AssessorPageComponent implements OnDestroy, OnInit {
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
  private dataFieldDataService = inject(DataFieldDataService);
  private dataOptionDataService = inject(DataOptionDataService);
  private dataValueDataService = inject(DataValueDataService);
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

  private unsubscribe$ = new Subject();
  private msel: Msel = { name: '' };
  selectedMselId = '';
  loggedInUserId: string;
  userTheme$ = this.authQuery.userTheme$;
  topbarColor = '#ef3a47';
  topbarTextColor = '#FFFFFF';
  topbarImage = this.settingsService.settings.AppTopBarImage;
  TopbarView = TopbarView;
  topbarTextBase = 'Set AppTopBarText in Settings';
  topbarText = 'blank';
  appTitle = '';
  userMselRole: UserMselRole | null = null;
  canEditAssessorPage = false;
  canViewAssessorPage = false;
  // Whether the user may change which data fields the assessor view shows.
  canChooseAssessorFields = false;
  isSystemAdmin = false;
  private canEditMsels = false;

  constructor() {
    this.activatedRoute.queryParamMap
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((params) => {
        this.topbarText = this.topbarTextBase;
        const mselId = params.get('msel');
        if (mselId && this.selectedMselId !== mselId) {
          this.mselDataService.loadById(mselId);
          this.mselDataService.setActive(mselId);
          this.moveDataService.loadByMsel(mselId);
          this.teamDataService.loadByMsel(mselId);
          this.dataFieldDataService.loadByMsel(mselId);
          this.dataOptionDataService.loadByMsel(mselId);
          this.dataValueDataService.loadByMsel(mselId);
          this.scenarioEventDataService.loadByMsel(mselId);
          this.userMselRoleDataService.loadByMsel(mselId);
          this.selectedMselId = mselId;
        } else if (!mselId) {
          // Back to the list of events to assess.
          this.selectedMselId = '';
          this.updateRolePermissions();
        }
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

    this.appTitle =
      this.settingsService.settings.AppTitle || 'Set AppTitle in Settings';
    this.titleService.setTitle(this.appTitle);
    this.topbarTextBase =
      this.settingsService.settings.AppTopBarText || this.topbarTextBase;
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

    // Load permissions and check system admin
    this.permissionDataService.load()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(() => {
        this.isSystemAdmin = this.permissionDataService.hasPermission(SystemPermission.CreateMsels);
        this.canEditMsels = this.permissionDataService.hasPermission(SystemPermission.EditMsels);
        this.updateRolePermissions();
      });

    // Watch for user MSEL role changes
    this.userMselRoleQuery.selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((roles) => {
        this.updateRolePermissions();
      });
  }

  private updateRolePermissions() {
    if (!this.loggedInUserId || !this.selectedMselId) {
      this.canViewAssessorPage = false;
      this.canEditAssessorPage = false;
      this.canChooseAssessorFields = false;
      return;
    }

    // Find the user's roles for this MSEL. A user can hold several, so all of
    // them count, not only the first.
    const roles = this.userMselRoleQuery.getAll().filter(r =>
      r.userId === this.loggedInUserId && r.mselId === this.selectedMselId
    );
    this.userMselRole = roles[0] || null;
    this.canChooseAssessorFields = this.canChooseFields(roles);
    // The MSEL's creator is its Owner. The roles endpoint lists only stored role rows, while the
    // MSEL endpoints, and so the Assess list, add the creator's Owner role, so add it here too.
    const roleNames = roles.map(r => r.role as MselRole);
    if (this.msel?.createdBy === this.loggedInUserId) {
      roleNames.push(MselRole.Owner);
    }

    // System admins can view and assess any MSEL
    if (this.isSystemAdmin) {
      this.canViewAssessorPage = true;
      this.canEditAssessorPage = true;
      return;
    }

    // Editor or higher can view assessor page
    const viewRoles: MselRole[] = ['Owner', 'Editor', 'Approver', 'Evaluator'];
    this.canViewAssessorPage = roleNames.some(r => viewRoles.includes(r));

    // Only the roles that can assess can edit (check/uncheck checkboxes)
    this.canEditAssessorPage = roleNames.some(r => ASSESS_ROLES.includes(r));
  }

  // The API's rule for changing a MSEL's data fields: EditMsels, the MSEL's
  // creator, or an Owner or Editor on it. CreateMsels alone is not enough.
  // The API also wants an Owner or Editor to be in one of the MSEL's units,
  // which this page cannot see; those roles are given to unit members.
  private canChooseFields(roles: UserMselRole[]): boolean {
    return this.canEditMsels ||
      (!!this.loggedInUserId && this.msel?.createdBy === this.loggedInUserId) ||
      roles.some(r => r.role === MselRole.Owner || r.role === MselRole.Editor);
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
