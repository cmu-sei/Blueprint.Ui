// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, computed, effect, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconButton, MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatIcon } from '@angular/material/icon';
import { MatError, MatFormField, MatHint, MatInput, MatLabel } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatTooltip } from '@angular/material/tooltip';
import {
  CiteRightSideDisplay,
  CiteScoringOptionSelection,
  MselScoringCategory,
  MselScoringModel,
} from 'src/app/generated/blueprint.api';
import { RIGHT_SIDE_DISPLAYS, categoriesForMove, fillHiddenNumbers, isQuestionCategory, moveRangeLabel } from 'src/app/utilities/scoring-model';

export interface ScoringModelMove {
  moveNumber: number;
  description?: string;
}

/**
 * The form for a MSEL's own CITE scoring model: its settings, its categories with the moves they are shown in, and
 * their options, beside a preview of what a team's scoresheet shows in each move. It edits the model it is given in
 * place; whoever owns the model saves or discards it.
 */
@Component({
  selector: 'app-msel-scoring-model-editor',
  templateUrl: './msel-scoring-model-editor.component.html',
  styleUrls: ['./msel-scoring-model-editor.component.scss'],
  imports: [FormsModule, MatFormField, MatLabel, MatInput, MatHint, MatError, MatSelect, MatOption, MatCheckbox, MatButton, MatIconButton, MatIcon, MatTooltip],
})
export class MselScoringModelEditorComponent {
  readonly model = input.required<MselScoringModel>();
  /** The MSEL's moves, for the move ranges and the preview. */
  readonly moves = input<ScoringModelMove[]>([]);
  readonly canEdit = input(false);

  readonly moveNumbers = computed(() => this.moves().map((m) => +m.moveNumber).sort((a, b) => a - b));
  readonly rightSideDisplays = RIGHT_SIDE_DISPLAYS;
  readonly selections = [
    { value: CiteScoringOptionSelection.Single, label: 'Single' },
    { value: CiteScoringOptionSelection.Multiple, label: 'Multiple' },
    { value: CiteScoringOptionSelection.None, label: 'None' },
  ];
  readonly RightSideDisplay = CiteRightSideDisplay;
  previewMoveNumber = 0;

  isQuestionCategory = isQuestionCategory;
  // a category made a question set keeps the weight and values it no longer shows
  fillHiddenNumbers = fillHiddenNumbers;

  constructor() {
    // another model previews from its first move
    effect(() => {
      this.model();
      this.previewMoveNumber = this.previewMoveNumbers()[0] ?? 0;
    });
  }

  moveLabel(moveNumber: number): string {
    const move = this.moves().find((m) => +m.moveNumber === +moveNumber);
    return move?.description ? `Move ${moveNumber} - ${move.description}` : `Move ${moveNumber}`;
  }

  rangeLabel(category: MselScoringCategory): string {
    return moveRangeLabel(category, this.moveNumbers());
  }

  /** The MSEL's moves, or else the moves the categories name, so a MSEL without moves still previews. */
  previewMoveNumbers(): number[] {
    if (this.moveNumbers().length) {
      return this.moveNumbers();
    }
    const firsts = (this.model()?.categories || []).map((c) => +c.moveNumberFirstDisplay);
    return [...new Set(firsts)].sort((a, b) => a - b);
  }

  previewCategories(): MselScoringCategory[] {
    return categoriesForMove(this.model(), this.previewMoveNumber);
  }

  addCategory() {
    const model = this.model();
    const moveNumbers = this.moveNumbers();
    const first = moveNumbers[0] ?? 0;
    const last = moveNumbers[moveNumbers.length - 1] ?? first;
    model.categories.push({
      description: '',
      calculationEquation: '{max}',
      scoringWeight: 1,
      moveNumberFirstDisplay: first,
      moveNumberLastDisplay: last,
      // a question set's next category asks questions too
      scoringOptionSelection: model.categories[model.categories.length - 1]?.scoringOptionSelection ?? CiteScoringOptionSelection.Single,
      isModifierRequired: false,
      options: [],
    });
  }

  removeCategory(index: number) {
    this.model().categories.splice(index, 1);
  }

  moveCategory(index: number, by: number) {
    this.swap(this.model().categories, index, index + by);
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
}
