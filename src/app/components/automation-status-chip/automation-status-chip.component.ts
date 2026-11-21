// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, computed, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { AutomationStatus } from 'src/app/generated/blueprint.api';

interface StatusLook {
  icon: string;
  label: string;
  tone: 'success' | 'failure' | 'active' | 'waiting' | 'quiet';
}

const LOOKS: Record<AutomationStatus | 'NotRun', StatusLook> = {
  NotRun: { icon: 'mdi-circle-outline', label: 'Not run', tone: 'quiet' },
  Pending: { icon: 'mdi-clock-outline', label: 'Waiting', tone: 'waiting' },
  Queued: { icon: 'mdi-clock-outline', label: 'Queued', tone: 'waiting' },
  Running: { icon: 'mdi-sync', label: 'Running', tone: 'active' },
  Succeeded: {
    icon: 'mdi-check-circle-outline',
    label: 'Succeeded',
    tone: 'success',
  },
  Failed: {
    icon: 'mdi-close-circle-outline',
    label: 'Failed',
    tone: 'failure',
  },
  Expired: { icon: 'mdi-timer-off-outline', label: 'Expired', tone: 'failure' },
  Cancelled: { icon: 'mdi-cancel', label: 'Cancelled', tone: 'quiet' },
  Error: {
    icon: 'mdi-alert-circle-outline',
    label: 'Error',
    tone: 'failure',
  },
  Skipped: { icon: 'mdi-debug-step-over', label: 'Skipped', tone: 'quiet' },
};

/**
 * An automation status as an icon and a word, so the color is never the only signal. Compact shows the icon alone,
 * with the word as its accessible name and tooltip.
 */
@Component({
  selector: 'app-automation-status-chip',
  imports: [MatIcon, MatTooltip],
  template: `
    <span
      class="automation-status"
      [class]="'tone-' + look().tone"
      [attr.role]="compact() ? 'img' : null"
      [attr.aria-label]="compact() ? text() : null"
      [matTooltip]="compact() ? text() : (detail() ?? '')"
    >
      <mat-icon class="mdi-18px" [fontIcon]="look().icon" aria-hidden="true" />
      @if (!compact()) {
        <span>{{ text() }}</span>
      }
    </span>
  `,
  styles: `
    .automation-status {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
    }
    .tone-success {
      color: var(--mat-sys-primary);
    }
    .tone-failure {
      color: var(--mat-sys-error);
    }
    .tone-active {
      color: var(--mat-sys-tertiary);
    }
    .tone-waiting,
    .tone-quiet {
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class AutomationStatusChipComponent {
  /** The status; none means the task has not run. */
  readonly status = input<AutomationStatus | null | undefined>(undefined);
  /** Replaces the status's own word, as "1 of 3 failed" does. */
  readonly label = input<string | undefined>(undefined);
  /** The tooltip of the full chip. */
  readonly detail = input<string | undefined>(undefined);
  readonly compact = input(false);

  readonly look = computed(
    () => LOOKS[this.status() ?? 'NotRun'] ?? LOOKS.NotRun,
  );
  readonly text = computed(() => this.label() ?? this.look().label);
}
