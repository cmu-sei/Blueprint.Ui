// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { interval, Subscription } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatOption, MatSelect } from '@angular/material/select';
import {
  CrucibleDialogActionsDirective,
  CrucibleDialogComponent,
  CrucibleDialogContentDirective,
} from '@cmusei/crucible-common';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { TimezoneAbbrPipe } from 'src/app/utilities/timezone-abbr';
import { MatChip, MatChipRemove, MatChipSet } from '@angular/material/chips';
import { MatTooltip } from '@angular/material/tooltip';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatTab, MatTabGroup } from '@angular/material/tabs';
import { MselAiBuildService, errorMessage } from 'src/app/data/msel/msel-ai-build.service';
import { SignalRService } from 'src/app/services/signalr.service';
import {
  CompetencyFramework,
  CompetencyFrameworkService,
  Msel,
  MselBuildService,
  MselDraftDesign,
  MselDraftOrganization,
  MselDraftResult,
  MselDraftTeam,
} from 'src/app/generated/blueprint.api';

export interface MselDraftDialogData {
  templates: Msel[];
}

// The dialog drafts the design and saves nothing until Create MSEL, which creates the MSEL from the reviewed design
// and starts writing its injects, articles and profiles into it. The dialog closes with the new MSEL's id.
@Component({
  selector: 'app-msel-draft-dialog',
  templateUrl: './msel-draft-dialog.component.html',
  styleUrls: ['./msel-draft-dialog.component.scss'],
  imports: [
    CrucibleDialogComponent,
    CrucibleDialogContentDirective,
    CrucibleDialogActionsDirective,
    FormsModule,
    NgTemplateOutlet,
    DatePipe,
    TimezoneAbbrPipe,
    MatButton,
    MatIconButton,
    MatChip,
    MatChipRemove,
    MatChipSet,
    MatFormField,
    MatHint,
    MatLabel,
    MatIcon,
    MatInput,
    MatOption,
    MatSelect,
    MatProgressSpinner,
    MatTooltip,
    MatCheckbox,
    MatTab,
    MatTabGroup,
  ],
})
export class MselDraftDialogComponent {
  dialogRef = inject<MatDialogRef<MselDraftDialogComponent, string>>(MatDialogRef);
  data = inject<MselDraftDialogData>(MAT_DIALOG_DATA);
  private competencyFrameworkService = inject(CompetencyFrameworkService);
  private buildApi = inject(MselBuildService);
  private buildService = inject(MselAiBuildService);
  private signalRService = inject(SignalRService);

  templateMselId = '';
  prompt = '';
  // the draft assigns competencies only from these; none means the template's own
  competencyFrameworkIds: string[] = [];
  competencyFrameworks: CompetencyFramework[] = [];
  // the design questions the author-ttx workflow asks; all optional
  design: MselDraftDesign = { citeAssessment: 'QuestionsByMove', profilePages: true };
  isDrafting = false;
  isCreating = false;
  errorMessage = '';
  result: MselDraftResult;
  // the planner's answer to each of the design's questions, in order; each starts as the suggested answer
  answers: string[] = [];
  selectedTab = 0;
  // while the design is written: when it started, and what the model has written so far
  draftStarted = 0;
  elapsed = '0:00';
  progress: { [list: string]: number } = {};
  private drafting: Subscription;
  // ticks only while the design is written, so nothing runs while the planner reviews
  private ticking: Subscription;

  constructor() {
    this.dialogRef.disableClose = true;
    // the template built for drafting, ready for every integration, unless there is only one to choose
    const templates = this.data.templates;
    const preferred = templates.length === 1 ? templates[0] : templates.find((t) => t.name === 'Crucible MSEL');
    if (preferred) {
      this.templateMselId = preferred.id;
      this.templateChanged();
    }
    this.competencyFrameworkService
      .getCompetencyFrameworks()
      .pipe(take(1))
      .subscribe({
        next: (frameworks) =>
          (this.competencyFrameworks = [...frameworks].sort((a, b) => a.name.localeCompare(b.name))),
        // drafting still works without a framework list; the template's competencies are used
        error: () => (this.competencyFrameworks = []),
      });
    this.signalRService.aiDraftProgress$
      .pipe(
        filter((p) => this.isDrafting && p.operation === 'design'),
        takeUntilDestroyed()
      )
      .subscribe((p) => (this.progress = p.counts ?? {}));
  }

  get templateUsesCite(): boolean {
    return !!this.data.templates.find((t) => t.id === this.templateMselId)?.useCite;
  }

  get templateUsesGallery(): boolean {
    return !!this.data.templates.find((t) => t.id === this.templateMselId)?.useGallery;
  }

  get templateHasScoringModel(): boolean {
    return !!this.data.templates.find((t) => t.id === this.templateMselId)?.citeScoringModelId;
  }

  readonly tlpLevels = ['CLEAR', 'GREEN', 'AMBER', 'AMBER+STRICT', 'RED'];

  // a template that links a scoring model keeps it unless the planner chooses another; its article marking is the starting choice
  templateChanged() {
    this.design.citeAssessment = this.templateHasScoringModel ? 'Template' : 'QuestionsByMove';
    const template = this.data.templates.find((t) => t.id === this.templateMselId);
    // only Gallery articles are marked
    this.design.marking = template?.useGallery ? template.articleMarking || 'Exercise' : undefined;
    this.design.markingText = template?.useGallery ? template.articleMarkingText ?? (this.design.marking === 'Tlp' ? 'CLEAR' : undefined) : undefined;
  }

  // what building the MSEL makes in CITE, so the planner is not surprised by it
  get citeModelNote(): string {
    switch (this.result?.draft?.design?.citeAssessment) {
      case 'QuestionsByMove':
        return `Building the MSEL also creates the scoring model "${this.result.draft.name} Questions by Move" in CITE, from each move's questions.`;
      case 'MissionImpact':
        return 'The MSEL uses the DoD CTT Mission Impact Assessment scoring model, created in CITE if it is not there.';
      case 'Likelihood':
        return 'The MSEL uses the DoD CTT Likelihood Assessment Matrix scoring model, created in CITE if it is not there.';
      case 'Nciss':
        return 'The MSEL uses the CISA NCISS scoring model, created in CITE if it is not there.';
      default:
        return '';
    }
  }

  get canDraft(): boolean {
    return !!this.templateMselId && this.prompt.trim().length > 0 && !this.isDrafting;
  }

  // what the design has so far, from the model's streamed answer
  get progressText(): string {
    const parts = [
      plural(this.progress['moves'], 'move'),
      plural(this.progress['teams'], 'team'),
      plural(this.progress['organizations'], 'organization'),
      plural(this.progress['questions'], 'question'),
    ].filter((p) => p);
    return parts.length ? `${parts.join(', ')} so far.` : '';
  }

  draft() {
    this.isDrafting = true;
    this.errorMessage = '';
    this.progress = {};
    this.draftStarted = Date.now();
    this.elapsed = '0:00';
    this.ticking?.unsubscribe();
    this.ticking = interval(1000).subscribe(() => (this.elapsed = clock(Date.now() - this.draftStarted)));
    this.drafting = this.buildApi
      .designMsel({
        templateMselId: this.templateMselId,
        prompt: this.prompt,
        competencyFrameworkIds: this.competencyFrameworkIds,
        design: this.design,
      })
      .pipe(take(1))
      .subscribe({
        next: (result) => {
          this.result = result;
          this.answers = (result.questions ?? []).map((q) => q.suggested ?? '');
          this.selectedTab = 0;
          this.stopDrafting();
        },
        error: (err) => {
          this.errorMessage = errorMessage(err);
          this.stopDrafting();
        },
      });
  }

  // abandons the design being written; the prompt and choices stay to draft again
  cancelDraft() {
    this.drafting?.unsubscribe();
    this.stopDrafting();
  }

  private stopDrafting() {
    this.ticking?.unsubscribe();
    this.isDrafting = false;
  }

  // back to the prompt, keeping it so the planner can reword and draft again
  startOver() {
    this.result = undefined;
  }

  get teamsAndOrganizations(): (MselDraftTeam | MselDraftOrganization)[] {
    return [...(this.result?.draft?.teams ?? []), ...(this.result?.draft?.organizations ?? [])];
  }

  isTeam(owner: MselDraftTeam | MselDraftOrganization): boolean {
    return (this.result?.draft?.teams ?? []).includes(owner as MselDraftTeam);
  }

  removeOwner(owner: MselDraftTeam | MselDraftOrganization) {
    const draft = this.result.draft;
    draft.teams = (draft.teams ?? []).filter((t) => t !== owner);
    draft.organizations = (draft.organizations ?? []).filter((o) => o !== owner);
    this.pruneCompetencies();
  }

  // a team's CITE duties, edited as one comma-separated line
  duties(owner: MselDraftTeam | MselDraftOrganization): string {
    return ((owner as MselDraftTeam).duties ?? []).join(', ');
  }

  setDuties(owner: MselDraftTeam | MselDraftOrganization, text: string) {
    (owner as MselDraftTeam).duties = text
      .split(',')
      .map((d) => d.trim())
      .filter((d) => d);
  }

  removeObjective(index: number) {
    this.result.draft.objectives = this.result.draft.objectives.filter((_, i) => i !== index);
  }

  removeCard(index: number) {
    this.result.draft.cards = this.result.draft.cards.filter((_, i) => i !== index);
  }

  // the planner removes a competency from a team; the MSEL keeps only those still used
  removeCompetency(owner: MselDraftTeam, idNumber: string) {
    owner.competencies = owner.competencies.filter((c) => c !== idNumber);
    this.pruneCompetencies();
  }

  private pruneCompetencies() {
    const draft = this.result.draft;
    const used = new Set([
      ...(draft.teams ?? []).flatMap((t) => t.competencies ?? []),
      ...(draft.objectives ?? []).flatMap((o) => o.competencies ?? []),
    ]);
    draft.competencies = (draft.competencies ?? []).filter((c) => used.has(c));
  }

  competencyName(idNumber: string): string {
    return this.result.competencies?.find((c) => c.idNumber === idNumber)?.shortName ?? '';
  }

  formatMinutes(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}:${m.toString().padStart(2, '0')}`;
  }

  get canCreate(): boolean {
    return !!this.result?.draft?.name?.trim() && !!this.result.draft.moves?.length && !this.isCreating;
  }

  // creates the MSEL from the design, then writes the rest into it while the planner works on the MSEL page
  create() {
    this.isCreating = true;
    this.errorMessage = '';
    this.buildApi
      .createMselFromDesign({
        templateMselId: this.result.templateMselId,
        prompt: this.prompt,
        draft: this.result.draft,
        competencyFrameworkIds: this.competencyFrameworkIds,
        answers: (this.result.questions ?? []).map((q, i) => ({ question: q.question, answer: this.answers[i] ?? '' })),
      })
      .pipe(take(1))
      .subscribe({
        next: (created) => {
          this.buildService.run(created.msel.id);
          this.dialogRef.close(created.msel.id);
        },
        error: (err) => {
          this.errorMessage = errorMessage(err);
          this.isCreating = false;
        },
      });
  }

  close() {
    this.cancelDraft();
    this.dialogRef.close();
  }
}

function plural(count: number, one: string): string {
  return count ? `${count} ${count === 1 ? one : one + 's'}` : '';
}

function clock(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
}
