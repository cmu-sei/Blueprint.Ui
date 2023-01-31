// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license, please see LICENSE.md in the project root for license information or contact permission@sei.cmu.edu for full terms.
import { Component, Input, OnDestroy, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Observable, BehaviorSubject } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';
import {
  Theme,
} from '@cmusei/crucible-common';
import {
  Msel
} from 'src/app/generated/blueprint.api';
import { MselDataService } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { MoveDataService } from 'src/app/data/move/move-data.service';
import { MatLegacyTabGroup as MatTabGroup } from '@angular/material/legacy-tabs';

@Component({
  selector: 'app-msel',
  templateUrl: './msel.component.html',
  styleUrls: ['./msel.component.scss'],
})
export class MselComponent implements OnDestroy {
  @Input() loggedInUserId: string;
  @Input() isContentDeveloper: boolean;
  @Input() userTheme$: Observable<Theme>;
  @ViewChild('tabGroup0', { static: false }) tabGroup0: MatTabGroup;
  private unsubscribe$ = new Subject();
  msel = this.mselQuery.selectActive()as Observable<Msel>;
  selectedTab = 'Info';
  selectedIndex = 1;

  constructor(
    activatedRoute: ActivatedRoute,
    private router: Router,
    private moveDataService: MoveDataService,
    private mselDataService: MselDataService,
    private mselQuery: MselQuery
  ) {
    // subscribe to route changes
    activatedRoute.queryParamMap.pipe(takeUntil(this.unsubscribe$)).subscribe(params => {
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
    if (event.index === 0) {
      this.router.navigate([], {
        queryParams: { }
      });
    } else {
      this.selectedTab = event.tab.textLabel;
      this.selectedIndex = event.index;
    }
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
