// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, combineLatest } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';
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
    summary: 'Capture what teams do as evidence, and rate them against NICE, DCWF or your own competencies',
    data: {
      title: 'Competency-Based Assessment',
      icon: 'mdi-clipboard-check-outline',
      description: 'Tie the exercise to the competencies it trains, record what participants do as xAPI evidence, and rate each team against those competencies while the exercise runs.',
      features: [
        'Import NICE or DCWF frameworks, and attach competencies to teams and events',
        'Record what participants do as xAPI evidence',
        'Assessors review the evidence and rate each team',
        'Each rating is sent as a competency assertion to your learning record store'
      ],
      benefits: [
        'Assess teams on what they did, not on memory',
        'Show which competencies an exercise assessed, not only that it ran',
        'Rate every team on the same proficiency scale'
      ]
    }
  },
  {
    key: 'collaborative',
    summary: 'Build one MSEL together in real time, in place of a spreadsheet',
    data: {
      title: 'Collaborative Planning',
      icon: 'mdi-account-group',
      description: 'Planners build the cyber exercise\'s MSEL together in one place, and everyone sees each change as it is made.',
      features: [
        'Several planners edit the same MSEL at once',
        'Organize events into moves and groups, with your own data fields',
        'Reuse injects from catalogs and MSELs from templates',
        'Give contributors roles; only Approvers approve events'
      ],
      benefits: [
        'No more conflicting copies of an Excel MSEL',
        'Planners work in parallel',
        'One source of truth for the scenario'
      ]
    }
  },
  {
    key: 'delivery',
    summary: 'Run the exercise on a cyber range, with each team\'s own environment, injects and scoring',
    data: {
      title: 'Cyber Range Exercises',
      icon: 'mdi-rocket-launch-outline',
      description: 'Push the MSEL to stand up the cyber range for every team in one step, run the exercise on it, and tear it all down when the exercise ends.',
      features: [
        'Give each team its own view, applications and virtual network',
        'Publish news, intelligence and orders to each team move by move',
        'Run tasks against VMs on a schedule or when another task finishes',
        'Teams evaluate each move\'s incident and score their response'
      ],
      benefits: [
        'Go from a finished MSEL to a running exercise in one step',
        'Keep the scenario on schedule without delivering each inject by hand',
        'Compare each team\'s score with the official score in the debrief'
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
  backgroundImage = landingBackground(this.settingsService.settings);
  TopbarView = TopbarView;
  appTitle = 'Event Dashboard';
  joinClass = 'base-card';
  launchClass = 'base-card';
  buildClass = 'base-card';
  isStarted = false;
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
    setTimeout(() => {
      if (!this.isStarted) {
        window.location.reload();
      }
    }, 10000);
    // Load permissions
    this.permissionDataService
      .load()
      .subscribe(
        (x) => {
          this.canCreateMsels = this.permissionDataService.hasPermission(SystemPermission.CreateMsels);
          this.isSystemAdmin = this.canCreateMsels;
        }
      );
  }

  startup() {
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
    // system admin as well, so it waits for the permissions too.
    combineLatest([this.mselDataService.getMyBuildMsels(), this.permissionDataService.load()])
      .pipe(take(1))
      .subscribe(([msels]) => {
        this.buildMselList = msels;
        this.isSystemAdmin = this.permissionDataService.hasPermission(SystemPermission.CreateMsels);
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

  topBarNavigate(url): void {
    this.router.navigate([url]);
  }

  gotoUrl(url: string) {
    this.router.navigate([url]);
  }

  openCapabilityDialog(capability: string): void {
    const capabilityData = this.getCapabilityData(capability);
    this.dialog.open(CapabilityDialogComponent, {
      data: capabilityData,
      maxWidth: '700px',
      width: '90vw'
    });
  }

  private getCapabilityData(capability: string): CapabilityData {
    return this.capabilityCards.find((c) => c.key === capability)?.data;
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
