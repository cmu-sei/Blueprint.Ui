// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ComnAuthQuery, ComnAuthService, Theme } from '@cmusei/crucible-common';
import { CurrentUserState } from 'src/app/data/user/user.store';
import { Observable, Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { CurrentUserQuery } from 'src/app/data/user/user.query';
import { TopbarView } from './topbar.models';
import { UIDataService } from 'src/app/data/ui/ui-data.service';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { MatToolbar, MatToolbarRow } from '@angular/material/toolbar';
import { MatIconButton, MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatMenuTrigger, MatMenu, MatMenuItem } from '@angular/material/menu';
import { PresenceBarComponent } from '../presence-bar/presence-bar.component';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { AsyncPipe } from '@angular/common';

@Component({
    selector: 'app-topbar',
    templateUrl: './topbar.component.html',
    styleUrls: ['./topbar.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatToolbar, MatToolbarRow, MatIconButton, RouterLink, MatIcon, MatButton, MatMenuTrigger, MatMenu, MatMenuItem, PresenceBarComponent, MatSlideToggle, AsyncPipe]
})
export class TopbarComponent implements OnInit, OnDestroy {
  private authService = inject(ComnAuthService);
  private currentUserQuery = inject(CurrentUserQuery);
  private authQuery = inject(ComnAuthQuery);
  private uiDataService = inject(UIDataService);
  private permissionDataService = inject(PermissionDataService);
  private router = inject(Router);

  readonly title = input<string>(undefined);
  @Input() sidenav?;
  @Input() teams?;
  @Input() team?;
  @Input() topbarColor?;
  @Input() topbarTextColor?;
  readonly topbarView = input<TopbarView>(undefined);
  readonly imageFilePath = input<string>(undefined);
  @Output() sidenavToggle?: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() setTeam?: EventEmitter<string> = new EventEmitter<string>();
  @Output() editView?: EventEmitter<any> = new EventEmitter<any>();
  @Output() urlNavigate?: EventEmitter<string> = new EventEmitter<string>();
  currentUser$: Observable<CurrentUserState>;
  theme$: Observable<Theme>;
  unsubscribe$: Subject<null> = new Subject<null>();
  TopbarView = TopbarView;
  canViewAdmin = false;

  get currentUrl(): string {
    return this.router.url;
  }

  ngOnInit() {
    this.permissionDataService
      .load()
      .subscribe(
        () =>
          (this.canViewAdmin =
            this.permissionDataService.canViewAdministration())
      );

    this.currentUser$ = this.currentUserQuery.select().pipe(
      filter((user) => user !== null),
      takeUntil(this.unsubscribe$)
    );
    this.theme$ = this.authQuery.userTheme$;
    this.authService.setUserTheme(<Theme>this.uiDataService.getTheme() || Theme.LIGHT);
  }

  setTeamFn(id: string) {
    if (this.setTeam && id) {
      this.setTeam.emit(id);
    }
  }

  themeFn(event) {
    const theme = event.checked ? Theme.DARK : Theme.LIGHT;
    this.authService.setUserTheme(theme);
    this.uiDataService.setTheme(theme);
  }
  editFn(event) {
    this.editView.emit(event);
  }

  sidenavToggleFn() {
    this.sidenavToggle.emit(!this.sidenav.opened);
  }

  logout(): void {
    this.authService.logout();
  }

  goToUrl(url): void {
    this.urlNavigate.emit(url);
  }

  ngOnDestroy(): void {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
