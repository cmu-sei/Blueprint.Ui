// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatIcon } from '@angular/material/icon';
import { MatFormField, MatHint, MatInput, MatLabel } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatTooltip } from '@angular/material/tooltip';
import { CrucibleDialogComponent, CrucibleDialogContentDirective } from '@cmusei/crucible-common';
import {
  CiteRightSideDisplay,
  CiteScoringOptionSelection,
  MselScoringCategory,
  MselScoringModel,
  MselScoringModelService,
} from 'src/app/generated/blueprint.api';
import {
  RIGHT_SIDE_DISPLAYS,
  categoriesForMove,
  isQuestionCategory,
  moveRangeLabel,
  normalizeScoringModel,
} from 'src/app/utilities/scoring-model';

export interface MselScoringModelEditDialogData {
  mselId: string;
  scoringModel: MselScoringModel;
  /** The MSEL's moves, for the move ranges and the preview. */
  moves: { moveNumber: number; description?: string }[];
  canEdit: boolean;
}

/**
 * Edits a MSEL's own CITE scoring model: its settings, its categories with the moves they are shown in, and their
 * options, beside a preview of what a team's scoresheet shows in each move. Save replaces the whole model.
 */
@Component({
  selector: 'app-msel-scoring-model-edit-dialog',
  templateUrl: './msel-scoring-model-edit-dialog.component.html',
  styleUrls: ['./msel-scoring-model-edit-dialog.component.scss'],
  imports: [CrucibleDialogComponent, CrucibleDialogContentDirective, FormsModule, MatFormField, MatLabel, MatInput, MatHint, MatSelect, MatOption, MatCheckbox, MatButton, MatIconButton, MatIcon, MatTooltip],
})
export class MselScoringModelEditDialogComponent {
  data = inject<MselScoringModelEditDialogData>(MAT_DIALOG_DATA);
  dialogRef = inject<MatDialogRef<MselScoringModelEditDialogComponent, MselScoringModel>>(MatDialogRef);
  private mselScoringModelService = inject(MselScoringModelService);

  // edited apart from the model the opener holds, so Cancel leaves it as it was
  model: MselScoringModel = normalizeScoringModel(structuredClone(this.data.scoringModel));
  readonly canEdit = this.data.canEdit;
  readonly moveNumbers: number[] = (this.data.moves || []).map((m) => +m.moveNumber).sort((a, b) => a - b);
  readonly rightSideDisplays = RIGHT_SIDE_DISPLAYS;
  readonly selections = [
    { value: CiteScoringOptionSelection.Single, label: 'Single' },
    { value: CiteScoringOptionSelection.Multiple, label: 'Multiple' },
    { value: CiteScoringOptionSelection.None, label: 'None' },
  ];
  readonly RightSideDisplay = CiteRightSideDisplay;
  previewMoveNumber: number = this.previewMoveNumbers()[0] ?? 0;
  isSaving = false;
  errorMessage = '';

  isQuestionCategory = isQuestionCategory;

  moveLabel(moveNumber: number): string {
    const move = (this.data.moves || []).find((m) => +m.moveNumber === +moveNumber);
    return move?.description ? `Move ${moveNumber} - ${move.description}` : `Move ${moveNumber}`;
  }

  rangeLabel(category: MselScoringCategory): string {
    return moveRangeLabel(category, this.moveNumbers);
  }

  /** The MSEL's moves, or else the moves the categories name, so a MSEL without moves still previews. */
  previewMoveNumbers(): number[] {
    if (this.moveNumbers.length) {
      return this.moveNumbers;
    }
    const firsts = (this.model?.categories || []).map((c) => +c.moveNumberFirstDisplay);
    return [...new Set(firsts)].sort((a, b) => a - b);
  }

  previewCategories(): MselScoringCategory[] {
    return categoriesForMove(this.model, this.previewMoveNumber);
  }

  isValid(): boolean {
    const isNumber = (n: number) => n !== null && n !== undefined && `${n}` !== '' && Number.isFinite(+n);
    return (
      !!this.model.description?.trim() &&
      this.model.categories.every(
        (c) =>
          isNumber(c.moveNumberFirstDisplay) &&
          isNumber(c.moveNumberLastDisplay) &&
          +c.moveNumberFirstDisplay <= +c.moveNumberLastDisplay &&
          (isQuestionCategory(c) || isNumber(c.scoringWeight)) &&
          c.options.every((o) => isQuestionCategory(c) || isNumber(o.value)),
      )
    );
  }

  addCategory() {
    const first = this.moveNumbers[0] ?? 0;
    const last = this.moveNumbers[this.moveNumbers.length - 1] ?? first;
    this.model.categories.push({
      description: '',
      calculationEquation: '{max}',
      scoringWeight: 1,
      moveNumberFirstDisplay: first,
      moveNumberLastDisplay: last,
      // a question set's next category asks questions too
      scoringOptionSelection: this.model.categories[this.model.categories.length - 1]?.scoringOptionSelection ?? CiteScoringOptionSelection.Single,
      isModifierRequired: false,
      options: [],
    });
  }

  removeCategory(index: number) {
    this.model.categories.splice(index, 1);
  }

  moveCategory(index: number, by: number) {
    this.swap(this.model.categories, index, index + by);
  }

  addOption(category: MselScoringCategory) {
    category.options.push({ description: '', value: isQuestionCategory(category) ? 1 : 0, isModifier: false });
  }

  removeOption(category: MselScoringCategory, index: number) {
    category.options.splice(index, 1);
  }

  moveOption(category: MselScoringCategory, index: number, by: number) {
    this.swap(category.options, index, index + by);
  }

  private swap<T>(list: T[], from: number, to: number) {
    if (to < 0 || to >= list.length) {
      return;
    }
    [list[from], list[to]] = [list[to], list[from]];
  }

  save() {
    if (!this.canEdit || !this.isValid()) {
      return;
    }
    this.isSaving = true;
    this.errorMessage = '';
    // the API numbers the categories and options in the order they are sent
    this.mselScoringModelService.replaceMselScoringModel(this.data.mselId, this.model).subscribe({
      next: (saved) => {
        this.isSaving = false;
        this.dialogRef.close(normalizeScoringModel(saved));
      },
      error: (err: HttpErrorResponse) => {
        this.isSaving = false;
        this.errorMessage = err?.error?.title || err?.message || 'The scoring model could not be saved.';
      },
    });
  }

  cancel() {
    this.dialogRef.close();
  }
}
