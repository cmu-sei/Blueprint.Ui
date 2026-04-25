// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, OnDestroy, OnInit } from '@angular/core';
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
import { TopbarView } from '../shared/top-bar/topbar.models';

@Component({
  selector: 'app-assessor-page',
  templateUrl: './assessor-page.component.html',
  styleUrls: ['./assessor-page.component.scss'],
  standalone: false
})
export class AssessorPageComponent implements OnDestroy, OnInit {
  private unsubscribe$ = new Subject();
  private msel: Msel = {};
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
  isSystemAdmin = false;

  constructor(
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private dataFieldDataService: DataFieldDataService,
    private dataOptionDataService: DataOptionDataService,
    private dataValueDataService: DataValueDataService,
    private moveDataService: MoveDataService,
    private mselDataService: MselDataService,
    private mselQuery: MselQuery,
    private scenarioEventDataService: ScenarioEventDataService,
    private teamDataService: TeamDataService,
    private userDataService: UserDataService,
    private currentUserQuery: CurrentUserQuery,
    private authQuery: ComnAuthQuery,
    private settingsService: ComnSettingsService,
    private titleService: Title,
    private userMselRoleDataService: UserMselRoleDataService,
    private userMselRoleQuery: UserMselRoleQuery,
    private permissionDataService: PermissionDataService
  ) {
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
        }
      });

    (this.mselQuery.selectActive() as Observable<Msel>)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((msel) => {
        if (msel) {
          this.msel = msel;
          const prefix = this.appTitle + ' - ';
          this.topbarText = prefix + msel.name;
          this.titleService.setTitle(prefix + msel.name);
        } else {
          this.msel = {};
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
    console.log('[Assessor-Page] ngOnInit called');
    this.userDataService.setCurrentUser();
    this.currentUserQuery
      .select()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((cu) => {
        console.log('[Assessor-Page] Current user:', cu);
        this.loggedInUserId = cu.id;
        this.updateRolePermissions();
      });

    // Load permissions and check system admin
    this.permissionDataService.load()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(() => {
        this.isSystemAdmin = this.permissionDataService.hasPermission(SystemPermission.CreateMsels);
        console.log('[Assessor-Page] isSystemAdmin:', this.isSystemAdmin);
        this.updateRolePermissions();
      });

    // Watch for user MSEL role changes
    this.userMselRoleQuery.selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((roles) => {
        console.log('[Assessor-Page] User MSEL roles changed:', roles);
        this.updateRolePermissions();
      });
  }

  private updateRolePermissions() {
    if (!this.loggedInUserId || !this.selectedMselId) {
      console.log('[Assessor] No user or msel ID', { loggedInUserId: this.loggedInUserId, selectedMselId: this.selectedMselId });
      this.canViewAssessorPage = false;
      this.canEditAssessorPage = false;
      return;
    }

    // System admins have full access
    if (this.isSystemAdmin) {
      console.log('[Assessor] System admin detected - full access');
      this.canViewAssessorPage = true;
      this.canEditAssessorPage = true;
      return;
    }

    // Find user's role for this MSEL
    const roles = this.userMselRoleQuery.getAll();
    console.log('[Assessor] All roles:', roles);
    this.userMselRole = roles.find(r =>
      r.userId === this.loggedInUserId && r.mselId === this.selectedMselId
    ) || null;
    console.log('[Assessor] User MSEL role:', this.userMselRole);

    if (!this.userMselRole) {
      console.log('[Assessor] No role found for this MSEL');
      this.canViewAssessorPage = false;
      this.canEditAssessorPage = false;
      return;
    }

    // Editor or higher can view assessor page
    const viewRoles: MselRole[] = ['Owner', 'Editor', 'Approver', 'Evaluator'];
    this.canViewAssessorPage = viewRoles.includes(this.userMselRole.role as MselRole);

    // Only Evaluator, Owner can edit (check/uncheck checkboxes)
    const editRoles: MselRole[] = ['Owner', 'Evaluator'];
    this.canEditAssessorPage = editRoles.includes(this.userMselRole.role as MselRole);

    console.log('[Assessor] Permissions:', { canView: this.canViewAssessorPage, canEdit: this.canEditAssessorPage, role: this.userMselRole.role });
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
