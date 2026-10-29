// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, combineLatest, of } from 'rxjs';
import { take, takeUntil, catchError } from 'rxjs/operators';
import {
  ComnSettingsService,
} from '@cmusei/crucible-common';
import { UserDataService } from 'src/app/data/user/user-data.service';
import { UserQuery } from 'src/app/data/user/user.query';
import { CurrentUserQuery } from 'src/app/data/user/user.query';
import {
  Msel,
  SystemPermission,
  User,
} from 'src/app/generated/blueprint.api';
import { MselDataService } from 'src/app/data/msel/msel-data.service';
import { TopbarView } from '../../shared/top-bar/topbar.models';
import { Title } from '@angular/platform-browser';
import { UIDataService } from 'src/app/data/ui/ui-data.service';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { MatDialog } from '@angular/material/dialog';
import { CapabilityDialogComponent, CapabilityData } from '../../capability-dialog/capability-dialog.component';
import { landingBackground } from 'src/app/utilities/landing-background';
import { ErrorService } from 'src/app/services/error/error.service';
import { assessableMsels, canAssess } from 'src/app/utilities/assessable-msels';
import { TopbarComponent } from '../../shared/top-bar/topbar.component';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';

/** A card below the mission cards: a title and a one-line summary, opening a dialog with the details. */
export interface CapabilityCard {
  key: string;
  summary: string;
  data: CapabilityData;
}

// What a planner can do with the exercise stack, described by feature rather than by application.
export const CAPABILITY_CARDS: CapabilityCard[] = [
  {
    key: 'assessment',
    summary: 'See how each team performs against the work roles and skills the exercise is meant to build',
    data: {
      title: 'Competency-Based Assessment',
      icon: 'mdi-clipboard-check-outline',
      description: 'Choose the work roles an exercise trains and the skills under them, then rate each team on them as the exercise runs.',
      features: [
        'Use NICE, DCWF, or your own frameworks',
        'Pick the work roles an exercise covers, and the knowledge and skills under them',
        'See each team\'s activity while you rate it',
        'Rate teams on a consistent scale'
      ],
      benefits: [
        'Show what an exercise trained, not just that it happened',
        'Rate every team on what they did'
      ]
    }
  },
  {
    key: 'collaborative',
    summary: 'Plan an exercise together in one place, instead of passing a spreadsheet around',
    data: {
      title: 'Collaborative Planning',
      icon: 'mdi-account-group',
      description: 'Your planning team builds the exercise together, and everyone sees changes as they\'re made.',
      features: [
        'Several planners work at once',
        'Organize the scenario into moves and inject groups',
        'Reuse injects and whole exercises from templates',
        'Start from your existing Excel MSEL, and export the plan back to a spreadsheet'
      ],
      benefits: [
        'No more conflicting copies',
        'Planners work in parallel',
        'One version of the plan'
      ]
    }
  },
  {
    key: 'exercises',
    summary: 'Run hands-on cyber range exercises, tabletop exercises, or both, to rehearse missions and train against your objectives',
    data: {
      title: 'Hands-On and Tabletop Exercises',
      icon: 'mdi-rocket-launch-outline',
      description: 'Run the same plan as a hands-on exercise on the cyber range, a discussion-based tabletop exercise, or a mix of the two. When the plan is ready, Blueprint sets the exercise up and takes it down again when you\'re done.',
      features: [
        'Hands-on: each team works on its own network of virtual machines, alongside the exercise\'s other tools',
        'Tabletop: teams discuss each incident as it unfolds, then evaluate and score their response',
        'Deliver news, intelligence, and orders move by move',
        'Run the same exercise again for new teams, from one plan'
      ],
      benefits: [
        'Rehearse a mission before it\'s carried out',
        'Practice in a realistic environment without risk',
        'Compare how teams handled the same events'
      ]
    }
  }
];

@Component({
    selector: 'app-dashboard',
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.scss'],
    imports: [TopbarComponent, MatButton, MatIcon, MatProgressSpinner]
})
export class DashboardComponent implements OnDestroy, OnInit {
  private userDataService = inject(UserDataService);
  private errorService = inject(ErrorService);
  private userQuery = inject(UserQuery);
  private currentUserQuery = inject(CurrentUserQuery);
  private settingsService = inject(ComnSettingsService);
  private mselDataService = inject(MselDataService);
  private router = inject(Router);
  private titleService = inject(Title);
  private uiDataService = inject(UIDataService);
  private permissionDataService = inject(PermissionDataService);
  private dialog = inject(MatDialog);

  launchMselList: Msel[] = [];
  joinMselList: Msel[] = [];
  buildMselList: Msel[] = [];
  assessMselList: Msel[] = [];
  imageFilePath = '';
  userList: User[] = [];
  topbarText = 'Event Dashboard';
  hideTopbar = false;
  topbarColor = '#ef3a47';
  topbarTextColor = '#FFFFFF';
  topbarImage = this.settingsService.settings.AppTopBarImage;
  readonly backgroundImage = landingBackground(this.settingsService.settings);
  TopbarView = TopbarView;
  appTitle = 'Event Dashboard';
  joinClass = 'base-card';
  launchClass = 'base-card';
  buildClass = 'base-card';
  isStarted = false;
  // set once startup has begun, so the watchdog leaves slow requests alone
  private isStartupBegun = false;
  // set when the MSELs fail to load, to show a message instead of the cards
  loadFailed = false;
  canCreateMsels = false;
  hasAssessorRole = false;
  isSystemAdmin = false;
  capabilityCards = CAPABILITY_CARDS;
  private unsubscribe$ = new Subject();

  constructor() {
    this.hideTopbar = this.uiDataService.inIframe();
    // set image
    this.imageFilePath = this.settingsService.settings.AppTopBarImage.replace(
      'white',
      'blue'
    );
    this.titleService.setTitle(this.appTitle);
    // Set the display settings from config file
  }

  ngOnInit() {
    // Set up current user
    this.userDataService.setCurrentUser();
    // Subscribe to current user and start when ready
    this.currentUserQuery.select()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((cu) => {
        if (cu && cu.id) {
          this.startup();
        }
      });
    // Reload only if startup never began, because the current user never arrived; requests that are
    // merely slow, or that fail, are left to finish or to say so rather than reloading the page.
    setTimeout(() => this.reloadIfNotStarted(), 10000);
  }

  reloadIfNotStarted() {
    if (!this.isStartupBegun) {
      this.reloadPage();
    }
  }

  reloadPage() {
    window.location.reload();
  }

  startup() {
    this.isStartupBegun = true;
    // subscribe to users
    this.userQuery.selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((users) => {
        this.userList = users;
      });
    // load the users
    this.userDataService.load().pipe(take(1)).subscribe();
    // load the launch MSELs
    this.mselDataService
      .getMyLaunchMsels()
      .pipe(take(1))
      .subscribe((msels) => {
        this.launchMselList = msels;
      });
    // load the join MSELs
    this.mselDataService
      .getMyJoinMsels()
      .pipe(take(1))
      .subscribe((msels) => {
        this.joinMselList = msels;
      });
    // load the build MSELs. The ASSESS card depends on whether the user is a
    // system admin as well, so it waits for the permissions too. Permissions that
    // fail to load count as none, so they cannot hold up the dashboard, whose
    // watchdog would otherwise reload the page.
    // MSELs that fail to load end the spinner with a message instead of the cards.
    combineLatest([
      this.mselDataService.getMyBuildMsels().pipe(
        catchError((err) => {
          this.loadFailed = true;
          this.errorService.handleError(err);
          return of([] as Msel[]);
        })
      ),
      this.permissionDataService.load().pipe(catchError(() => of([]))),
    ])
      .pipe(take(1))
      .subscribe(([msels]) => {
        this.buildMselList = msels;
        this.canCreateMsels = this.permissionDataService.hasPermission(SystemPermission.CreateMsels);
        this.isSystemAdmin = this.canCreateMsels;
        this.checkForAssessorRole(msels);
        this.isStarted = true;
      });
  }

  // The ASSESS card shows for anyone who can assess some MSEL, and opens when
  // one of those is running.
  checkForAssessorRole(msels: Msel[]) {
    const currentUserId = this.currentUserQuery.getValue()?.id;
    this.hasAssessorRole = msels.some((msel) => canAssess(msel, currentUserId, this.isSystemAdmin));
    this.assessMselList = assessableMsels(msels, currentUserId, this.isSystemAdmin);
  }

  topBarNavigate(url: string): void {
    this.router.navigate([url]);
  }

  gotoUrl(url: string) {
    this.router.navigate([url]);
  }

  openCapabilityDialog(capability: string): void {
    const capabilityData = this.getCapabilityData(capability);
    if (!capabilityData) {
      return;
    }
    this.dialog.open(CapabilityDialogComponent, {
      data: capabilityData,
      maxWidth: '700px',
      width: '90vw'
    });
  }

  private getCapabilityData(capability: string): CapabilityData | undefined {
    return this.capabilityCards.find((c) => c.key === capability)?.data;
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
