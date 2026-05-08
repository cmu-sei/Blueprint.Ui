// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';
import {
  ComnSettingsService,
} from '@cmusei/crucible-common';
import { UserDataService } from 'src/app/data/user/user-data.service';
import { UserQuery } from 'src/app/data/user/user.query';
import { CurrentUserQuery } from 'src/app/data/user/user.query';
import {
  Msel,
  MselRole,
  SystemPermission,
  User,
  UserMselRole,
} from 'src/app/generated/blueprint.api';
import { MselDataService } from 'src/app/data/msel/msel-data.service';
import { TopbarView } from '../../shared/top-bar/topbar.models';
import { Title } from '@angular/platform-browser';
import { UIDataService } from 'src/app/data/ui/ui-data.service';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { MatDialog } from '@angular/material/dialog';
import { CapabilityDialogComponent, CapabilityData } from '../../capability-dialog/capability-dialog.component';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  standalone: false
})
export class DashboardComponent implements OnDestroy, OnInit {
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
  TopbarView = TopbarView;
  appTitle = 'Event Dashboard';
  joinClass = 'base-card';
  launchClass = 'base-card';
  buildClass = 'base-card';
  isStarted = false;
  canCreateMsels = false;
  hasAssessorRole = false;
  isSystemAdmin = false;
  private unsubscribe$ = new Subject();

  constructor(
    private userDataService: UserDataService,
    private userQuery: UserQuery,
    private currentUserQuery: CurrentUserQuery,
    private settingsService: ComnSettingsService,
    private mselDataService: MselDataService,
    private router: Router,
    private titleService: Title,
    private uiDataService: UIDataService,
    private permissionDataService: PermissionDataService,
    private dialog: MatDialog
  ) {
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
    // load the build MSELs
    this.mselDataService
      .getMyBuildMsels()
      .pipe(take(1))
      .subscribe((msels) => {
        this.buildMselList = msels;
        // Check for Evaluator role to show assess card
        this.checkForAssessorRole(msels);
        this.isStarted = true;
      });
  }

  checkForAssessorRole(msels: Msel[]) {
    // System admins always have assessor access
    if (this.isSystemAdmin) {
      this.hasAssessorRole = true;
      // Add all MSELs with scenario events to assessMselList
      this.assessMselList = msels.filter(
        (msel) => msel.scenarioEvents && msel.scenarioEvents.length > 0
      );
      return;
    }

    // Check if user has Evaluator role on any MSEL
    const currentUserId = this.currentUserQuery.getValue()?.id;
    if (!currentUserId) return;

    for (const msel of msels) {
      if (msel.userMselRoles) {
        const hasEvaluatorRole = msel.userMselRoles.some(
          (umr) => umr.userId === currentUserId && umr.role === MselRole.Evaluator
        );
        if (hasEvaluatorRole) {
          this.hasAssessorRole = true;
          // Add to assessMselList if it has active scenario events
          if (msel.scenarioEvents && msel.scenarioEvents.length > 0) {
            this.assessMselList.push(msel);
          }
        }
      }
    }
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
        icon: 'groups',
        description: 'Blueprint transforms MSEL development from isolated spreadsheet work into a real-time collaborative experience. Multiple team members can simultaneously edit, review, and approve scenarios.',
        features: [
          'Real-time multi-user editing with instant synchronization',
          'Role-based access control (Owner, Editor, Approver, Viewer)',
          'Contributor management with granular permissions',
          'Live updates visible to all team members',
          'Comment and approval workflows'
        ],
        benefits: [
          'Eliminate version control conflicts from Excel files',
          'Reduce planning time by enabling parallel work',
          'Improve coordination across distributed teams',
          'Maintain single source of truth for scenarios',
          'Track changes and contributions transparently'
        ]
      },
      'integrated': {
        title: 'Integrated Platform',
        icon: 'hub',
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
          'Maintain synchronization throughout exercise lifecycle'
        ]
      },
      'scenario': {
        title: 'Scenario Design',
        icon: 'timeline',
        description: 'Build sophisticated cyber exercise scenarios with structured timelines, organizational hierarchies, and move-based event orchestration. Blueprint provides the tools to design complex, realistic training environments.',
        features: [
          'Move-based timeline organization for structured events',
          'Define organizations, teams, and simulated entities',
          'Create event templates for rapid scenario building',
          'Assign colors and metadata for visual organization',
          'Import existing MSELs or build from scratch'
        ],
        benefits: [
          'Design realistic, complex cyber scenarios efficiently',
          'Reuse templates and components across exercises',
          'Visualize event sequences and dependencies',
          'Scale from simple to enterprise-level scenarios',
          'Support both planned and dynamic inject delivery'
        ]
      },
      'cyberrange': {
        title: 'Cyber Range Ready',
        icon: 'security',
        description: 'Purpose-built for cybersecurity training and simulation, Blueprint understands the unique requirements of cyber range operations, from incident response to red team exercises.',
        features: [
          'Native support for cyber incident scenarios',
          'Integration with threat intelligence frameworks',
          'Built for adversary simulation and response training',
          'Support for tabletop and hands-on exercises',
          'Designed for DoD and government compliance requirements'
        ],
        benefits: [
          'Reduce development time for cyber exercise scenarios',
          'Ensure exercises meet training objectives',
          'Support diverse exercise types and formats',
          'Built by cybersecurity practitioners for practitioners',
          'Continuously updated for emerging threats and techniques'
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
