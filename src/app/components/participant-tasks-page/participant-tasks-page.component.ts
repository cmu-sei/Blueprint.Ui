// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { PercentPipe } from '@angular/common';
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ComnSettingsService,
  CrucibleDialogService,
} from '@cmusei/crucible-common';
import { Subject } from 'rxjs';
import { debounceTime, filter, take } from 'rxjs/operators';
import {
  AutomationService,
  ParticipantTask,
  ParticipantTasks,
} from 'src/app/generated/blueprint.api';
import { UIDataService } from 'src/app/data/ui/ui-data.service';
import { reloadOnReconnect } from 'src/app/services/hub-reconnect.service';
import {
  ApplicationArea,
  SignalRService,
} from 'src/app/services/signalr.service';
import { AutomationStatusChipComponent } from '../automation-status-chip/automation-status-chip.component';
import { TopbarComponent } from '../shared/top-bar/topbar.component';
import { TopbarView } from '../shared/top-bar/topbar.models';

/**
 * A MSEL's Tasks page, at /msel/{id}/tasks, for its participants, as Steamfitter's task page was: the automation tasks
 * marked for them, how each went, and the exercise's score, with a button to run each. Player shows it as an
 * application. It follows the exercise live: its hub group says when to read the tasks again.
 */
@Component({
  selector: 'app-participant-tasks-page',
  imports: [
    AutomationStatusChipComponent,
    MatIcon,
    MatIconButton,
    MatTooltip,
    PercentPipe,
    TopbarComponent,
  ],
  templateUrl: './participant-tasks-page.component.html',
  styleUrls: ['./participant-tasks-page.component.scss'],
})
export class ParticipantTasksPageComponent implements OnDestroy {
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
  private automationService = inject(AutomationService);
  private dialogService = inject(CrucibleDialogService);
  private signalRService = inject(SignalRService);
  private uiDataService = inject(UIDataService);
  private titleService = inject(Title);
  private settingsService = inject(ComnSettingsService);

  readonly page = signal<ParticipantTasks | undefined>(undefined);
  readonly loadFailed = signal(false);
  readonly errorMessage = signal('');
  readonly running = signal(new Set<string>());
  readonly hideTopbar = this.uiDataService.inIframe();
  readonly TopbarView = TopbarView;
  readonly topbarImage = (
    this.settingsService.settings as { AppTopBarImage?: string }
  ).AppTopBarImage;
  private mselId = '';
  private readonly changed = new Subject<void>();

  constructor() {
    this.mselId = this.activatedRoute.snapshot.paramMap.get('mselid') ?? '';
    this.load();
    this.changed
      .pipe(debounceTime(300), takeUntilDestroyed())
      .subscribe(() => this.load());
    this.signalRService.participantTasksChanged$
      .pipe(
        filter((id) => id === this.mselId),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.changed.next());
    // a reconnect replaces the connection: join the group again, and read what was missed
    reloadOnReconnect(() => {
      this.signalRService.joinParticipantTasks(this.mselId);
      this.load();
    });
    this.signalRService
      .startConnection(ApplicationArea.home)
      .then(() => this.signalRService.joinParticipantTasks(this.mselId))
      .catch((err) => console.log(err));
  }

  load() {
    this.automationService
      .getParticipantTasks(this.mselId)
      .pipe(take(1))
      .subscribe({
        next: (page) => {
          this.page.set(page);
          this.loadFailed.set(false);
          const appTitle =
            (this.settingsService.settings as { AppTitle?: string }).AppTitle ||
            'Blueprint';
          this.titleService.setTitle(`${appTitle} - ${page.mselName} Tasks`);
        },
        error: () => this.loadFailed.set(true),
      });
  }

  run(task: ParticipantTask) {
    this.dialogService
      .confirm({
        title: 'Run Task',
        message: `Are you sure that you want to run ${task.name}?`,
        confirmText: 'Run',
        cancelText: 'Cancel',
      })
      .afterClosed()
      .pipe(take(1))
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.errorMessage.set('');
        this.running.update((ids) => new Set([...ids, task.id]));
        this.automationService
          .runParticipantTask(this.mselId, task.id)
          .pipe(take(1))
          .subscribe({
            next: (updated) => {
              this.page.update((page) =>
                page
                  ? {
                      ...page,
                      tasks: page.tasks.map((t) =>
                        t.id === updated.id ? updated : t,
                      ),
                    }
                  : page,
              );
              this.done(task.id);
            },
            error: () => {
              this.errorMessage.set(`${task.name} could not be run.`);
              this.done(task.id);
              this.load();
            },
          });
      });
  }

  private done(taskId: string) {
    this.running.update(
      (ids) => new Set([...ids].filter((id) => id !== taskId)),
    );
  }

  hasScores(): boolean {
    return (this.page()?.score ?? 0) > 0;
  }

  topBarNavigate(url: string): void {
    void this.router.navigate([url]);
  }

  ngOnDestroy() {
    this.signalRService.leaveParticipantTasks(this.mselId);
  }
}
