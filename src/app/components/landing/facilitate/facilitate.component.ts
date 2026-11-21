// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import {
  ComnSettingsService,
  CrucibleLandingBackgroundDirective,
} from '@cmusei/crucible-common';
import { Subject, combineLatest, of } from 'rxjs';
import { catchError, filter, take, takeUntil } from 'rxjs/operators';
import {
  AutomationRunKind,
  AutomationService,
  AutomationStatus,
  Msel,
  SystemPermission,
} from 'src/app/generated/blueprint.api';
import { MselImageDataService } from 'src/app/data/msel/msel-image-data.service';
import { MselDataService } from 'src/app/data/msel/msel-data.service';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { UIDataService } from 'src/app/data/ui/ui-data.service';
import { UserDataService } from 'src/app/data/user/user-data.service';
import { CurrentUserQuery } from 'src/app/data/user/user.query';
import { ErrorService } from 'src/app/services/error/error.service';
import { cardImage } from 'src/app/utilities/card-image';
import { facilitatableMsels } from 'src/app/utilities/facilitator-msels';
import { DeploymentRuns } from 'src/app/utilities/facilitation';
import { OverflowTooltipDirective } from '../../shared/overflow-tooltip/overflow-tooltip.directive';
import { TopbarComponent } from '../../shared/top-bar/topbar.component';
import { TopbarView } from '../../shared/top-bar/topbar.models';

/** How a deployment's tasks stand: how many of their newest runs failed or are running. */
interface RunCounts {
  failed: number;
  running: number;
}

// The Facilitate list: the running exercises whose Facilitator View the user can open, as cards like the Assess
// list's. A card opens that exercise's Facilitator View.
@Component({
  selector: 'app-facilitate',
  templateUrl: './facilitate.component.html',
  styleUrls: ['../join/join.component.scss', './facilitate.component.scss'],
  imports: [
    CrucibleLandingBackgroundDirective,
    TopbarComponent,
    MatButton,
    MatIcon,
    MatProgressSpinner,
    RouterLink,
    OverflowTooltipDirective,
  ],
})
export class FacilitateComponent implements OnDestroy, OnInit {
  private settingsService = inject(ComnSettingsService);
  private mselDataService = inject(MselDataService);
  private mselImageDataService = inject(MselImageDataService);
  private automationService = inject(AutomationService);
  private permissionDataService = inject(PermissionDataService);
  private userDataService = inject(UserDataService);
  private currentUserQuery = inject(CurrentUserQuery);
  private uiDataService = inject(UIDataService);
  private router = inject(Router);
  private errorService = inject(ErrorService);

  facilitateMselList: Msel[] = [];
  isLoading = true;
  loadFailed = false;
  // absent until a MSEL's runs arrive
  runCounts: Record<string, RunCounts> = {};
  cardPhotos: Record<string, string> = {};
  hideTopbar = this.uiDataService.inIframe();
  topbarText = 'Facilitate Exercises';
  topbarImage = (this.settingsService.settings as { AppTopBarImage?: string })
    .AppTopBarImage;
  TopbarView = TopbarView;
  readonly cardImage = cardImage;
  private unsubscribe$ = new Subject();

  ngOnInit() {
    this.userDataService.setCurrentUser();
    combineLatest([
      this.currentUserQuery.select().pipe(
        filter((cu) => !!cu?.id),
        take(1),
      ),
      // permissions that fail to load count as none, as on the dashboard
      this.permissionDataService.load().pipe(catchError(() => of([]))),
      this.mselDataService.getMyBuildMsels(),
    ])
      .pipe(take(1), takeUntil(this.unsubscribe$))
      .subscribe({
        error: (err) => {
          this.isLoading = false;
          this.loadFailed = true;
          this.errorService.handleError(err);
        },
        next: ([cu, , msels]) => {
          this.facilitateMselList = facilitatableMsels(
            msels,
            cu.id,
            this.permissionDataService.hasPermission(
              SystemPermission.ViewMsels,
            ),
          );
          this.isLoading = false;
          this.facilitateMselList.forEach((msel) => {
            this.mselImageDataService
              .imageUrl(msel)
              .pipe(takeUntil(this.unsubscribe$))
              .subscribe((url) => {
                if (url) this.cardPhotos[msel.id] = url;
              });
            this.loadRunCounts(msel);
          });
        },
      });
  }

  private loadRunCounts(msel: Msel) {
    this.automationService
      .getAutomationRunsByMsel(msel.id, AutomationRunKind.Exercise)
      .pipe(
        take(1),
        // a failed count leaves the card usable; the Facilitator View reports its own errors
        catchError(() => of(null)),
        takeUntil(this.unsubscribe$),
      )
      .subscribe((runs) => {
        if (!runs) return;
        const deployment = new DeploymentRuns(runs, msel.deploymentId);
        const latest = [...deployment.byTask.values()].map((r) => r[0].status);
        this.runCounts[msel.id] = {
          failed: latest.filter((s) =>
            (
              [
                AutomationStatus.Failed,
                AutomationStatus.Expired,
                AutomationStatus.Error,
              ] as AutomationStatus[]
            ).includes(s),
          ).length,
          running: latest.filter((s) =>
            (
              [
                AutomationStatus.Running,
                AutomationStatus.Queued,
              ] as AutomationStatus[]
            ).includes(s),
          ).length,
        };
      });
  }

  position(msel: Msel): string {
    return msel.currentMoveNumber == null
      ? 'Not started'
      : `Move ${msel.currentMoveNumber} · Group ${msel.currentGroupNumber ?? 0}`;
  }

  topBarNavigate(url: string): void {
    void this.router.navigate([url]);
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
