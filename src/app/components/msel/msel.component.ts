// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license, please see LICENSE.md in the project root for license information or contact permission@sei.cmu.edu for full terms.
import { Component, Input, OnDestroy, ViewChild } from '@angular/core';
import { MatSidenav } from '@angular/material/sidenav';
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
  private unsubscribe$ = new Subject();
  msel = this.mselQuery.selectActive()as Observable<Msel>;
  selectedTab = new FormControl(1);

  constructor(
    activatedRoute: ActivatedRoute,
    private router: Router,
    private moveDataService: MoveDataService,
    private mselDataService: MselDataService,
    private mselQuery: MselQuery
  ) {
    // subscribe to route changes
    activatedRoute.queryParamMap.pipe(takeUntil(this.unsubscribe$)).subscribe(params => {
      const section = params.get('section')
      switch (section) {
        case 'fields':
          this.selectedTab.setValue(2);
          break;
        case 'orgs':
          this.selectedTab.setValue(3);
          break;
        case 'moves':
          this.selectedTab.setValue(4);
          break;
        case 'injects':
          this.selectedTab.setValue(5);
          break;
        case 'view':
          this.selectedTab.setValue(6);
          break;
        default:
          this.selectedTab.setValue(1);
          break;
      }
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
    switch (event) {
      case 0:
        this.router.navigate([], {
          queryParams: { }
        });
        break;
      case 1:
        this.router.navigate([], {
          queryParams: { section: 'info' },
          queryParamsHandling: 'merge'
        });
        break;
      case 2:
        this.router.navigate([], {
          queryParams: { section: 'fields' },
          queryParamsHandling: 'merge'
        });
        break;
      case 3:
        this.router.navigate([], {
          queryParams: { section: 'orgs' },
          queryParamsHandling: 'merge'
        });
        break;
      case 4:
        this.router.navigate([], {
          queryParams: { section: 'moves' },
          queryParamsHandling: 'merge'
        });
        break;
      case 5:
        this.router.navigate([], {
          queryParams: { section: 'injects' },
          queryParamsHandling: 'merge'
        });
        break;
      case 6:
        this.router.navigate([], {
          queryParams: { section: 'view' },
          queryParamsHandling: 'merge'
        });
        break;
      default:
        break;
    }
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
