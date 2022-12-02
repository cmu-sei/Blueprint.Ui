// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license, please see LICENSE.md in the project root for license information or contact permission@sei.cmu.edu for full terms.
import { Component, Input, OnDestroy, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl } from '@angular/forms';
import { Subject, Observable, BehaviorSubject } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';
import {
  ComnSettingsService,
  Theme,
  ComnAuthQuery,
} from '@cmusei/crucible-common';
import { UserDataService } from 'src/app/data/user/user-data.service';
import { TopbarView } from './../shared/top-bar/topbar.models';
import {
  ItemStatus,
  Msel,
  ScenarioEvent
} from 'src/app/generated/blueprint.api';
import { MselDataService } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { MoveDataService } from 'src/app/data/move/move-data.service';
import { ScenarioEventDataService } from 'src/app/data/scenario-event/scenario-event-data.service';
import { ScenarioEventQuery } from 'src/app/data/scenario-event/scenario-event.query';

@Component({
  selector: 'app-msel',
  templateUrl: './msel.component.html',
  styleUrls: ['./msel.component.scss'],
})
export class MselComponent implements OnDestroy {
  @Input() loggedInUserId: string;
  @Input() isContentDeveloper: boolean;
  @Input() userTheme$: Observable<Theme>;
  private unsubscribe$ = new Subject();
  msel = this.mselQuery.selectActive()as Observable<Msel>;
  selectedTab = 1;
  tabSections = new Map([
    ['default', 1],
    ['roles', 2],
    ['datafields', 3],
    ['organizations', 4],
    ['moves', 5],
    ['cards', 6],
    ['injects', 7],
    ['exerciseview', 8]
  ]);

  constructor(
    activatedRoute: ActivatedRoute,
    private router: Router,
    private moveDataService: MoveDataService,
    private mselDataService: MselDataService,
    private mselQuery: MselQuery
  ) {
    // subscribe to route changes
    activatedRoute.queryParamMap.pipe(takeUntil(this.unsubscribe$)).subscribe(params => {
      // set the selected tab based on the section
      const section = params.get('section');
      if (this.tabSections.has(section)) {
        this.selectedTab = this.tabSections.get(section);
      } else {
        this.selectedTab = 1;
      }
      // load the selected MSEL data
      const mselId = params.get('msel');
      if (mselId) {
        // load the selected MSEL and make it active
        this.mselDataService.loadById(mselId);
        this.mselDataService.setActive(mselId);
        // load the Moves
        this.moveDataService.unload();
        this.moveDataService.loadByMsel(mselId);
      }
    });
  }

  tabChange(event) {
    const section = event.tab.textLabel.toLowerCase().replaceAll(' ', '');
    if (section === '<<back') {
      this.router.navigate([], {
        queryParams: { }
      });
    } else {
      this.router.navigate([], {
        queryParams: { section: section },
        queryParamsHandling: 'merge'
      });
    }
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
