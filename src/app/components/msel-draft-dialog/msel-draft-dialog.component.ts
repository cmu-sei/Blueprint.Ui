// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, Inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { from, of, Subscription } from 'rxjs';
import { catchError, map, mergeMap, take } from 'rxjs/operators';
import { svgImagesToPng } from 'src/app/utilities/svg-to-png';
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
import { NgTemplateOutlet } from '@angular/common';
import { MatChip, MatChipRemove, MatChipSet } from '@angular/material/chips';
import { MatTooltip } from '@angular/material/tooltip';
import { MselDataService } from 'src/app/data/msel/msel-data.service';
import {
  CompetencyFramework,
  CompetencyFrameworkService,
  DataFieldType,
  Msel,
  MselDraftImport,
  MselDraftInject,
  MselDraftResult,
  MselDraftTeam,
} from 'src/app/generated/blueprint.api';

export interface MselDraftDialogData {
  templates: Msel[];
}

// Drafting writes nothing. Closing with a MselDraftImport hands the reviewed
// draft to the import dialog, which creates the MSEL and reports on it.
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
  ],
})
export class MselDraftDialogComponent {
  templateMselId = '';
  prompt = '';
  // the draft assigns competencies only from these; none means the template's own
  competencyFrameworkIds: string[] = [];
  competencyFrameworks: CompetencyFramework[] = [];
  isDrafting = false;
  errorMessage = '';
  result: MselDraftResult;
  // each Gallery article is written out as a document of its source type after the draft comes back
  articlesTotal = 0;
  articlesDone = 0;
  articleErrors: string[] = [];
  articleNotes = new Map<MselDraftInject, string[]>();
  private articleFields = new Map<MselDraftInject, string>();
  private writing: Subscription;
  isPreparing = false;
  // drawn on a canvas in the browser; tests give their own
  toPng = svgImagesToPng;

  constructor(
    public dialogRef: MatDialogRef<MselDraftDialogComponent, MselDraftImport>,
    @Inject(MAT_DIALOG_DATA) public data: MselDraftDialogData,
    private mselDataService: MselDataService,
    private competencyFrameworkService: CompetencyFrameworkService
  ) {
    dialogRef.disableClose = true;
    if (data.templates.length === 1) {
      this.templateMselId = data.templates[0].id;
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
  }

  get canDraft(): boolean {
    return !!this.templateMselId && this.prompt.trim().length > 0 && !this.isDrafting;
  }

  draft() {
    this.isDrafting = true;
    this.errorMessage = '';
    this.mselDataService
      .draftMsel({
        templateMselId: this.templateMselId,
        prompt: this.prompt,
        competencyFrameworkIds: this.competencyFrameworkIds,
      })
      .pipe(take(1))
      .subscribe({
        next: (result) => {
          this.result = result;
          this.isDrafting = false;
          this.writeArticles();
        },
        error: (err) => {
          this.errorMessage = this.getErrorMessage(err);
          this.isDrafting = false;
        },
      });
  }

  // back to the prompt, keeping it so the planner can reword and draft again
  startOver() {
    this.stopWriting();
    this.result = undefined;
  }

  get isWritingArticles(): boolean {
    return !!this.writing && !this.writing.closed;
  }

  // the injects with a source type are Gallery articles
  private articles(): MselDraftInject[] {
    const sourceType = this.result.fields.find((f) => f.dataType === DataFieldType.SourceType);
    return sourceType ? this.result.draft.injects.filter((i) => i.values?.[sourceType.name]) : [];
  }

  // three at a time; the injects are not removed while this runs, so each index stays the article's
  writeArticles() {
    const articles = this.articles();
    this.articlesTotal = articles.length;
    this.articlesDone = 0;
    this.articleErrors = [];
    if (!articles.length) {
      return;
    }
    const draft = this.result.draft;
    this.writing = from(articles)
      .pipe(
        mergeMap(
          (inject) =>
            this.mselDataService
              .draftArticle({ templateMselId: this.result.templateMselId, draft, injectIndex: draft.injects.indexOf(inject) })
              .pipe(
                map((article) => ({ inject, article, error: undefined as string })),
                catchError((err) => of({ inject, article: undefined, error: this.getErrorMessage(err) }))
              ),
          3
        )
      )
      .subscribe(({ inject, article, error }) => {
        this.articlesDone++;
        if (article) {
          inject.values[article.fieldName] = article.html;
          this.articleFields.set(inject, article.fieldName);
          if (article.notes?.length) {
            this.articleNotes.set(inject, article.notes);
          }
        } else {
          this.articleErrors.push(`${this.titleFor(inject)}: ${error}`);
        }
      });
  }

  stopWriting() {
    this.writing?.unsubscribe();
  }

  // the written article, shown as Gallery will show it
  articleHtml(inject: MselDraftInject): string {
    const field = this.articleFields.get(inject);
    return field ? inject.values?.[field] : undefined;
  }

  // the articles the draft puts on a card, as the planner removes injects
  articlesOn(cardName: string): number {
    return this.result?.draft?.injects?.filter((i) => i.card === cardName).length ?? 0;
  }

  removeInject(inject: MselDraftInject) {
    this.result.draft.injects = this.result.draft.injects.filter((i) => i !== inject);
  }

  // the planner removes a competency from an inject or team; the MSEL keeps only those still used
  removeCompetency(owner: MselDraftInject | MselDraftTeam, idNumber: string) {
    owner.competencies = owner.competencies.filter((c) => c !== idNumber);
    const draft = this.result.draft;
    const used = new Set([...draft.injects, ...draft.teams].flatMap((o) => o.competencies ?? []));
    draft.competencies = (draft.competencies ?? []).filter((c) => used.has(c));
  }

  competencyName(idNumber: string): string {
    return this.result.competencies?.find((c) => c.idNumber === idNumber)?.shortName ?? '';
  }

  moveFor(inject: MselDraftInject): number {
    const moves = this.result.draft.moves ?? [];
    const move = [...moves].reverse().find((m) => m.startMinutes <= inject.minutes);
    return move?.moveNumber ?? 0;
  }

  // the column that best names a row: a Title-like column, else the first text column
  titleFor(inject: MselDraftInject): string {
    const values = inject.values ?? {};
    const titleField = this.result.fields.find((f) =>
      ['title', 'message', 'name'].includes(f.name.toLowerCase())
    );
    if (titleField && values[titleField.name]) {
      return values[titleField.name];
    }
    const textField = this.result.fields.find(
      (f) => f.dataType === DataFieldType.String && values[f.name]
    );
    return textField ? values[textField.name] : '';
  }

  recipientsFor(inject: MselDraftInject): string {
    const field = this.result.fields.find((f) => f.dataType === DataFieldType.TeamsMultiple);
    return field ? (inject.values?.[field.name] ?? '') : '';
  }

  valuesFor(inject: MselDraftInject): { name: string; value: string }[] {
    return this.result.fields
      .filter((f) => inject.values?.[f.name])
      .map((f) => ({ name: f.name, value: inject.values[f.name] }));
  }

  formatMinutes(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}:${m.toString().padStart(2, '0')}`;
  }

  // Blueprint's own views show only PNG, so each article's SVG graphics become PNG before the MSEL is created
  async create() {
    this.isPreparing = true;
    for (const [inject, field] of this.articleFields) {
      inject.values[field] = await this.toPng(inject.values[field]);
    }
    this.isPreparing = false;
    this.dialogRef.close({
      templateMselId: this.result.templateMselId,
      draft: this.result.draft,
      competencyFrameworkIds: this.competencyFrameworkIds,
    });
  }

  close() {
    this.stopWriting();
    this.dialogRef.close();
  }

  private getErrorMessage(err: any): string {
    if (err instanceof HttpErrorResponse && err.status === 0) {
      return 'The API could not be reached.';
    }
    const title = err?.error?.title;
    const detail = err?.error?.detail;
    if (title) {
      return detail ? `${title} ${detail}` : title;
    }
    return err?.message || 'The draft failed.';
  }
}
