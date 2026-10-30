// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, DestroyRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, interval, of } from 'rxjs';
import { catchError, distinctUntilChanged, map, switchMap } from 'rxjs/operators';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { MselAiBuild, MselAiBuildService } from 'src/app/data/msel/msel-ai-build.service';
import { MselBuildService, MselBuildStatus } from 'src/app/generated/blueprint.api';

/**
 * A MSEL being drafted with AI: what is being written now, how long it has run, and Cancel; or, when a build
 * stopped, what is left, with Continue drafting, Finish without them, and Discard draft.
 */
@Component({
  selector: 'app-msel-ai-build',
  templateUrl: './msel-ai-build.component.html',
  styleUrls: ['./msel-ai-build.component.scss'],
  imports: [MatButton, MatIconButton, MatIcon, MatProgressSpinner],
})
export class MselAiBuildComponent {
  private buildService = inject(MselAiBuildService);
  private api = inject(MselBuildService);
  private dialogService = inject(CrucibleDialogService);
  private destroyRef = inject(DestroyRef);

  readonly mselId = input.required<string>();
  readonly mselName = input<string>('');
  // the MSEL's aiDraftStage: Injects, Articles or Finish while it is not built
  readonly stage = input<string | null | undefined>(undefined);
  readonly canEdit = input<boolean>(false);
  readonly discard = output<string>();

  readonly build = signal<MselAiBuild | undefined>(undefined);
  // what is left of a build that was not run in this tab, from the API
  readonly saved = signal<MselBuildStatus | undefined>(undefined);
  private readonly now = signal(Date.now());

  readonly visible = computed(() => !!this.build() || !!this.stage());
  readonly remaining = computed(() => this.build()?.remaining ?? this.saved());
  readonly left = computed(
    () => (this.remaining()?.injects?.length ?? 0) + (this.remaining()?.articles?.length ?? 0) + (this.remaining()?.profiles?.length ?? 0)
  );
  readonly elapsed = computed(() => clock(this.now() - (this.build()?.started ?? this.now())));

  constructor() {
    toObservable(this.mselId)
      .pipe(
        switchMap((id) => this.buildService.build$(id)),
        takeUntilDestroyed()
      )
      .subscribe((build) => this.build.set(build));
    // the clock ticks only while a run is writing, so an idle page has nothing pending
    toObservable(this.build)
      .pipe(
        map((build) => !!build?.running),
        distinctUntilChanged(),
        switchMap((running) => (running ? interval(1000) : EMPTY)),
        takeUntilDestroyed()
      )
      .subscribe(() => this.now.set(Date.now()));
    // what is left is read when the page opens, and again when the stage changes or a run here stops
    effect(() => {
      const stage = this.stage();
      if (stage && !this.build()?.running) {
        this.loadSaved();
      }
    });
  }

  get stepLabel(): string {
    switch (this.build()?.step) {
      case 'injects':
        return 'Outlining the injects, CITE tasks and read-in';
      case 'articles':
        return 'Writing each inject, Gallery article and profile';
      case 'finish':
        return 'Adding the pages, Player applications and CITE';
      default:
        return '';
    }
  }

  // what the model has written so far, from its streamed answer
  get stepDetail(): string {
    const build = this.build();
    if (build?.step === 'injects') {
      const counts = build.counts ?? {};
      const parts = [
        plural(counts['injects'], 'inject'),
        plural(counts['citeActions'], 'CITE task'),
      ].filter((p) => p);
      return parts.length ? `${parts.join(', ')} so far.` : 'This usually takes a few minutes.';
    }
    if (build?.step === 'articles') {
      return `${build.written} of ${build.total}.`;
    }
    return '';
  }

  get stoppedText(): string {
    const stage = this.remaining()?.stage ?? this.stage();
    if (stage === 'Injects') {
      return 'Its injects are not outlined yet.';
    }
    if (stage === 'Articles') {
      const left = this.left();
      return left
        ? `${plural(left, 'inject, article or profile', 'injects, articles and profiles')} still to write, then the pages, Player applications and CITE.`
        : 'The pages, Player applications and CITE are still to add.';
    }
    return '';
  }

  continue() {
    this.buildService.run(this.mselId());
  }

  finishNow() {
    this.buildService.finishNow(this.mselId());
  }

  cancel() {
    this.buildService.cancel(this.mselId());
  }

  dismiss() {
    this.buildService.dismiss(this.mselId());
  }

  discardDraft() {
    this.dialogService
      .confirm({
        title: 'Discard draft',
        message: `Delete ${this.mselName() || 'this MSEL'} and everything drafted into it so far?`,
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.buildService.cancel(this.mselId());
          this.discard.emit(this.mselId());
        }
      });
  }

  private loadSaved() {
    this.api
      .getMselBuildStatus(this.mselId())
      .pipe(
        catchError(() => of(undefined)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((status) => this.saved.set(status));
  }
}

function plural(count: number, one: string, many = one + 's'): string {
  return count ? `${count} ${count === 1 ? one : many}` : '';
}

function clock(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
}
