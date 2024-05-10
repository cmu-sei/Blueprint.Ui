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
import { InvitationDataService } from 'src/app/data/invitation/invitation-data.service';
import { MoveDataService } from 'src/app/data/move/move-data.service';
import { MselDataService } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { MatLegacyTabGroup as MatTabGroup, MatLegacyTab as MatTab } from '@angular/material/legacy-tabs';
import { MselUnitDataService } from 'src/app/data/msel-unit/msel-unit-data.service';
import { OrganizationDataService } from 'src/app/data/organization/organization-data.service';
import { ScenarioEventDataService } from 'src/app/data/scenario-event/scenario-event-data.service';
import { TeamDataService } from 'src/app/data/team/team-data.service';
import { TeamUserDataService } from 'src/app/data/team-user/team-user-data.service';
import { UnitDataService } from 'src/app/data/unit/unit-data.service';
import { UIDataService } from 'src/app/data/ui/ui-data.service';
import { UserDataService } from 'src/app/data/user/user-data.service';
import { UserMselRoleDataService } from 'src/app/data/user-msel-role/user-msel-role-data.service';
import { UserTeamRoleDataService } from 'src/app/data/user-team-role/user-team-role-data.service';

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
    'Contributors',
    'Teams',
    'Data Fields',
    'Organizations',
    'Moves',
    'Player Apps',
    'Gallery Cards',
    'CITE Actions',
    'CITE Roles',
    'Scenario Events',
    'Exercise View',
    'MSEL Playbook',
    'Invitations'
  ];
  fontIconList = new Map<string, string>([
    ['Info', 'mdi-note-outline'],
    ['Contributors', 'mdi-account-edit'],
    ['Teams', 'mdi-account-multiple'],
    ['Data Fields', 'mdi-view-column-outline'],
    ['Organizations', 'mdi-office-building-outline'],
    ['Moves', 'mdi-gamepad'],
    ['Player Apps', 'mdi-apps'],
    ['Gallery Cards', 'mdi-view-grid-outline'],
    ['CITE Actions', 'mdi-clipboard-check-outline'],
    ['CITE Roles', 'mdi-clipboard-account-outline'],
    ['Scenario Events', 'mdi-chart-timeline'],
    ['Exercise View', 'mdi-eye-outline'],
    ['MSEL Playbook', 'mdi-book'],
    ['Invitations', 'mdi-email-open-outline']
  ]);
  private unsubscribe$ = new Subject();
  private msel: Msel = {};
  selectedTab = '';
  defaultTab = 'Info';
  selectedIndex = 1;
  selectedMselId = '';
  sideNavCollapsed = false;
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
    private invitationDataService: InvitationDataService,
    private moveDataService: MoveDataService,
    private mselDataService: MselDataService,
    private mselUnitDataService: MselUnitDataService,
    private mselQuery: MselQuery,
    private organizationDataService: OrganizationDataService,
    private scenarioEventDataService: ScenarioEventDataService,
    private teamDataService: TeamDataService,
    private teamUserDataService: TeamUserDataService,
    private unitDataService: UnitDataService,
    private uiDataService: UIDataService,
    private userDataService: UserDataService,
    private userMselRoleDataService: UserMselRoleDataService,
    private userTeamRoleDataService: UserTeamRoleDataService,
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
        // load msel units
        this.mselUnitDataService.loadByMsel(mselId);
        // load user team roles
        this.userTeamRoleDataService.loadByMsel(mselId);
        // load the MSEL organizations and templates
        this.invitationDataService.loadByMsel(mselId);
        // load the Msel TeamUsers
        this.teamUserDataService.loadByMsel(mselId);
      }
    });
    // subscribe to the active MSEL
    (this.mselQuery.selectActive() as Observable<Msel>).pipe(takeUntil(this.unsubscribe$)).subscribe(msel => {
      if (msel) {
        this.msel = msel;
      } else {
        this.msel = {};
      }
    });
    // load units
    this.unitDataService.load();
    // load the organization templates
    this.organizationDataService.loadTemplates();
    // load the users
    this.userDataService.getUsersFromApi();
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

  getTabListItems(): string[] {
    const tabList = [];
    this.tabList.forEach(tab => {
      switch (tab) {
        case 'Player Apps':
          if (this.msel?.usePlayer) {
            tabList.push(tab);
          }
          break;
        case 'Gallery Cards':
          if (this.msel?.useGallery) {
            tabList.push(tab);
          }
          break;
        case 'CITE Actions':
        case 'CITE Roles':
          if (this.msel?.useCite) {
            tabList.push(tab);
          }
          break;
        // case 'MSEL Playbook':
        //   if (this.msel?.usePlaybook) {
        //     tabList.push(tab);
        //   }
        //   break;
        default:
          tabList.push(tab);
          break;
      }
    });
    return tabList;
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
