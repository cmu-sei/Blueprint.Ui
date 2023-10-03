// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, EventEmitter, Input, OnDestroy, Output, ViewChild, ViewChildren, QueryList } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  Theme,
  ComnAuthQuery
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
import { UserMselRoleDataService } from 'src/app/data/user-msel-role/user-msel-role-data.service';

@Component({
  selector: 'app-msel',
  templateUrl: './msel.component.html',
  styleUrls: ['./msel.component.scss'],
})
export class MselComponent implements OnDestroy {
  @Input() loggedInUserId: string;
  @Input() isContentDeveloper: boolean;
  @Input() isSystemAdmin: boolean;
  @Input() userTheme$: Observable<Theme>;
  @Output() deleteThisMsel = new EventEmitter<string>();
  @ViewChild('tabGroup0', { static: false }) tabGroup0: MatTabGroup;
  @ViewChildren('MatTab') tabs: QueryList<MatTab>;
  tabList: string[] = [
    'Info',
    'Teams',
    'Data Fields',
    'Organizations',
    'Moves',
    'Gallery Cards',
    'Cite Actions',
    'Cite Roles',
    'Events',
    'Exercise View'
  ];
  private unsubscribe$ = new Subject();
  msel = this.mselQuery.selectActive() as Observable<Msel>;
  selectedTab = '';
  defaultTab = 'Info';
  selectedIndex = 1;
  selectedMselId = '';
  sideNavCollapsed = false;
  fontIconList = new Map<string, string>([
    ['Info', 'mdi-note-outline'],
    ['Teams', 'mdi-account-group-outline'],
    ['Data Fields', 'mdi-view-column-outline'],
    ['Organizations', 'mdi-office-building-outline'],
    ['Moves', 'mdi-gamepad'],
    ['Gallery Cards', 'mdi-view-grid-outline'],
    ['Cite Actions', 'mdi-clipboard-check-outline'],
    ['Cite Roles', 'mdi-clipboard-account-outline'],
    ['Events', 'mdi-chart-timeline'],
    ['Exercise View', 'mdi-eye-outline'],
  ]);
  theme$: Observable<Theme>;

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
    private scenarioEventDataService: ScenarioEventDataService,
    private teamDataService: TeamDataService,
    private uiDataService: UIDataService,
    private userMselRoleDataService: UserMselRoleDataService,
    private authQuery: ComnAuthQuery
  ) {
    this.theme$ = this.authQuery.userTheme$;
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
    // load the teams
    this.teamDataService.load();
    // load the organization templates
    this.organizationDataService.loadTemplates();
    // set the selected tab
    let selectedTab = this.uiDataService.getMselTab();
    if (!selectedTab) {
      this.uiDataService.setMselTab(this.defaultTab);
      selectedTab = this.defaultTab;
    }
    this.selectedTab = selectedTab;
    // set the side nav expansion
    this.sideNavCollapsed = this.uiDataService.isNavCollapsed();
  }

  tabChange(tabName: string) {
    if (tabName === 'Back') {
      this.uiDataService.setMselTab(this.defaultTab);
      this.router.navigate([], {
        queryParams: { }
      });
    } else {
      this.uiDataService.setMselTab(tabName);
      this.selectedTab = tabName;
    }
  }

  getListItemClass(tab: string) {
    if (tab === this.selectedTab) {
      return 'list-item background-alt';
    } else {
      return 'list-item background';
    }
  }

  getSidebarClass() {
    return this.sideNavCollapsed ? 'left-content-closed background' : 'left-content-open background';
  }

  setCollapsed(value: boolean) {
    this.sideNavCollapsed = value;
    this.uiDataService.setNavCollapsed(value);
  }

  goToUrl(url): void {
    this.router.navigate([url], {
      queryParamsHandling: 'merge',
    });
  }

  deleteMsel(id: string) {
    this.deleteThisMsel.emit(id);
    this.router.navigate(['/']);
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
