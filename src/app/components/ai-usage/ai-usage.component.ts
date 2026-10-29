// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, OnInit, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { take } from 'rxjs/operators';
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
export class AiUsageComponent implements OnInit {
  readonly mselId = input.required<string>();
  usage: AiUsageSummary;

  private static readonly labels: Record<string, string> = {
    draft: 'Draft MSEL with AI',
    article: 'Gallery articles',
    profile: 'Team and organization profiles',
    value: 'Write with AI',
    assist: 'Ask AI',
    photo: 'News photos',
  };

  constructor(private aiUsageService: AiUsageService) {}

  ngOnInit() {
    this.aiUsageService
      .getMselAiUsage(this.mselId())
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
