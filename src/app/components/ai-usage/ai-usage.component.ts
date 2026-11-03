// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, DestroyRef, effect, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { debounceTime, filter, take } from 'rxjs/operators';
import { SignalRService } from 'src/app/services/signalr.service';
import { AiUsageService, AiUsageSummary } from 'src/app/generated/blueprint.api';

/**
 * What building this MSEL with AI used: every call to an AI model, while it was a draft and since, by step, with an
 * estimate of the cost from the prices the server is configured with. Shows nothing for a MSEL built without AI.
 */
@Component({
  selector: 'app-ai-usage',
  templateUrl: './ai-usage.component.html',
  styleUrls: ['./ai-usage.component.scss'],
  imports: [DecimalPipe],
})
export class AiUsageComponent {
  readonly mselId = input<string>();
  usage: AiUsageSummary;

  private static readonly labels: Record<string, string> = {
    draft: 'Draft MSEL with AI',
    design: 'Design',
    injects: 'Inject outline, CITE tasks and read-in',
    rows: 'Inject text',
    article: 'Gallery articles',
    profile: 'Team and organization profiles',
    value: 'Write with AI',
    assist: 'Ask AI',
    photo: 'News photos',
    image: 'MSEL picture',
    page: 'Pages',
    move: 'Move situations',
    metadata: 'Catalog metadata',
    script: 'Audio scripts',
    audio: 'Audio',
  };

  private aiUsageService = inject(AiUsageService);
  private signalRService = inject(SignalRService);

  constructor() {
    // the Info page renders before its MSEL loads, and keeps this panel when it switches MSEL
    effect(() => {
      const mselId = this.mselId();
      if (mselId) {
        this.load(mselId);
      }
    });
    // each AI call for the MSEL that ends is a call to count, so the table follows a build or an edit as it goes; a burst of
    // calls, such as articles written six at once, is read once
    this.signalRService.aiDraftProgress$
      .pipe(
        filter((progress) => progress.done && !!progress.mselId && progress.mselId === this.mselId()),
        debounceTime(2000),
        takeUntilDestroyed(inject(DestroyRef))
      )
      .subscribe(() => this.load(this.mselId()));
  }

  private load(mselId: string) {
    this.aiUsageService
      .getMselAiUsage(mselId)
      .pipe(take(1))
      .subscribe({
        next: (usage) => (this.usage = usage?.calls ? usage : undefined),
        // usage is extra information; without it the page is the same
        error: () => (this.usage = undefined),
      });
  }

  label(operation: string): string {
    return AiUsageComponent.labels[operation] ?? operation;
  }

  // the server counts in millionths of a dollar; a planner reads dollars and cents
  dollars(micros: number | null | undefined): string {
    if (micros === null || micros === undefined) {
      return '';
    }
    return micros < 10_000 ? 'under $0.01' : `$${(micros / 1_000_000).toFixed(2)}`;
  }
}
