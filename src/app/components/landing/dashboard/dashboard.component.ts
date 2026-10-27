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
  backgroundImage = landingBackground(this.settingsService.settings);
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
    const capabilities: { [key: string]: CapabilityData } = {
      'collaborative': {
        title: 'Collaborative Planning',
        icon: 'mdi-account-group',
        description: 'Blueprint transforms MSEL development from isolated spreadsheet work into a real-time collaborative experience. Multiple team members can simultaneously edit, review, and approve scenarios.',
        features: [
          'Real-time multi-user editing with instant synchronization',
          'Role-based access control (Owner, Editor, Move Editor, Approver, Evaluator, Viewer)',
          'Contributor management with granular permissions',
          'Live updates visible to all team members',
          'Approval workflow: only Approvers can mark an event Approved'
        ],
        benefits: [
          'Eliminate version control conflicts from Excel files',
          'Reduce planning time by enabling parallel work',
          'Improve coordination across distributed teams',
          'Maintain single source of truth for scenarios',
          'See who created each MSEL and who contributes to it'
        ]
      },
      'integrated': {
        title: 'Integrated Platform',
        icon: 'mdi-link-variant',
        description: 'Blueprint serves as the central hub that connects all Crucible applications. Define your MSEL once and automatically integrate with Player, CITE, Gallery, and Steamfitter.',
        features: [
          'One-click integration with Player for participant interfaces',
          'Direct connection to CITE for cyber incident evaluation',
          'Gallery integration for distributing incident information',
          'Steamfitter integration for automated task execution',
          'Unified event management across all platforms'
        ],
        benefits: [
          'Eliminate duplicate data entry across applications',
          'Ensure consistency across exercise platforms',
          'Reduce setup time from hours to minutes',
          'Simplify exercise deployment workflows',
          'Remove every integration cleanly when the exercise ends'
        ]
      },
      'scenario': {
        title: 'Scenario Design',
        icon: 'mdi-timeline-text',
        description: 'Build sophisticated cyber exercise scenarios with structured timelines, organizational hierarchies, and move-based event orchestration. Blueprint provides the tools to design complex, realistic training environments.',
        features: [
          'Move-based timeline organization for structured events',
          'Define organizations, teams, and simulated entities',
          'Add injects from reusable catalogs and save MSELs as templates',
          'Assign colors and metadata for visual organization',
          'Import existing MSELs or build from scratch'
        ],
        benefits: [
          'Design realistic, complex cyber scenarios efficiently',
          'Reuse templates and components across exercises',
          'View the full event sequence in the Exercise View',
          'Scale from simple to enterprise-level scenarios',
          'Support both planned and dynamic inject delivery'
        ]
      },
      'cyberrange': {
        title: 'Cyber Range Ready',
        icon: 'mdi-shield-check',
        description: 'Purpose-built for cybersecurity training and simulation, Blueprint understands the unique requirements of cyber range operations, from incident response to red team exercises.',
        features: [
          'Native support for cyber incident scenarios',
          'Built for adversary simulation and response training',
          'Support for tabletop and hands-on exercises'
        ],
        benefits: [
          'Reduce development time for cyber exercise scenarios',
          'Ensure exercises meet training objectives',
          'Support diverse exercise types and formats',
          'Built by cybersecurity practitioners for practitioners'
        ]
      }
    };

    return capabilities[capability];
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
