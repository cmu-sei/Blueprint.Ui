// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, EventEmitter, OnDestroy, Output, ViewChild, ViewChildren, QueryList, inject, input } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { MselInfoComponent } from '../msel-info/msel-info.component';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  Theme,
  ComnAuthQuery
} from '@cmusei/crucible-common';
import { CatalogUnit, Msel } from 'src/app/generated/blueprint.api';
import { CardDataService } from 'src/app/data/card/card-data.service';
import { CardTeamDataService } from 'src/app/data/team/card-team-data.service';
import { CatalogDataService } from 'src/app/data/catalog/catalog-data.service';
import { CatalogUnitDataService } from 'src/app/data/catalog-unit/catalog-unit-data.service';
import { CiteActionDataService } from 'src/app/data/cite-action/cite-action-data.service';
import { CiteDutyDataService } from 'src/app/data/cite-duty/cite-duty-data.service';
import { DataFieldDataService } from 'src/app/data/data-field/data-field-data.service';
import { DataOptionDataService } from 'src/app/data/data-option/data-option-data.service';
import { DataValueDataService } from 'src/app/data/data-value/data-value-data.service';
import { InvitationDataService } from 'src/app/data/invitation/invitation-data.service';
import { MoveDataService } from 'src/app/data/move/move-data.service';
import { MselDataService } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { MatTabGroup, MatTab } from '@angular/material/tabs';
import { MselUnitDataService } from 'src/app/data/msel-unit/msel-unit-data.service';
import { MselUnitQuery } from 'src/app/data/msel-unit/msel-unit.query';
import { OrganizationDataService } from 'src/app/data/organization/organization-data.service';
import { ScenarioEventDataService } from 'src/app/data/scenario-event/scenario-event-data.service';
import { TeamDataService } from 'src/app/data/team/team-data.service';
import { TeamUserDataService } from 'src/app/data/team-user/team-user-data.service';
import { UnitDataService } from 'src/app/data/unit/unit-data.service';
import { UIDataService } from 'src/app/data/ui/ui-data.service';
import { UserDataService } from 'src/app/data/user/user-data.service';
import { UserMselRoleDataService } from 'src/app/data/user-msel-role/user-msel-role-data.service';
import { UserTeamRoleDataService } from 'src/app/data/user-team-role/user-team-role-data.service';
import { XApiService } from 'src/app/services/xapi/xapi.service';
import { MatDrawerContainer, MatDrawer, MatDrawerContent } from '@angular/material/sidenav';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatList, MatDivider, MatListItem } from '@angular/material/list';
import { NgClass, AsyncPipe } from '@angular/common';
import { MselContributorsComponent } from '../msel-contributors/msel-contributors.component';
import { MselTeamsComponent } from '../msel-teams/msel-teams.component';
import { DataFieldListComponent } from '../data-field-list/data-field-list.component';
import { OrganizationListComponent } from '../organization-list/organization-list.component';
import { MoveListComponent } from '../move-list/move-list.component';
import { PlayerApplicationListComponent } from '../player-application-list/player-application-list.component';
import { CardListComponent } from '../card-list/card-list.component';
import { CiteActionListComponent } from '../cite-action-list/cite-action-list.component';
import { CiteDutyListComponent } from '../cite-duty-list/cite-duty-list.component';
import { MselCompetenciesComponent } from '../msel-competencies/msel-competencies.component';
import { ScenarioEventListComponent } from '../scenario-event-list/scenario-event-list.component';
import { MselViewComponent } from '../msel-view/msel-view.component';
import { AssessorViewComponent } from '../assessor-view/assessor-view.component';
import { InvitationListComponent } from '../invitation-list/invitation-list.component';
import { MselPlaybookComponent } from '../msel-playbook/msel-playbook.component';

@Component({
    selector: 'app-msel',
    templateUrl: './msel.component.html',
    styleUrls: ['./msel.component.scss'],
    imports: [MatDrawerContainer, MatDrawer, MatIconButton, MatIcon, MatList, MatDivider, MatListItem, NgClass, MatDrawerContent, MselInfoComponent, MselContributorsComponent, MselTeamsComponent, DataFieldListComponent, OrganizationListComponent, MoveListComponent, PlayerApplicationListComponent, CardListComponent, CiteActionListComponent, CiteDutyListComponent, MselCompetenciesComponent, ScenarioEventListComponent, MselViewComponent, AssessorViewComponent, InvitationListComponent, MselPlaybookComponent, AsyncPipe]
})
export class MselComponent implements OnDestroy {
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
  private cardDataService = inject(CardDataService);
  private cardTeamDataService = inject(CardTeamDataService);
  private catalogDataService = inject(CatalogDataService);
  private catalogUnitDataService = inject(CatalogUnitDataService);
  private citeActionDataService = inject(CiteActionDataService);
  private citeDutyDataService = inject(CiteDutyDataService);
  private dataFieldDataService = inject(DataFieldDataService);
  private dataOptionDataService = inject(DataOptionDataService);
  private dataValueDataService = inject(DataValueDataService);
  private invitationDataService = inject(InvitationDataService);
  private moveDataService = inject(MoveDataService);
  private mselDataService = inject(MselDataService);
  private mselUnitDataService = inject(MselUnitDataService);
  private mselQuery = inject(MselQuery);
  private mselUnitQuery = inject(MselUnitQuery);
  private organizationDataService = inject(OrganizationDataService);
  private scenarioEventDataService = inject(ScenarioEventDataService);
  private teamDataService = inject(TeamDataService);
  private teamUserDataService = inject(TeamUserDataService);
  private unitDataService = inject(UnitDataService);
  private uiDataService = inject(UIDataService);
  private userDataService = inject(UserDataService);
  private userMselRoleDataService = inject(UserMselRoleDataService);
  private userTeamRoleDataService = inject(UserTeamRoleDataService);
  private authQuery = inject(ComnAuthQuery);
  private dialogService = inject(CrucibleDialogService);
  private xApiService = inject(XApiService);

  readonly loggedInUserId = input<string>(undefined);
  readonly canEditMsel = input<boolean>(undefined);
  readonly canAccessAdminSection = input<boolean>(undefined);
  readonly canEditCheckboxes = input(false);
  readonly userTheme$ = input<Observable<Theme>>(undefined);
  @Output() deleteThisMsel = new EventEmitter<string>();
  @ViewChild('tabGroup0', { static: false }) tabGroup0: MatTabGroup;
  @ViewChildren('MatTab') tabs: QueryList<MatTab>;
  @ViewChild(MselInfoComponent) mselInfoComponent: MselInfoComponent;
  tabList: string[] = [
    'Info',
    'Contributors',
    'Competencies',
    'Data Fields',
    'Teams',
    'Organizations',
    'Moves',
    'Player Apps',
    'Gallery Cards',
    'CITE Actions',
    'CITE Duties',
    'Scenario Events',
    'Exercise View',
    'Assessor View',
    'MSEL Playbook',
    'Invitations',
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
    ['CITE Duties', 'mdi-clipboard-account-outline'],
    ['Competencies', 'mdi-certificate-outline'],
    ['Scenario Events', 'mdi-chart-timeline'],
    ['Exercise View', 'mdi-eye-outline'],
    ['Assessor View', 'mdi-clipboard-check-multiple-outline'],
    ['MSEL Playbook', 'mdi-book'],
    ['Invitations', 'mdi-email-open-outline'],
  ]);
  private unsubscribe$ = new Subject();
  private msel: Msel = { name: '' };
  selectedTab = '';
  defaultTab = 'Info';
  selectedIndex = 1;
  selectedMselId = '';
  sideNavCollapsed = false;
  theme$: Observable<Theme>;

  constructor() {
    this.theme$ = this.authQuery.userTheme$;
    // subscribe to route changes
    this.activatedRoute.queryParamMap
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((params) => {
        // load the selected MSEL data
        const mselId = params.get('msel');
        if (mselId && this.selectedMselId !== mselId) {
          // Log xAPI viewed statement
          this.xApiService.viewedMsel(mselId).subscribe();
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
          this.citeDutyDataService.loadByMsel(mselId);
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
          // load the Catalogs
          this.catalogDataService.loadMine();
          // load the users
          this.userDataService.loadByMsel(mselId).subscribe();
        }
      });
    // subscribe to the active MSEL
    (this.mselQuery.selectActive() as Observable<Msel>)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((msel) => {
        if (msel) {
          this.msel = msel;
        } else {
          this.msel = { name: '' };
        }
      });
    // subscribe to mselUnits to reload users when contributors change
    this.mselUnitQuery.selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((mselUnits) => {
        const mselId = this.activatedRoute.snapshot.queryParamMap.get('msel');
        if (mselId && mselUnits !== null) {
          // Reload users whenever contributor units change
          this.userDataService.loadByMsel(mselId).subscribe();
        }
      });
    // load units
    this.unitDataService.load();
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
    const doTabChange = () => {
      if (tabName === 'Back') {
        this.uiDataService.setMselTab(this.defaultTab);
        this.router.navigate([], {
          queryParams: {},
        });
      } else {
        this.uiDataService.setMselTab(tabName);
        this.selectedTab = tabName;
      }
    };

    if (this.selectedTab === 'Info' && tabName !== 'Info' && this.mselInfoComponent?.hasPendingChanges()) {
      this.dialogService
        .confirm({ title: 'Unsaved Changes', message: 'You have unsaved changes on the MSEL Info page. Are you sure you want to discard them?' }).afterClosed().subscribe((result) => {
          if (result) {
            doTabChange();
          }
        });
    } else {
      doTabChange();
    }
  }

  navigateBack() {
    const doNavigate = () => {
      this.uiDataService.setMselTab(this.defaultTab);
      this.router.navigate([], {
        queryParams: {},
      });
    };

    if (this.selectedTab === 'Info' && this.mselInfoComponent?.hasPendingChanges()) {
      this.dialogService
        .confirm({ title: 'Unsaved Changes', message: 'You have unsaved changes on the MSEL Info page. Are you sure you want to discard them?' }).afterClosed().subscribe((result) => {
          if (result) {
            doNavigate();
          }
        });
    } else {
      doNavigate();
    }
  }

  getTabListItems(): string[] {
    const tabList = [];
    this.tabList.forEach((tab) => {
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
        case 'CITE Duties':
          if (this.msel?.useCite) {
            tabList.push(tab);
          }
          break;
        default:
          tabList.push(tab);
          break;
      }
    });
    return tabList;
  }

  getListItemClass(tab: string) {
    if (tab === this.selectedTab) {
      return 'selected-item';
    } else {
      return 'non-selected-item';
    }
  }

  setCollapsed(value: boolean) {
    this.sideNavCollapsed = value;
    this.uiDataService.setNavCollapsed(value);
  }

  goToUrl(url): void {
    if (url === '/admin') {
      this.router.navigate([url], {
        queryParams: { returnUrl: this.router.url },
      });
    } else {
      this.router.navigate([url], {
        queryParamsHandling: 'merge',
      });
    }
  }

  deleteMsel(id: string) {
    this.deleteThisMsel.emit(id);
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
