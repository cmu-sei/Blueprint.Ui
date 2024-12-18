// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { Router } from '@angular/router';
import { ComnAuthQuery, ComnAuthService, Theme } from '@cmusei/crucible-common';
import { User as AuthUser } from 'oidc-client';
import { Observable, Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { UserDataService } from 'src/app/data/user/user-data.service';
import { TopbarView } from './topbar.models';
import { UIDataService } from 'src/app/data/ui/ui-data.service';

@Component({
  selector: 'app-topbar',
  templateUrl: './topbar.component.html',
  styleUrls: ['./topbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopbarComponent implements OnInit, OnDestroy {
  @Input() title?: string;
  @Input() sidenav?;
  @Input() teams?;
  @Input() team?;
  @Input() topbarColor?;
  @Input() topbarTextColor?;
  @Input() topbarView?: TopbarView;
  @Input() imageFilePath: string;
  @Output() sidenavToggle?: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() setTeam?: EventEmitter<string> = new EventEmitter<string>();
  @Output() editView?: EventEmitter<any> = new EventEmitter<any>();
  @Output() urlNavigate?: EventEmitter<string> = new EventEmitter<string>();
  currentUser$: Observable<AuthUser>;
  theme$: Observable<Theme>;
  unsubscribe$: Subject<null> = new Subject<null>();
  TopbarView = TopbarView;
  constructor(
    private authService: ComnAuthService,
    private loggedInUserService: UserDataService,
    private authQuery: ComnAuthQuery,
    private router: Router,
    private uiDataService: UIDataService
  ) {}

  ngOnInit() {
    this.currentUser$ = this.loggedInUserService.loggedInUser.pipe(
      filter((user) => user !== null),
      takeUntil(this.unsubscribe$)
    );
    this.theme$ = this.authQuery.userTheme$;
  }

  setTeamFn(id: string) {
    if (this.setTeam && id) {
      this.setTeam.emit(id);
    }
  }

  themeFn(event) {
    const theme = event.checked ? Theme.DARK : Theme.LIGHT;
    this.authService.setUserTheme(theme);
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
