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
    key: 'competencies',
    summary: 'Rate each team against NICE, DCWF or your own competency framework',
    data: {
      title: 'Competency Assessment',
      icon: 'mdi-clipboard-check-outline',
      description: 'Tie the exercise to the competencies it trains, then rate each team against them while the exercise runs. Each rating is recorded as a competency assertion.',
      features: [
        'Import a competency framework from a NICE JSON file, a DCWF spreadsheet or a Moodle competency CSV, or build your own',
        'Pick the competencies an exercise covers by framework, work role or category',
        'Assign each competency to the teams it applies to',
        'Attach competencies to scenario events',
        'Rate a team on each competency for an event, a group or a move, with a level from your proficiency scale and a comment',
        'Each rating is sent as an xAPI "asserted" statement, with its score on the proficiency scale',
        'Define your own proficiency scales and levels'
      ],
      benefits: [
        'Show which competencies an exercise assessed, not only that it ran',
        'Rate every team on the same scale',
        'Send ratings to your learning record store, where other training systems can use them',
        'Publish each exercise\'s competencies, difficulty, purpose, mode and keywords as IEEE 2881 learning metadata, so a learning management system can find it'
      ]
    }
  },
  {
    key: 'evidence',
    summary: 'Record what participants do as xAPI statements, as evidence for assessors',
    data: {
      title: 'Learning Data Capture',
      icon: 'mdi-chart-timeline-variant',
      description: 'The exercise records what participants do as xAPI statements and sends them to your learning record store (LRS). Assessors see those statements next to the events they rate.',
      features: [
        'Statements are recorded as the exercise starts and ends, as participants join and move between applications, read and share articles, evaluate and score incidents, and as tasks run',
        'Checking or clearing a checkbox on an event is recorded as a statement',
        'The Assessor View shows the statements for each move, group and event',
        'Filter the evidence by team, source and verb',
        'Open any statement to read its JSON, or copy it'
      ],
      benefits: [
        'Assess teams on what they did, not on memory',
        'Keep a standard record that any xAPI learning record store can hold and report on',
        'Keep the evidence after the exercise ends'
      ]
    }
  },
  {
    key: 'evaluation',
    summary: 'Teams evaluate incidents and score their response each move',
    data: {
      title: 'Incident Evaluation',
      icon: 'mdi-scale-balance',
      description: 'Participants evaluate the incident in each move and score it with the scoring model you choose, as individuals and as a team.',
      features: [
        'Create the evaluation with one move for each move of the MSEL',
        'Choose the scoring model teams score against',
        'Post a situation time and description for each move',
        'Suggest actions for each team to consider in each move',
        'Suggest roles for each team\'s members',
        'Compare a participant\'s score with their team\'s score, the group average and the official score',
        'Advance the evaluation to the next move with a scheduled task'
      ],
      benefits: [
        'See how each team judged the same incident',
        'Compare each team\'s judgment with the official score in the debrief',
        'Keep every move\'s score for later review'
      ]
    }
  },
  {
    key: 'collaborative',
    summary: 'Build one MSEL together in real time, in place of a spreadsheet',
    data: {
      title: 'Collaborative Planning',
      icon: 'mdi-account-group',
      description: 'Planners build the MSEL together in one place. Everyone sees each change as it is made.',
      features: [
        'Several planners edit the same MSEL at once',
        'Organize scenario events into moves and groups, and view them in real time or delta time',
        'Add your own data fields to scenario events',
        'Add injects from reusable catalogs, and save MSELs as templates',
        'Upload a MSEL from an xlsx or json file, and download it the same way',
        'Give contributors roles: Owner, Editor, Move Editor, Approver, Evaluator or Viewer. Only Approvers can mark an event Approved',
        'Print a playbook of the MSEL\'s pages and events'
      ],
      benefits: [
        'No more conflicting copies of an Excel MSEL',
        'Planners work in parallel',
        'One source of truth for the scenario',
        'See who created each MSEL and who contributes to it'
      ]
    }
  },
  {
    key: 'environments',
    summary: 'Give each team its own view, applications and virtual network',
    data: {
      title: 'Team Environments',
      icon: 'mdi-lan',
      description: 'Push the MSEL to set up the exercise for every team in one step. Remove it all again when the exercise ends.',
      features: [
        'Create an exercise view with a team for each MSEL team, and add the participants',
        'Choose which applications each team sees, and in what order',
        'Deploy a virtual network from a Terraform template, and map each team to a template variable so the template can give that team its own VMs',
        'Invite participants to a team by email domain, with an expiry date and a user limit',
        'Let invited users start their own copy of a template exercise on demand'
      ],
      benefits: [
        'Set up every team the same way, without entering anything twice',
        'Go from a finished MSEL to a running exercise in one step',
        'Remove every part of the exercise cleanly when it ends'
      ]
    }
  },
  {
    key: 'delivery',
    summary: 'Publish news and intelligence feeds and automate tasks as the scenario unfolds',
    data: {
      title: 'Scenario Delivery',
      icon: 'mdi-newspaper-variant-outline',
      description: 'Deliver the scenario to participants as it unfolds: publish articles to their feeds, send notifications and email, and run tasks against their VMs.',
      features: [
        'Publish articles as news, social media, email, phone calls, intelligence, reporting or orders',
        'Group articles under cards that build each team\'s picture of the incident',
        'Release articles move by move and inject by inject',
        'Send notifications to a team\'s view, and email to participants',
        'Run commands, read and write files, and power VMs on or off',
        'Run tasks at a set time, by hand, or when another task succeeds, fails or completes'
      ],
      benefits: [
        'Keep the scenario on schedule without delivering each inject by hand',
        'Release injects in the order and at the times you planned',
        'Change the environment mid-exercise without touching each VM'
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
