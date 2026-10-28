// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, inject, input, output } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { take } from 'rxjs/operators';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MselDataService } from 'src/app/data/msel/msel-data.service';
import { CardDataService } from 'src/app/data/card/card-data.service';
import { CardTeamDataService } from 'src/app/data/team/card-team-data.service';
import { MselCompetencyDataService } from 'src/app/data/msel-competency/msel-competency-data.service';
import { OrganizationDataService } from 'src/app/data/organization/organization-data.service';
import { TeamCompetencyDataService } from 'src/app/data/team-competency/team-competency-data.service';
import { TeamDataService } from 'src/app/data/team/team-data.service';
import { MoveDataService } from 'src/app/data/move/move-data.service';
import { ScenarioEventDataService } from 'src/app/data/scenario-event/scenario-event-data.service';
import { DataValueDataService } from 'src/app/data/data-value/data-value-data.service';
import { MselAssistMessage, MselChange, MselChangeResult } from 'src/app/generated/blueprint.api';

/** One turn of the conversation, with what the assistant proposed and what came of applying it. */
export interface AssistTurn {
  role: 'planner' | 'assistant';
  text: string;
  question?: string;
  changes?: { change: MselChange; keep: boolean }[];
  warnings?: string[];
  results?: MselChangeResult[];
  error?: string;
}

@Component({
  selector: 'app-msel-assistant',
  templateUrl: './msel-assistant.component.html',
  styleUrls: ['./msel-assistant.component.scss'],
  imports: [
    FormsModule,
    MatButton,
    MatIconButton,
    MatCheckbox,
    MatFormField,
    MatLabel,
    MatIcon,
    MatInput,
    MatProgressSpinner,
  ],
})
export class MselAssistantComponent {
  private mselDataService = inject(MselDataService);
  private teamDataService = inject(TeamDataService);
  private organizationDataService = inject(OrganizationDataService);
  private cardDataService = inject(CardDataService);
  private cardTeamDataService = inject(CardTeamDataService);
  private mselCompetencyDataService = inject(MselCompetencyDataService);
  private teamCompetencyDataService = inject(TeamCompetencyDataService);
  private moveDataService = inject(MoveDataService);
  private scenarioEventDataService = inject(ScenarioEventDataService);
  private dataValueDataService = inject(DataValueDataService);

  readonly mselId = input.required<string>();
  readonly closePanel = output<void>();

  turns: AssistTurn[] = [];
  prompt = '';
  isAsking = false;
  isApplying = false;

  readonly examples = [
    'Add a CERT team and a legal team, each with its own Gallery card',
    'Give BLUE the Cyber Defense Analyst work role',
    'Add the national cyber agency and two news outlets as organizations',
    'Add a move where a partner nation leaks the patch early, with three injects',
    'Make the injects in move 2 more urgent',
  ];

  get canAsk(): boolean {
    return !!this.prompt.trim() && !this.isAsking && !this.isApplying;
  }

  ask(text = this.prompt) {
    text = text.trim();
    if (!text || this.isAsking) {
      return;
    }
    const history: MselAssistMessage[] = this.turns.map((t) => ({
      role: t.role,
      text: t.role === 'assistant' ? [t.text, t.question].filter(Boolean).join(' ') : t.text,
    }));
    this.turns.push({ role: 'planner', text });
    this.prompt = '';
    this.isAsking = true;
    this.mselDataService
      .askAssistant(this.mselId(), { prompt: text, history })
      .pipe(take(1))
      .subscribe({
        next: (result) => {
          this.turns.push({
            role: 'assistant',
            text: result.reply || '',
            question: result.question || undefined,
            changes: (result.changes ?? []).map((change) => ({ change, keep: true })),
            warnings: result.warnings ?? [],
          });
          this.isAsking = false;
        },
        error: (err) => {
          this.turns.push({ role: 'assistant', text: '', error: this.getErrorMessage(err, 'The request failed.') });
          this.isAsking = false;
        },
      });
  }

  keptChanges(turn: AssistTurn): MselChange[] {
    return (turn.changes ?? []).filter((c) => c.keep).map((c) => c.change);
  }

  apply(turn: AssistTurn) {
    const changes = this.keptChanges(turn);
    if (!changes.length || this.isApplying) {
      return;
    }
    this.isApplying = true;
    this.mselDataService
      .applyAssistantChanges(this.mselId(), { changes })
      .pipe(take(1))
      .subscribe({
        next: (result) => {
          turn.results = result.results ?? [];
          this.isApplying = false;
          this.reload();
        },
        error: (err) => {
          turn.error = this.getErrorMessage(err, 'The changes could not be applied.');
          this.isApplying = false;
        },
      });
  }

  // the lists the changes touch, so every tab shows them without a page refresh
  private reload() {
    const mselId = this.mselId();
    this.teamDataService.loadByMsel(mselId);
    this.organizationDataService.loadByMsel(mselId);
    this.cardDataService.loadByMsel(mselId);
    this.cardTeamDataService.getCardTeamsFromApi(mselId);
    this.moveDataService.loadByMsel(mselId);
    this.scenarioEventDataService.loadByMsel(mselId);
    this.dataValueDataService.loadByMsel(mselId);
    this.mselCompetencyDataService.loadByMsel(mselId);
    this.teamCompetencyDataService.loadByMsel(mselId);
  }

  onKeydown(event: KeyboardEvent) {
    // Enter sends; Shift+Enter starts a new line
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (this.canAsk) {
        this.ask();
      }
    }
  }

  private getErrorMessage(err: any, fallback: string): string {
    if (err instanceof HttpErrorResponse && err.status === 0) {
      return 'The API could not be reached.';
    }
    const title = err?.error?.title;
    const detail = err?.error?.detail;
    if (title) {
      return detail ? `${title} ${detail}` : title;
    }
    return err?.error?.message || err?.message || fallback;
  }
}
