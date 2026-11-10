/*
 Copyright 2026 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import {
  CiteRightSideDisplay,
  CiteScoringOptionSelection,
  MselScoringCategory,
  MselScoringModel,
  ScoringModelPreset,
} from 'src/app/generated/blueprint.api';

/** The presets a MSEL's own scoring model can start from, named as CITE names the models they make. */
export const SCORING_MODEL_PRESETS: { preset: ScoringModelPreset; label: string; hint: string }[] = [
  {
    preset: ScoringModelPreset.QuestionsByMove,
    label: 'Questions by Move',
    hint: 'Discussion questions for each move, answered in comment boxes, then an after-action review on the last move.',
  },
  {
    preset: ScoringModelPreset.MissionImpact,
    label: 'DoD CTT Mission Impact Assessment',
    hint: 'Mission capability, time to recover, system availability and data integrity, scored each move.',
  },
  {
    preset: ScoringModelPreset.Likelihood,
    label: 'DoD CTT Likelihood Assessment Matrix',
    hint: 'Attack cost plus attack success, with the likelihood matrix beside the scoresheet.',
  },
  {
    preset: ScoringModelPreset.Nciss,
    label: 'CISA NCISS',
    hint: 'The National Cyber Incident Scoring System: eight weighted factors scored from 0 to 100.',
  },
];

export const RIGHT_SIDE_DISPLAYS: { value: CiteRightSideDisplay; label: string }[] = [
  { value: CiteRightSideDisplay.ScoreSummary, label: 'Score Summary' },
  { value: CiteRightSideDisplay.HtmlBlock, label: 'HTML Block' },
  { value: CiteRightSideDisplay.EmbeddedUrl, label: 'Embedded URL' },
  { value: CiteRightSideDisplay.Scoresheet, label: 'Scoresheet' },
  { value: CiteRightSideDisplay.None, label: 'None' },
];

/**
 * Blueprint sends every int as a JSON string, so a model read from the API carries its display orders and move
 * numbers as strings. This gives them back as numbers, ordered as they are displayed, so they can be compared.
 */
export function normalizeScoringModel(model: MselScoringModel): MselScoringModel {
  if (!model) {
    return model;
  }
  return {
    ...model,
    categories: [...(model.categories || [])]
      .map((c) => ({
        ...c,
        displayOrder: +c.displayOrder,
        moveNumberFirstDisplay: +c.moveNumberFirstDisplay,
        moveNumberLastDisplay: +c.moveNumberLastDisplay,
        scoringWeight: +c.scoringWeight,
        options: [...(c.options || [])]
          .map((o) => ({ ...o, displayOrder: +o.displayOrder, value: +o.value }))
          .sort((a, b) => a.displayOrder - b.displayOrder),
      }))
      .sort((a, b) => a.displayOrder - b.displayOrder),
  };
}

/** The categories a team's scoresheet shows in a move, as CITE's scoresheet chooses them. */
export function categoriesForMove(model: MselScoringModel, moveNumber: number): MselScoringCategory[] {
  const categories = model?.categories || [];
  if (!model?.displayScoringModelByMoveNumber) {
    return categories;
  }
  return categories.filter(
    (c) => +c.moveNumberFirstDisplay <= +moveNumber && +moveNumber <= +c.moveNumberLastDisplay,
  );
}

/** A question set asks questions answered in comments; nothing is selected and nothing is scored. */
export function isQuestionCategory(category: MselScoringCategory): boolean {
  return category?.scoringOptionSelection === CiteScoringOptionSelection.None;
}

/** The categories that would reach CITE with nothing on them to answer or choose. */
export function categoriesWithoutOptions(model: MselScoringModel): MselScoringCategory[] {
  return (model?.categories || []).filter((c) => !(c.options || []).length);
}

/** "2 categories, 5 options", for a summary line. */
export function scoringModelCounts(model: MselScoringModel): string {
  const categories = model?.categories || [];
  const options = categories.reduce((n, c) => n + (c.options || []).length, 0);
  return `${categories.length} ${categories.length === 1 ? 'category' : 'categories'}, ${options} ${options === 1 ? 'option' : 'options'}`;
}

/** Whether a number field holds a number: a cleared number input gives null, or an empty string. */
export function hasNumber(n: number): boolean {
  return n !== null && n !== undefined && `${n}` !== '' && Number.isFinite(+n);
}

/**
 * Whether the API would accept the model: a description, move numbers for each category, in order when the model
 * displays by move number (otherwise the fields are hidden and CITE ignores them), a weight for each category and a
 * value for each option. The API's numbers cannot be left out, so a question set, which hides its weight and values,
 * still carries them.
 */
export function isScoringModelValid(model: MselScoringModel): boolean {
  return (
    !!model?.description?.trim() &&
    (model.categories || []).every(
      (c) =>
        hasNumber(c.moveNumberFirstDisplay) &&
        hasNumber(c.moveNumberLastDisplay) &&
        (!model.displayScoringModelByMoveNumber || +c.moveNumberFirstDisplay <= +c.moveNumberLastDisplay) &&
        hasNumber(c.scoringWeight) &&
        (c.options || []).every((o) => hasNumber(o.value)),
    )
  );
}

/**
 * A question set hides its weight and its options' values, so a category becoming one keeps a number in each: a
 * missing weight counts once, as a new category does, and a missing value is a question's 1.
 */
export function fillHiddenNumbers(category: MselScoringCategory): void {
  if (!isQuestionCategory(category)) {
    return;
  }
  if (!hasNumber(category.scoringWeight)) {
    category.scoringWeight = 1;
  }
  for (const option of category.options || []) {
    if (!hasNumber(option.value)) {
      option.value = 1;
    }
  }
}

/** "Every move", "Move 2" or "Moves 1 to 3", for a category's move range. */
export function moveRangeLabel(category: MselScoringCategory, moveNumbers: number[]): string {
  const first = +category.moveNumberFirstDisplay;
  const last = +category.moveNumberLastDisplay;
  if (moveNumbers.length && first <= Math.min(...moveNumbers) && last >= Math.max(...moveNumbers)) {
    return 'Every move';
  }
  return first === last ? `Move ${first}` : `Moves ${first} to ${last}`;
}
