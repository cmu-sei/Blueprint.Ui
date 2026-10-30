// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { CiteScoringOptionSelection, MselScoringCategory, MselScoringModel } from 'src/app/generated/blueprint.api';
import { categoriesForMove, categoriesWithoutOptions, moveRangeLabel, normalizeScoringModel } from './scoring-model';

// Blueprint writes every int as a JSON string, so a model read from the API looks like this
const asRead = (n: number) => `${n}` as unknown as number;
const category = (description: string, first: number, last: number, extra: Partial<MselScoringCategory> = {}): MselScoringCategory => ({
  description,
  moveNumberFirstDisplay: first,
  moveNumberLastDisplay: last,
  scoringOptionSelection: CiteScoringOptionSelection.None,
  options: [{ description: 'q', value: 1 }],
  ...extra,
});

describe('normalizeScoringModel', () => {
  /**
   * Verifies: the display orders, move numbers, weights and values a model is read with become numbers, and the categories and options come in display order.
   * Interacts with: normalizeScoringModel.
   * Data: two categories read with string display orders 2 and 1; the second's options with display orders 2 and 1.
   */
  it('gives the numbers back as numbers, in display order', () => {
    const model: MselScoringModel = {
      description: 'Read',
      categories: [
        { ...category('Second', 2, 2), displayOrder: asRead(2), moveNumberFirstDisplay: asRead(2), moveNumberLastDisplay: asRead(2) },
        {
          ...category('First', 1, 1),
          displayOrder: asRead(1),
          scoringWeight: asRead(3),
          options: [
            { description: 'b', displayOrder: asRead(2), value: asRead(5) },
            { description: 'a', displayOrder: asRead(1), value: asRead(4) },
          ],
        },
      ],
    };

    const normalized = normalizeScoringModel(model);

    expect(normalized.categories.map((c) => c.description)).toEqual(['First', 'Second']);
    expect(normalized.categories[1].moveNumberFirstDisplay).toBe(2);
    expect(normalized.categories[0].scoringWeight).toBe(3);
    expect(normalized.categories[0].options.map((o) => [o.description, o.value])).toEqual([['a', 4], ['b', 5]]);
  });

  /**
   * Verifies: no model stays no model, and a model with no categories gets an empty list.
   * Interacts with: normalizeScoringModel.
   * Data: null; a model whose categories are null.
   */
  it('leaves no model alone and fills in no categories', () => {
    expect(normalizeScoringModel(null)).toBeNull();
    expect(normalizeScoringModel({ description: 'Empty', categories: null }).categories).toEqual([]);
  });
});

describe('categoriesForMove', () => {
  const model: MselScoringModel = {
    description: 'By move',
    displayScoringModelByMoveNumber: true,
    categories: [category('Move 1', 1, 1), category('Moves 1 to 3', 1, 3), category('Move 3', 3, 3)],
  };

  /**
   * Verifies: a model displayed by move shows a move the categories whose range holds it, as CITE's scoresheet does.
   * Interacts with: categoriesForMove.
   * Data: categories for move 1, moves 1 to 3 and move 3; moves 1, 2, 3 and 4.
   */
  it.each([
    { move: 1, shown: ['Move 1', 'Moves 1 to 3'] },
    { move: 2, shown: ['Moves 1 to 3'] },
    { move: 3, shown: ['Moves 1 to 3', 'Move 3'] },
    { move: 4, shown: [] },
  ])('shows move $move its categories', ({ move, shown }) => {
    expect(categoriesForMove(model, move).map((c) => c.description)).toEqual(shown);
  });

  /**
   * Verifies: a model not displayed by move shows every category in every move.
   * Interacts with: categoriesForMove.
   * Data: the same categories with displayScoringModelByMoveNumber off; move 4.
   */
  it('shows every category when the model is not displayed by move', () => {
    expect(categoriesForMove({ ...model, displayScoringModelByMoveNumber: false }, 4)).toHaveLength(3);
  });
});

describe('categoriesWithoutOptions', () => {
  /**
   * Verifies: the categories with no options are the ones that would reach CITE with nothing to answer.
   * Interacts with: categoriesWithoutOptions.
   * Data: one category with a question, one with none and one whose options are null.
   */
  it('finds the categories with nothing to answer', () => {
    const model: MselScoringModel = {
      description: 'Partly written',
      categories: [category('Written', 1, 1), category('Empty', 2, 2, { options: [] }), category('Null', 3, 3, { options: null })],
    };

    expect(categoriesWithoutOptions(model).map((c) => c.description)).toEqual(['Empty', 'Null']);
  });
});

describe('moveRangeLabel', () => {
  /**
   * Verifies: a range covering every move of the MSEL reads "Every move", otherwise it names its moves.
   * Interacts with: moveRangeLabel.
   * Data: a MSEL with moves 0, 1 and 2; ranges 0 to 999, 1 to 1 and 1 to 2; and a MSEL with no moves.
   */
  it.each([
    { first: 0, last: 999, moves: [0, 1, 2], label: 'Every move' },
    { first: 1, last: 1, moves: [0, 1, 2], label: 'Move 1' },
    { first: 1, last: 2, moves: [0, 1, 2], label: 'Moves 1 to 2' },
    { first: 1, last: 999, moves: [], label: 'Moves 1 to 999' },
  ])('labels $first to $last as $label', ({ first, last, moves, label }) => {
    expect(moveRangeLabel(category('c', first, last), moves)).toBe(label);
  });
});
