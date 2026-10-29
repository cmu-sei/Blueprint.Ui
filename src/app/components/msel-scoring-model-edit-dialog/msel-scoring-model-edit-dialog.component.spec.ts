// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSelectHarness } from '@angular/material/select/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, throwError } from 'rxjs';
import {
  CiteRightSideDisplay,
  CiteScoringOptionSelection,
  MselScoringModel,
  MselScoringModelService,
} from 'src/app/generated/blueprint.api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { MselScoringModelEditDialogComponent, MselScoringModelEditDialogData } from './msel-scoring-model-edit-dialog.component';

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
const MOVES = [{ moveNumber: 1, description: 'Initial access' }, { moveNumber: 2, description: 'Recovery' }];

async function renderDialog(overrides: { model?: MselScoringModel; canEdit?: boolean; replace?: () => ReturnType<MselScoringModelService['replaceMselScoringModel']> } = {}) {
  const { model = QUESTIONS, canEdit = true } = overrides;
  const ref = dialogRefStub<MselScoringModelEditDialogComponent, MselScoringModel>();
  const scoringModelApi = {
    replaceMselScoringModel: vi.fn(overrides.replace ?? ((_id: string, body: MselScoringModel) => of(structuredClone(body)))),
  } satisfies ApiStub<MselScoringModelService>;
  const data: MselScoringModelEditDialogData = { mselId: 'msel-1', scoringModel: structuredClone(model), moves: MOVES, canEdit };
  const rendered = await renderComponent(MselScoringModelEditDialogComponent, {
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: ref.dialogRef },
      { provide: MselScoringModelService, useValue: scoringModelApi },
    ],
  });
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();
  return { ...rendered, close: ref.close, scoringModelApi, data };
}

const preview = () => screen.getByRole('complementary', { name: 'Scoresheet preview' });
const category = (index: number) => screen.getByRole('group', { name: `Category ${index}` });

describe('MselScoringModelEditDialogComponent', () => {
  /**
   * Verifies: the editor shows the model's settings and categories, a question set's categories without weights or equations, and its questions.
   * Interacts with: the editor sections, isQuestionCategory.
   * Data: QUESTIONS, a questions-by-move model with a category for move 1 holding one question and an empty one for move 2.
   */
  it('shows a question set as questions, without weights or equations', async () => {
    await renderDialog();

    expect(screen.getByRole('heading', { name: 'Edit Scoring Model' })).toBeInTheDocument();
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
    const { fixture } = await renderDialog();

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
   * Verifies: a scored category shows its weight, equation and option values, and the preview shows the values unless they are hidden.
   * Interacts with: isQuestionCategory, the preview's value column.
   * Data: a model with one Single category, Fully Capable worth 1 and Degraded worth 5, scores shown.
   */
  it('shows a scored category with its weights and values', async () => {
    await renderDialog({
      model: {
        description: 'Impact', hideScoresOnScoreSheet: false, displayScoringModelByMoveNumber: false,
        categories: [{
          description: 'Mission Capability Impact', displayOrder: 1, moveNumberFirstDisplay: 1, moveNumberLastDisplay: 999,
          scoringOptionSelection: CiteScoringOptionSelection.Single, calculationEquation: '{max}', scoringWeight: 8,
          options: [{ description: 'Fully Capable', value: 1 }, { description: 'Degraded', value: 5 }],
        }],
      },
    });

    expect(within(category(1)).getByLabelText('Calculation Weight')).toHaveValue(8);
    expect(within(category(1)).getAllByLabelText('Scoring Option Description')).toHaveLength(2);
    expect(within(preview()).getByText('For All Moves')).toBeInTheDocument();
    expect(within(preview()).getByText('5')).toBeInTheDocument();
  });

  /**
   * Verifies: Save sends the edited model, with a new question and the categories in their new order, and closes with what the API stored.
   * Interacts with: Add Question, Move Category Down, MselScoringModelService.replaceMselScoringModel (stub), MatDialogRef.close (stub).
   * Data: QUESTIONS; a question added to the after-action review, which is then moved first.
   */
  it('saves the edited model in the order shown', async () => {
    const { close, scoringModelApi } = await renderDialog();
    const user = userEvent.setup();

    await user.click(within(category(2)).getByRole('button', { name: 'Add Question' }));
    await user.type(within(category(2)).getByLabelText('Question'), 'What went well?');
    await user.click(within(category(1)).getByRole('button', { name: 'Move Category Down' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(scoringModelApi.replaceMselScoringModel).toHaveBeenCalledTimes(1);
    const [mselId, sent] = scoringModelApi.replaceMselScoringModel.mock.calls[0];
    expect(mselId).toBe('msel-1');
    expect(sent.categories.map((c) => c.description)).toEqual(['After-action review', 'Please respond to the following discussion questions:']);
    expect(sent.categories[0].options.map((o) => o.description)).toEqual(['What went well?']);
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ description: 'Harbor Questions by Move' }));
  });

  /**
   * Verifies: Cancel closes without saving, and the opener's model is not changed by the edits.
   * Interacts with: crucible-dialog cancel, MatDialogRef.close (stub).
   * Data: QUESTIONS; the description cleared before Cancel.
   */
  it('cancels without saving or changing the opener model', async () => {
    const { close, scoringModelApi, data } = await renderDialog();
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText('Scoring Model Description'));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(scoringModelApi.replaceMselScoringModel).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledWith();
    expect(data.scoringModel.description).toBe('Harbor Questions by Move');
  });

  /**
   * Verifies: Save is disabled for a model with no description.
   * Interacts with: isValid.
   * Data: QUESTIONS with no description.
   */
  it('refuses a model with no description', async () => {
    await renderDialog({ model: { ...QUESTIONS, description: '' } });

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  /**
   * Verifies: a category whose last move comes before its first is called out, and Save is disabled.
   * Interacts with: isValid, the category's move fields.
   * Data: QUESTIONS with category 1's last move set to 0.
   */
  it('calls out a category whose last move comes before its first', async () => {
    await renderDialog();
    const user = userEvent.setup();

    await user.clear(within(category(1)).getByLabelText('Last Move to Display'));
    await user.type(within(category(1)).getByLabelText('Last Move to Display'), '0');

    expect(within(category(1)).getByRole('alert')).toHaveTextContent('The last move to display comes before the first.');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  /**
   * Verifies: a refused save keeps the dialog open with the API's reason.
   * Interacts with: MselScoringModelService.replaceMselScoringModel (stub, 409), crucible-dialog errorMessage.
   * Data: QUESTIONS; the API answers that the MSEL is pushed.
   */
  it('shows why a save was refused', async () => {
    const { close } = await renderDialog({
      replace: () => throwError(() => new HttpErrorResponse({ status: 409, error: { title: 'The scoring model cannot be changed while the MSEL is pushed.' } })),
    });

    await userEvent.setup().click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByRole('alert')).toHaveTextContent('The scoring model cannot be changed while the MSEL is pushed.');
    expect(close).not.toHaveBeenCalled();
  });

  /**
   * Verifies: someone who may not edit sees the model read-only, with Close and no editing buttons.
   * Interacts with: canEdit.
   * Data: QUESTIONS; canEdit false.
   */
  it('is read-only for someone who may not edit', async () => {
    await renderDialog({ canEdit: false });

    expect(screen.getByRole('heading', { name: 'View Scoring Model' })).toBeInTheDocument();
    expect(screen.getByLabelText('Scoring Model Description')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Add Category' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add Question' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });
});
