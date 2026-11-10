// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, computed, effect, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatHint, MatLabel } from '@angular/material/input';
import { MatOptgroup, MatOption, MatSelect } from '@angular/material/select';
import { Observable } from 'rxjs';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import {
  Move,
  MselScoringModel,
  MselScoringModelService,
  ScoringModel,
  ScoringModelPreset,
} from 'src/app/generated/blueprint.api';
import { MoveQuery } from 'src/app/data/move/move.query';
import { ErrorService } from 'src/app/services/error/error.service';
import { showCiteAccessDenied } from 'src/app/utilities/cite-access';
import {
  SCORING_MODEL_PRESETS,
  categoriesWithoutOptions,
  isScoringModelValid,
  normalizeScoringModel,
  scoringModelCounts,
} from 'src/app/utilities/scoring-model';
import { MselScoringModelEditorComponent, ScoringModelMove } from '../msel-scoring-model-editor/msel-scoring-model-editor.component';

/**
 * The scoring model a MSEL authors itself: start one from a preset or a copy of a CITE model, then edit it in place
 * and Save or Discard the edits. The Scoring Model tab holds the saved model; this reports every change back to it.
 */
@Component({
  selector: 'app-msel-scoring-model',
  templateUrl: './msel-scoring-model.component.html',
  styleUrls: ['./msel-scoring-model.component.scss'],
  imports: [FormsModule, MatFormField, MatLabel, MatHint, MatSelect, MatOption, MatOptgroup, MatButton, MselScoringModelEditorComponent],
})
export class MselScoringModelComponent {
  private mselScoringModelService = inject(MselScoringModelService);
  private moveQuery = inject(MoveQuery);
  private dialogService = inject(CrucibleDialogService);
  private errorService = inject(ErrorService);

  readonly mselId = input<string>(undefined);
  readonly scoringModel = input<MselScoringModel | null>(null);
  readonly canEdit = input<boolean>(false);
  /** The CITE scoring models the user can copy from. */
  readonly citeScoringModels = input<ScoringModel[]>([]);
  readonly scoringModelChange = output<MselScoringModel | null>();

  readonly presets = SCORING_MODEL_PRESETS;
  startFrom = '';
  isBusy = false;
  isSaving = false;
  errorMessage = '';
  // the model as the API holds it, and a copy edited apart from it, so Discard has it to go back to
  saved: MselScoringModel | null = null;
  working: MselScoringModel | null = null;
  private savedSnapshot = '';
  private readonly moves = toSignal(this.moveQuery.selectAll(), { initialValue: [] as Move[] });
  // computed, so the editor's moves input changes only when the moves do, not on every change detection
  readonly mselMoves = computed<ScoringModelMove[]>(() =>
    this.moves()
      .filter((m) => m.mselId === this.mselId())
      .map((m) => ({ moveNumber: +m.moveNumber, description: m.description })),
  );

  constructor() {
    // each saved model starts a fresh copy to edit
    effect(() => this.startEditing(this.scoringModel()));
  }

  private startEditing(saved: MselScoringModel | null) {
    this.saved = saved;
    this.working = saved ? normalizeScoringModel(structuredClone(saved)) : null;
    this.savedSnapshot = JSON.stringify(this.working);
    this.errorMessage = '';
  }

  startFromHint(): string {
    if (this.startFrom.startsWith('cite:')) {
      return 'A copy to edit here. The CITE scoring model itself is not changed.';
    }
    return this.presets.find((p) => 'preset:' + p.preset === this.startFrom)?.hint ?? '';
  }

  summary(): string {
    return scoringModelCounts(this.working);
  }

  emptyCategoryWarning(): string {
    const empty = categoriesWithoutOptions(this.working);
    if (!empty.length) {
      return '';
    }
    return empty.length === 1
      ? '** 1 scoring category has no questions or options yet **'
      : `** ${empty.length} scoring categories have no questions or options yet **`;
  }

  isDirty(): boolean {
    return !!this.working && JSON.stringify(this.working) !== this.savedSnapshot;
  }

  isValid(): boolean {
    return isScoringModelValid(this.working);
  }

  create() {
    if (!this.startFrom) {
      return;
    }
    const current = this.saved;
    if (!current) {
      this.apply();
      return;
    }
    this.dialogService
      .confirm({
        title: 'Replace Scoring Model',
        message: `Replace "${current.description}" with ${this.startFromLabel()}? Its categories and options are discarded.`,
        confirmText: 'Replace',
        cancelText: 'Cancel',
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.apply();
        }
      });
  }

  private startFromLabel(): string {
    if (this.startFrom.startsWith('cite:')) {
      const model = this.citeScoringModels().find((m) => 'cite:' + m.id === this.startFrom);
      return `a copy of "${model?.description ?? 'the CITE scoring model'}"`;
    }
    return this.presets.find((p) => 'preset:' + p.preset === this.startFrom)?.label ?? 'the preset';
  }

  private apply() {
    const [kind, value] = this.startFrom.split(':');
    const request: Observable<MselScoringModel> =
      kind === 'cite'
        ? this.mselScoringModelService.copyMselScoringModelFromCite(this.mselId(), value)
        : this.mselScoringModelService.createMselScoringModelFromPreset(this.mselId(), value as ScoringModelPreset);
    this.isBusy = true;
    request.subscribe({
      next: (model) => {
        this.isBusy = false;
        this.startFrom = '';
        this.took(model);
      },
      error: (err: HttpErrorResponse) => {
        this.isBusy = false;
        // CITE may refuse the copy: the model is not the user's to read, or only as a participant
        if (!showCiteAccessDenied(this.dialogService, err)) {
          this.errorService.handleError(err);
        }
      },
    });
  }

  save() {
    if (!this.canEdit() || !this.isValid()) {
      return;
    }
    this.isSaving = true;
    this.errorMessage = '';
    // the API numbers the categories and options in the order they are sent
    this.mselScoringModelService.replaceMselScoringModel(this.mselId(), this.working).subscribe({
      next: (saved) => {
        this.isSaving = false;
        this.took(saved);
      },
      error: (err: HttpErrorResponse) => {
        this.isSaving = false;
        this.errorMessage = err?.error?.title || err?.message || 'The scoring model could not be saved.';
      },
    });
  }

  discard() {
    this.startEditing(this.saved);
  }

  // the model the API now holds: shown at once, and reported so the tab holds it too
  private took(model: MselScoringModel) {
    const normalized = normalizeScoringModel(model);
    this.startEditing(normalized);
    this.scoringModelChange.emit(normalized);
  }
}
