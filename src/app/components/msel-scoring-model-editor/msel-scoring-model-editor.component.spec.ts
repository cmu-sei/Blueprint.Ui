// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { MatSelectHarness } from '@angular/material/select/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { CiteRightSideDisplay, CiteScoringOptionSelection, MselScoringModel } from 'src/app/generated/blueprint.api';
import { renderComponent } from 'src/app/test-utils/render-component';
import { MselScoringModelEditorComponent, ScoringModelMove } from './msel-scoring-model-editor.component';

// as the API answers it: every int a string
const n = (value: number) => `${value}` as unknown as number;
const QUESTIONS: MselScoringModel = {
  mselId: 'msel-1',
  description: 'Harbor Questions by Move',
  calculationEquation: '{average}',
  displayCommentTextBoxes: true,
  displayScoringModelByMoveNumber: true,
  hideScoresOnScoreSheet: true,
  rightSideDisplay: CiteRightSideDisplay.Scoresheet,
  categories: [
    {
      id: 'cat-1', displayOrder: n(1), description: 'Please respond to the following discussion questions:',
      moveNumberFirstDisplay: n(1), moveNumberLastDisplay: n(1), scoringOptionSelection: CiteScoringOptionSelection.None,
      calculationEquation: '{max}', scoringWeight: 1,
      options: [{ id: 'opt-1', displayOrder: n(1), description: 'Who do you call first?', value: 1 }],
    },
    {
      id: 'cat-2', displayOrder: n(2), description: 'After-action review',
      moveNumberFirstDisplay: n(2), moveNumberLastDisplay: n(2), scoringOptionSelection: CiteScoringOptionSelection.None,
      calculationEquation: '{max}', scoringWeight: 1,
      options: [],
    },
  ],
};
// a scored model: one Single category, Fully Capable worth 1 and Degraded worth 5, scores shown
const IMPACT: MselScoringModel = {
  description: 'Impact', hideScoresOnScoreSheet: false, displayScoringModelByMoveNumber: false,
  categories: [{
    description: 'Mission Capability Impact', displayOrder: 1, moveNumberFirstDisplay: 1, moveNumberLastDisplay: 999,
    scoringOptionSelection: CiteScoringOptionSelection.Single, calculationEquation: '{max}', scoringWeight: 8,
    options: [{ description: 'Fully Capable', value: 1 }, { description: 'Degraded', value: 5 }],
  }],
};
const MOVES: ScoringModelMove[] = [{ moveNumber: 1, description: 'Initial access' }, { moveNumber: 2, description: 'Recovery' }];

async function renderEditor(overrides: { model?: MselScoringModel; canEdit?: boolean; moves?: ScoringModelMove[] } = {}) {
  const { model = QUESTIONS, canEdit = true, moves = MOVES } = overrides;
  const working = structuredClone(model);
  const rendered = await renderComponent(MselScoringModelEditorComponent, { inputs: { model: working, moves, canEdit } });
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();
  return { ...rendered, working };
}

const preview = () => screen.getByRole('complementary', { name: 'Scoresheet preview' });
const category = (index: number) => screen.getByRole('group', { name: `Category ${index}` });

describe('MselScoringModelEditorComponent', () => {
  /**
   * Verifies: the editor shows the model's settings and categories, a question set's categories without weights or equations, and its questions.
   * Interacts with: the editor sections, isQuestionCategory.
   * Data: QUESTIONS, a questions-by-move model with a category for move 1 holding one question and an empty one for move 2.
   */
  it('shows a question set as questions, without weights or equations', async () => {
    await renderEditor();

    expect(screen.getByLabelText('Scoring Model Description')).toHaveValue('Harbor Questions by Move');
    expect(screen.getByRole('checkbox', { name: 'Display Comments as Textboxes' })).toBeChecked();
    expect(within(category(1)).getByText('Move 1')).toBeInTheDocument();
    expect(within(category(1)).getByLabelText('Question')).toHaveValue('Who do you call first?');
    expect(within(category(1)).queryByLabelText('Calculation Weight')).not.toBeInTheDocument();
    expect(within(category(2)).getByText('No questions yet.')).toBeInTheDocument();
    expect(within(category(2)).getByRole('button', { name: 'Add Question' })).toBeInTheDocument();
  });

  /**
   * Verifies: the preview shows a team the categories of the chosen move, its questions numbered with a comment box under each.
   * Interacts with: categoriesForMove, the Preview Move select (MatSelectHarness).
   * Data: QUESTIONS; move 1, then move 2.
   */
  it('previews what a team sees in each move', async () => {
    const { fixture } = await renderEditor();

    expect(within(preview()).getByText('1. Please respond to the following discussion questions:')).toBeInTheDocument();
    expect(within(preview()).getByText('Who do you call first?')).toBeInTheDocument();
    expect(within(preview()).getAllByText('Comment')).toHaveLength(1);
    expect(within(preview()).queryByText(/After-action review/)).not.toBeInTheDocument();

    const select = await TestbedHarnessEnvironment.loader(fixture).getHarness(MatSelectHarness.with({ ancestor: '.preview-move' }));
    await select.open();
    await select.clickOptions({ text: 'Move 2 - Recovery' });
    fixture.detectChanges();

    expect(within(preview()).getByText('1. After-action review')).toBeInTheDocument();
    expect(within(preview()).queryByText('Who do you call first?')).not.toBeInTheDocument();
  });

  /**
   * Verifies: the editor column and the What a Team Sees preview are each a scrolling region, so one scrolls without the other.
   * Interacts with: the .editor and .preview panes' classes; the layout itself is checked by eye in the app.
   * Data: QUESTIONS.
   */
  it('scrolls the editor and the preview independently', async () => {
    const { fixture } = await renderEditor();

    expect(fixture.nativeElement.querySelector('.editor')).toHaveClass('scrolling-region');
    expect(preview()).toHaveClass('scrolling-region');
  });

  /**
   * Verifies: a scored category shows its weight, equation and option values, and the preview shows the values unless they are hidden.
   * Interacts with: isQuestionCategory, the preview's value column.
   * Data: IMPACT.
   */
  it('shows a scored category with its weights and values', async () => {
    await renderEditor({ model: IMPACT });

    expect(within(category(1)).getByLabelText('Calculation Weight')).toHaveValue(8);
    expect(within(category(1)).getAllByLabelText('Scoring Option Description')).toHaveLength(2);
    expect(within(preview()).getByText('For All Moves')).toBeInTheDocument();
    expect(within(preview()).getByText('5')).toBeInTheDocument();
  });

  /**
   * Verifies: a scored category's weight is required, and saying so takes the place of the cleared number.
   * Interacts with: the Calculation Weight field's required validator and mat-error.
   * Data: IMPACT, its weight cleared.
   */
  it('requires a weight', async () => {
    const { fixture, working } = await renderEditor({ model: IMPACT });
    const user = userEvent.setup();

    await user.clear(within(category(1)).getByLabelText(/Calculation Weight/));
    await user.tab();
    fixture.detectChanges();

    expect(working.categories[0].scoringWeight).toBeNull();
    expect(within(category(1)).getByText('A weight is required.')).toBeInTheDocument();
  });

  /**
   * Verifies: a category made a question set, which hides its weight and values, keeps a weight of 1 for the one it lost, and the values it had.
   * Interacts with: the Scoring Option Selection Type select (MatSelectHarness), fillHiddenNumbers.
   * Data: IMPACT, its weight cleared, then made None.
   */
  it('keeps a weight when a category becomes a question set', async () => {
    const { fixture, working } = await renderEditor({ model: IMPACT });
    const user = userEvent.setup();

    await user.clear(within(category(1)).getByLabelText(/Calculation Weight/));
    const selection = await TestbedHarnessEnvironment.loader(fixture).getHarness(MatSelectHarness.with({ ancestor: '.selection-field' }));
    await selection.open();
    await selection.clickOptions({ text: 'None' });

    expect(working.categories[0].scoringOptionSelection).toBe(CiteScoringOptionSelection.None);
    expect(working.categories[0].scoringWeight).toBe(1);
    expect(working.categories[0].options.map((o) => o.value)).toEqual([1, 5]);
  });

  /**
   * Verifies: the editor changes the model it was given, in place: a question added and the categories reordered.
   * Interacts with: Add Question, Move Category Down, the model input.
   * Data: QUESTIONS; a question added to the after-action review, which is then moved first.
   */
  it('edits the model in place, in the order shown', async () => {
    const { working } = await renderEditor();
    const user = userEvent.setup();

    await user.click(within(category(2)).getByRole('button', { name: 'Add Question' }));
    await user.type(within(category(2)).getByLabelText('Question'), 'What went well?');
    await user.click(within(category(1)).getByRole('button', { name: 'Move Category Down' }));

    expect(working.categories.map((c) => c.description)).toEqual(['After-action review', 'Please respond to the following discussion questions:']);
    expect(working.categories[0].options.map((o) => o.description)).toEqual(['What went well?']);
  });

  /**
   * Verifies: a category whose last move comes before its first is called out.
   * Interacts with: the category's move fields.
   * Data: QUESTIONS with category 1's last move set to 0.
   */
  it('calls out a category whose last move comes before its first', async () => {
    await renderEditor();
    const user = userEvent.setup();

    await user.clear(within(category(1)).getByLabelText('Last Move to Display'));
    await user.type(within(category(1)).getByLabelText('Last Move to Display'), '0');

    expect(within(category(1)).getByRole('alert')).toHaveTextContent('The last move to display comes before the first.');
  });

  /**
   * Verifies: a MSEL without moves still previews, by the moves its categories name.
   * Interacts with: previewMoveNumbers.
   * Data: QUESTIONS with no moves.
   */
  it('previews by the moves the categories name when the MSEL has none', async () => {
    const { fixture } = await renderEditor({ moves: [] });

    const select = await TestbedHarnessEnvironment.loader(fixture).getHarness(MatSelectHarness.with({ ancestor: '.preview-move' }));
    await select.open();
    expect(await Promise.all((await select.getOptions()).map((o) => o.getText()))).toEqual(['Move 1', 'Move 2']);
  });

  /**
   * Verifies: someone who may not edit sees the model read-only, with no editing buttons.
   * Interacts with: canEdit.
   * Data: QUESTIONS; canEdit false.
   */
  it('is read-only for someone who may not edit', async () => {
    await renderEditor({ canEdit: false });

    expect(screen.getByLabelText('Scoring Model Description')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Add Category' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add Question' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete Category' })).not.toBeInTheDocument();
  });

  /**
   * Verifies: every model, category and option checkbox explains what it does to the team's scoresheet in CITE.
   * Interacts with: matTooltip on the mat-checkbox hosts (accessible description, set in a microtask).
   * Data: IMPACT, whose scored category shows the modifier checkboxes.
   */
  it('explains each checkbox in its tooltip', async () => {
    await renderEditor({ model: IMPACT });

    const host = (name: string) => screen.getByRole('checkbox', { name }).closest('mat-checkbox');
    expect(host('Use Individual User Scoring')).toHaveAccessibleDescription('Each team member fills in their own scoresheet and gets a personal score.');
    expect(host('Use Team Scoring')).toHaveAccessibleDescription('The team fills in one shared scoresheet and submits a single team score.');
    expect(host('Use Official Scoring')).toHaveAccessibleDescription(
      'Teams or users authorized in CITE fill in an official score, how the incident would really score, that the team scores are compared against.',
    );
    expect(host('Use Team Average Scoring')).toHaveAccessibleDescription("Shows each team the average of its members' individual scores; needs Use Individual User Scoring.");
    expect(host('Use Type Average Scoring')).toHaveAccessibleDescription('Shows the average of the team scores across all teams of the same team type; needs Use Team Scoring.');
    expect(host('Use Submit Button for Submissions')).toHaveAccessibleDescription(
      'The team clicks Submit to finish its response to each move; without it, selections are saved as they are made.',
    );
    expect(host('Hide Option Values On Scoresheet')).toHaveAccessibleDescription("Hides each option's point value and the computed score from the team's scoresheet.");
    expect(host('Display Comments as Textboxes')).toHaveAccessibleDescription('Puts a comment textbox under every option, instead of an Add Comment button that opens one.');
    expect(host('Use Different Scoring Categories by Move Number')).toHaveAccessibleDescription(
      'Shows each category only in the moves from its First Move to Display through its Last Move to Display, instead of in every move.',
    );
    expect(host('Show Past Situation Descriptions on Dashboard')).toHaveAccessibleDescription(
      'The CITE dashboard lists the situation descriptions of the earlier moves under the current one.',
    );
    expect(host('Modifier Selection Required')).toHaveAccessibleDescription(
      "The team must pick one of this category's modifier options; until it does, {modifier} is 0 in the equation instead of 1.",
    );
    expect(screen.getAllByRole('checkbox', { name: 'Is a Modifier' })[0].closest('mat-checkbox')).toHaveAccessibleDescription(
      "Makes this option the category's {modifier} value instead of a scored option; a team picks at most one modifier, and it does not count toward {sum}, {count}, {min} or {max}.",
    );
  });
});
