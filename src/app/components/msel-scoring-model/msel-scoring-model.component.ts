// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, DestroyRef, inject, input, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
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
import {
  SCORING_MODEL_PRESETS,
  categoriesWithoutOptions,
  normalizeScoringModel,
} from 'src/app/utilities/scoring-model';
import {
  MselScoringModelEditDialogComponent,
  MselScoringModelEditDialogData,
} from '../msel-scoring-model-edit-dialog/msel-scoring-model-edit-dialog.component';

/**
 * The scoring model a MSEL authors itself, on the MSEL's CITE settings: start one from a preset or a copy of a CITE
 * model, then edit it. The MSEL's info page holds the model; this reports every change back to it.
 */
@Component({
  selector: 'app-msel-scoring-model',
  templateUrl: './msel-scoring-model.component.html',
  styleUrls: ['./msel-scoring-model.component.scss'],
  imports: [FormsModule, MatFormField, MatLabel, MatHint, MatSelect, MatOption, MatOptgroup, MatButton],
})
export class MselScoringModelComponent {
  private mselScoringModelService = inject(MselScoringModelService);
  private moveQuery = inject(MoveQuery);
  private dialog = inject(MatDialog);
  private dialogService = inject(CrucibleDialogService);
  private errorService = inject(ErrorService);
  private destroyRef = inject(DestroyRef);

  readonly mselId = input<string>(undefined);
  readonly scoringModel = input<MselScoringModel | null>(null);
  readonly canEdit = input<boolean>(false);
  /** The CITE scoring models the user can copy from. */
  readonly citeScoringModels = input<ScoringModel[]>([]);
  readonly scoringModelChange = output<MselScoringModel | null>();

  readonly presets = SCORING_MODEL_PRESETS;
  startFrom = '';
  isBusy = false;
  private moves: Move[] = [];

  constructor() {
    this.moveQuery
      .selectAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((moves) => (this.moves = moves));
  }

  startFromHint(): string {
    if (this.startFrom.startsWith('cite:')) {
      return 'A copy to edit here. The CITE scoring model itself is not changed.';
    }
    return this.presets.find((p) => 'preset:' + p.preset === this.startFrom)?.hint ?? '';
  }

  summary(): string {
    const categories = this.scoringModel()?.categories || [];
    const options = categories.reduce((n, c) => n + (c.options || []).length, 0);
    return `${categories.length} ${categories.length === 1 ? 'category' : 'categories'}, ${options} ${options === 1 ? 'option' : 'options'}`;
  }

  emptyCategoryWarning(): string {
    const empty = categoriesWithoutOptions(this.scoringModel());
    if (!empty.length) {
      return '';
    }
    return empty.length === 1
      ? '** 1 scoring category has no questions or options yet **'
      : `** ${empty.length} scoring categories have no questions or options yet **`;
  }

  create() {
    if (!this.startFrom) {
      return;
    }
    const current = this.scoringModel();
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
        const created = normalizeScoringModel(model);
        this.scoringModelChange.emit(created);
        // a new model is only a start: the planner writes its questions next
        this.openEditor(created);
      },
      error: (err) => {
        this.isBusy = false;
        this.errorService.handleError(err);
      },
    });
  }

  openEditor(model: MselScoringModel = this.scoringModel()) {
    const data: MselScoringModelEditDialogData = {
      mselId: this.mselId(),
      scoringModel: model,
      moves: this.moves
        .filter((m) => m.mselId === this.mselId())
        .map((m) => ({ moveNumber: +m.moveNumber, description: m.description })),
      canEdit: this.canEdit(),
    };
    this.dialog
      .open(MselScoringModelEditDialogComponent, { width: '1280px', maxWidth: '95vw', data })
      .afterClosed()
      .subscribe((saved: MselScoringModel) => {
        if (saved) {
          this.scoringModelChange.emit(saved);
        }
      });
  }
}
