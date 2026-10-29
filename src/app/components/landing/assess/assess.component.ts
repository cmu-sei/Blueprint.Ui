// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Subject, combineLatest, of } from 'rxjs';
import { catchError, filter, take, takeUntil } from 'rxjs/operators';
import { ComnSettingsService } from '@cmusei/crucible-common';
import { Msel, MselCompetencyService, SystemPermission } from 'src/app/generated/blueprint.api';
import { MselDataService } from 'src/app/data/msel/msel-data.service';
import { MselImageDataService } from 'src/app/data/msel/msel-image-data.service';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { UserDataService } from 'src/app/data/user/user-data.service';
import { CurrentUserQuery } from 'src/app/data/user/user.query';
import { UIDataService } from 'src/app/data/ui/ui-data.service';
import { ErrorService } from 'src/app/services/error/error.service';
import { TopbarView } from '../../shared/top-bar/topbar.models';
import { TopbarComponent } from '../../shared/top-bar/topbar.component';
import { OverflowTooltipDirective } from '../../shared/overflow-tooltip/overflow-tooltip.directive';
import { landingBackground } from 'src/app/utilities/landing-background';
import { cardImage } from 'src/app/utilities/card-image';
import { assessableMsels } from 'src/app/utilities/assessable-msels';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';

// The Assess list: the running events the user can assess, as cards like the
// Join page's. A card opens that event's assessor view.
@Component({
    selector: 'app-assess',
    templateUrl: './assess.component.html',
    styleUrls: ['../join/join.component.scss', './assess.component.scss'],
    imports: [TopbarComponent, MatButton, MatIcon, MatProgressSpinner, RouterLink, OverflowTooltipDirective]
})
export class AssessComponent implements OnDestroy, OnInit {
  private settingsService = inject(ComnSettingsService);
  private mselDataService = inject(MselDataService);
  private mselImageDataService = inject(MselImageDataService);
  private mselCompetencyService = inject(MselCompetencyService);
  private permissionDataService = inject(PermissionDataService);
  private userDataService = inject(UserDataService);
  private currentUserQuery = inject(CurrentUserQuery);
  private uiDataService = inject(UIDataService);
  private router = inject(Router);
  private errorService = inject(ErrorService);

  assessMselList: Msel[] = [];
  isLoading = true;
  loadFailed = false;
  // Competency count per MSEL id; absent until its answer arrives.
  competencyCounts: { [id: string]: number } = {};
  cardPhotos: { [id: string]: string } = {};
  hideTopbar = this.uiDataService.inIframe();
  topbarText = 'Assess Events';
  topbarImage = this.settingsService.settings.AppTopBarImage;
  readonly backgroundImage = landingBackground(this.settingsService.settings);
  TopbarView = TopbarView;
  readonly cardImage = cardImage;
  private unsubscribe$ = new Subject();

  ngOnInit() {
    this.userDataService.setCurrentUser();
    // The list needs both who the user is and whether they are a system admin,
    // so it waits for both rather than racing them.
    combineLatest([
      this.currentUserQuery.select().pipe(filter((cu) => !!cu?.id), take(1)),
      // permissions that fail to load count as none, as on the dashboard
      this.permissionDataService.load().pipe(catchError(() => of([]))),
      this.mselDataService.getMyBuildMsels(),
    ])
      .pipe(take(1), takeUntil(this.unsubscribe$))
      .subscribe({
        // a failed request ends the spinner and says so, rather than loading forever
        error: (err) => {
          this.isLoading = false;
          this.loadFailed = true;
          this.errorService.handleError(err);
        },
        next: ([cu, , msels]) => {
          const isSystemAdmin = this.permissionDataService.hasPermission(SystemPermission.CreateMsels);
          this.assessMselList = assessableMsels(msels, cu.id, isSystemAdmin);
          this.isLoading = false;
          this.assessMselList.forEach((msel) => {
            this.mselImageDataService
              .imageUrl(msel)
              .pipe(takeUntil(this.unsubscribe$))
              .subscribe((url) => {
                if (url) {
                  this.cardPhotos[msel.id] = url;
                }
              });
            this.mselCompetencyService
              .getMselCompetencies(msel.id)
              .pipe(
                take(1),
                // A failed count leaves the card usable; the assessor view reports its own errors.
                catchError(() => of(null)),
                takeUntil(this.unsubscribe$)
              )
              .subscribe((competencies) => {
                if (competencies) {
                  this.competencyCounts[msel.id] = competencies.length;
                }
              });
          });
        },
      });
  }

  topBarNavigate(url): void {
    this.router.navigate([url]);
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
