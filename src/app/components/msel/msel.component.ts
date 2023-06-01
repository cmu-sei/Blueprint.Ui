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
import { MoveDataService } from 'src/app/data/move/move-data.service';
import { MselDataService } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { MatLegacyTabGroup as MatTabGroup, MatLegacyTab as MatTab } from '@angular/material/legacy-tabs';
import { TeamDataService } from 'src/app/data/team/team-data.service';
import { UserDataService } from 'src/app/data/user/user-data.service';

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
  section = 'Info';
  selectedTab = 'Info';
  selectedIndex = 1;

  constructor(
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private cardDataService: CardDataService,
    private moveDataService: MoveDataService,
    private mselDataService: MselDataService,
    private mselQuery: MselQuery,
    private changeDetectorRef: ChangeDetectorRef,
    private teamDataService: TeamDataService,
    private userDataService: UserDataService
  ) {
    // subscribe to route changes
    this.activatedRoute.queryParamMap.pipe(takeUntil(this.unsubscribe$)).subscribe(params => {
      // load the selected MSEL data
      const mselId = params.get('msel');
      if (mselId) {
        // load the selected MSEL and make it active
        this.mselDataService.loadById(mselId);
        this.mselDataService.setActive(mselId);
        // load the MSELs moves
        this.moveDataService.loadByMsel(mselId);
        // load the gallery cards
        this.cardDataService.loadByMsel(mselId);
      }
      this.section = params.get('section');
      this.setTabBySection();
    });
    // load the users
    this.userDataService.getUsersFromApi();
    // load the teams
    this.teamDataService.load();
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
      this.router.navigate([], {
        queryParams: { }
      });
    } else {
      this.router.navigate([], {
        queryParams: { section: event.tab.textLabel },
        queryParamsHandling: 'merge',
      });
    }
  }

  setTabBySection() {
    if (this.section && this.tabList) {
      const tabIndex = this.tabList.findIndex(t => t.textLabel === this.section);
      if (tabIndex > -1) {
        this.selectedTab = this.section;
        this.selectedIndex = tabIndex;
      } else {
        this.selectedTab = 'Info';
        this.selectedIndex = 1;
      }
    } else {
      this.selectedTab = 'Info';
      this.selectedIndex = 1;
    }
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
