// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, Input, OnDestroy, ViewChild, ViewChildren, QueryList, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  Theme,
} from '@cmusei/crucible-common';
import {
  Msel
} from 'src/app/generated/blueprint.api';
import { CardDataService } from 'src/app/data/card/card-data.service';
import { CardTeamDataService } from 'src/app/data/team/card-team-data.service';
import { CiteActionDataService } from 'src/app/data/cite-action/cite-action-data.service';
import { CiteRoleDataService } from 'src/app/data/cite-role/cite-role-data.service';
import { DataFieldDataService } from 'src/app/data/data-field/data-field-data.service';
import { DataOptionDataService } from 'src/app/data/data-option/data-option-data.service';
import { DataValueDataService } from 'src/app/data/data-value/data-value-data.service';
import { MoveDataService } from 'src/app/data/move/move-data.service';
import { MselDataService } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { MatLegacyTabGroup as MatTabGroup, MatLegacyTab as MatTab } from '@angular/material/legacy-tabs';
import { MselTeamDataService } from 'src/app/data/msel-team/msel-team-data.service';
import { OrganizationDataService } from 'src/app/data/organization/organization-data.service';
import { ScenarioEventDataService } from 'src/app/data/scenario-event/scenario-event-data.service';
import { TeamDataService } from 'src/app/data/team/team-data.service';
import { UIDataService } from 'src/app/data/ui/ui-data.service';
import { UserDataService } from 'src/app/data/user/user-data.service';
import { UserMselRoleDataService } from 'src/app/data/user-msel-role/user-msel-role-data.service';

@Component({
  selector: 'app-msel',
  templateUrl: './msel.component.html',
  styleUrls: ['./msel.component.scss'],
})
export class MselComponent implements OnDestroy, AfterViewInit {
  @Input() loggedInUserId: string;
  @Input() isContentDeveloper: boolean;
  @Input() userTheme$: Observable<Theme>;
  @ViewChild('tabGroup0', { static: false }) tabGroup0: MatTabGroup;
  @ViewChildren('MatTab') tabs: QueryList<MatTab>;
  private tabList: MatTab[] = [];
  private unsubscribe$ = new Subject();
  msel = this.mselQuery.selectActive() as Observable<Msel>;
  selectedTab = 'Info';
  defaultTab = 'Info';
  selectedIndex = 1;
  selectedMselId = '';

  constructor(
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private cardDataService: CardDataService,
    private cardTeamDataService: CardTeamDataService,
    private citeActionDataService: CiteActionDataService,
    private citeRoleDataService: CiteRoleDataService,
    private dataFieldDataService: DataFieldDataService,
    private dataOptionDataService: DataOptionDataService,
    private dataValueDataService: DataValueDataService,
    private moveDataService: MoveDataService,
    private mselDataService: MselDataService,
    private mselTeamDataService: MselTeamDataService,
    private mselQuery: MselQuery,
    private organizationDataService: OrganizationDataService,
    private changeDetectorRef: ChangeDetectorRef,
    private scenarioEventDataService: ScenarioEventDataService,
    private teamDataService: TeamDataService,
    private uiDataService: UIDataService,
    private userDataService: UserDataService,
    private userMselRoleDataService: UserMselRoleDataService
  ) {
    // subscribe to route changes
    this.activatedRoute.queryParamMap.pipe(takeUntil(this.unsubscribe$)).subscribe(params => {
      // load the selected MSEL data
      const mselId = params.get('msel');
      if (mselId && this.selectedMselId !== mselId) {
        // load the selected MSEL and make it active
        this.mselDataService.loadById(mselId);
        this.mselDataService.setActive(mselId);
        // load the MSELs moves
        this.moveDataService.loadByMsel(mselId);
        // load the gallery cards and cardTeams
        this.cardDataService.loadByMsel(mselId);
        this.cardTeamDataService.getCardTeamsFromApi(mselId);
        // load CITE Actions and Roles
        this.citeActionDataService.loadByMsel(mselId);
        this.citeRoleDataService.loadByMsel(mselId);
        // load the MSEL Teams
        this.mselTeamDataService.loadByMsel(mselId);
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
      }
    });
    // load the users
    this.userDataService.getUsersFromApi();
    // load the teams
    this.teamDataService.load();
    // load the organization templates
    this.organizationDataService.loadTemplates();
    // set the selected tab
    const selectedTab = this.uiDataService.getMselTab();
    if (!selectedTab) {
      this.uiDataService.setMselTab(this.defaultTab);
    }
  }

  ngAfterViewInit() {
    // have to check for current state and then subscribe to future changes
    // tabGroup0._tabs doesn't exist until after view init, so we need the detectChanges()
    if (this.tabGroup0 && this.tabGroup0._tabs && this.tabGroup0._tabs.length > 0) {
      this.tabList = this.tabGroup0._tabs.toArray();
      this.setTabBySection();
      this.changeDetectorRef.detectChanges();
    }
    this.tabGroup0._tabs.changes.pipe(takeUntil(this.unsubscribe$)).subscribe(tabs => {
      const count = tabs ? tabs.length : 0;
      this.tabList = tabs.toArray();
      this.setTabBySection();
      this.changeDetectorRef.detectChanges();
    });
  }

  tabChange(event) {
    if (event.index === 0) {
      this.uiDataService.setMselTab(this.defaultTab);
      this.router.navigate([], {
        queryParams: { }
      });
    } else {
      this.uiDataService.setMselTab(event.tab.textLabel);
      this.setTabBySection();
    }
  }

  setTabBySection() {
    if (this.tabList) {
      const tabIndex = this.tabList.findIndex(t => t.textLabel === this.uiDataService.getMselTab());
      if (tabIndex > -1) {
        this.selectedTab = this.uiDataService.getMselTab();
        this.selectedIndex = tabIndex;
      } else {
        this.selectedTab = this.defaultTab;
        this.selectedIndex = 1;
      }
    } else {
      this.selectedTab = this.defaultTab;
      this.selectedIndex = 1;
    }
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
