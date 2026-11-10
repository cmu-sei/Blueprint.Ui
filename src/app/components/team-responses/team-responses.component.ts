// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, computed, input } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { MatIcon } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import {
  CiteSubmissionResponse,
  CiteTeamResponses,
  CiteTeamResponsesStatus,
} from 'src/app/generated/blueprint.api';
import { TimezoneAbbrPipe } from 'src/app/utilities/timezone-abbr';

/**
 * A read-only view of what a team answered on its CITE scoring model for
 * one move. It only displays: the page that hosts it fetches the answers
 * and passes them in, with whether they are loading or failed to load.
 */
@Component({
  selector: 'app-team-responses',
  templateUrl: './team-responses.component.html',
  styleUrls: ['./team-responses.component.scss'],
  imports: [MatIcon, MatProgressBar, DatePipe, NgTemplateOutlet, TimezoneAbbrPipe],
})
export class TeamResponsesComponent {
  /** The answers to show, or null when there are none yet. */
  readonly responses = input<CiteTeamResponses | null>(null);
  readonly loading = input(false);
  /** A message saying the answers could not be loaded. */
  readonly error = input<string | null>(null);
  /** Shown in the header when given, e.g. the team's short name. */
  readonly teamName = input<string>('');
  /** Shown when there is no team, and so nothing to load. */
  readonly prompt = input<string>('');

  /** The states that explain why there are no answers to show. */
  private static readonly EXPLAINED: string[] = [
    CiteTeamResponsesStatus.NotPushed,
    CiteTeamResponsesStatus.TeamNotInCite,
    CiteTeamResponsesStatus.MoveNotInCite,
    CiteTeamResponsesStatus.MoveNotStarted,
    CiteTeamResponsesStatus.Unavailable,
  ];

  readonly explanation = computed(() => {
    const responses = this.responses();
    return responses && TeamResponsesComponent.EXPLAINED.includes(responses.status)
      ? responses.message || 'No CITE answers to show.'
      : '';
  });

  readonly unavailable = computed(
    () => this.responses()?.status === CiteTeamResponsesStatus.Unavailable
  );

  readonly answered = computed(
    () => this.responses()?.status === CiteTeamResponsesStatus.Answered
  );

  readonly notAnswered = computed(
    () => this.responses()?.status === CiteTeamResponsesStatus.NotAnswered
  );

  /** The official and team-average submissions, with their headings, when present. */
  readonly others = computed(() => {
    const responses = this.responses();
    const others: { label: string; submission: CiteSubmissionResponse }[] = [];
    if (!responses || this.explanation()) {
      return others;
    }
    if (responses.officialSubmission) {
      others.push({ label: 'Official', submission: responses.officialSubmission });
    }
    if (responses.teamAverageSubmission) {
      others.push({ label: 'Team average', submission: responses.teamAverageSubmission });
    }
    return others;
  });
}
