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
import { Msel, MselRole, UserMselRole } from 'src/app/generated/blueprint.api';
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
    private userMselRoleQuery: UserMselRoleQuery
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
    this.userDataService.setCurrentUser();
    this.currentUserQuery
      .select()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((cu) => {
        this.loggedInUserId = cu.id;
        this.isSystemAdmin = cu.permissions?.some(p =>
          p.key === 'SystemAdmin' || p.key === 'ContentDeveloper'
        ) || false;
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
      return;
    }

    // System admins have full access
    if (this.isSystemAdmin) {
      this.canViewAssessorPage = true;
      this.canEditAssessorPage = true;
      return;
    }

    // Find user's role for this MSEL
    const roles = this.userMselRoleQuery.getAll();
    this.userMselRole = roles.find(r =>
      r.userId === this.loggedInUserId && r.mselId === this.selectedMselId
    ) || null;

    if (!this.userMselRole) {
      this.canViewAssessorPage = false;
      this.canEditAssessorPage = false;
      return;
    }

    // Editor or higher can view assessor page
    const viewRoles = [MselRole.Owner, MselRole.Editor, MselRole.Approver, MselRole.Evaluator];
    this.canViewAssessorPage = viewRoles.includes(this.userMselRole.role);

    // Only Evaluator, Owner can edit (check/uncheck checkboxes)
    const editRoles = [MselRole.Owner, MselRole.Evaluator];
    this.canEditAssessorPage = editRoles.includes(this.userMselRole.role);
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
