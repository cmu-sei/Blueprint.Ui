// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';
import { MatSelectHarness } from '@angular/material/select/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, throwError } from 'rxjs';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import {
  CiteScoringOptionSelection,
  MselScoringModel,
  MselScoringModelService,
  ScoringModel,
} from 'src/app/generated/blueprint.api';
import { MoveStore } from 'src/app/data/move/move.store';
import { ErrorService } from 'src/app/services/error/error.service';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { recordEmissions } from 'src/app/test-utils/record-emissions';
import { renderComponent } from 'src/app/test-utils/render-component';
import { CITE_ACCESS_DENIED } from 'src/app/utilities/cite-access';
import { MselScoringModelEditorComponent } from '../msel-scoring-model-editor/msel-scoring-model-editor.component';
import { MselScoringModelComponent } from './msel-scoring-model.component';

const n = (value: number) => `${value}` as unknown as number;
const AUTHORED: MselScoringModel = {
  mselId: 'msel-1',
  description: 'Harbor Questions',
  displayScoringModelByMoveNumber: true,
  categories: [
    {
      id: 'cat-1', displayOrder: 1, description: 'Move 1', moveNumberFirstDisplay: 1, moveNumberLastDisplay: 1, scoringWeight: 1,
      scoringOptionSelection: CiteScoringOptionSelection.None, options: [{ id: 'opt-1', displayOrder: 1, description: 'Who calls?', value: 1 }],
    },
    { id: 'cat-2', displayOrder: 2, description: 'Move 2', moveNumberFirstDisplay: 2, moveNumberLastDisplay: 2, scoringWeight: 1, scoringOptionSelection: CiteScoringOptionSelection.None, options: [] },
  ],
};
// as the API answers it, every int a string
const CREATED: MselScoringModel = { mselId: 'msel-1', description: 'CISA NCISS', categories: [{ id: 'cat-9', displayOrder: n(1), description: 'Functional Impact', moveNumberFirstDisplay: n(0), moveNumberLastDisplay: n(999), options: [] }] };
const CITE_MODELS: ScoringModel[] = [{ id: 'cite-1', description: 'Project Lagoon Questions by Move' }];

async function renderScoringModel(
  overrides: {
    scoringModel?: MselScoringModel | null;
    canEdit?: boolean;
    confirmed?: boolean;
    failing?: boolean;
    replace?: () => ReturnType<MselScoringModelService['replaceMselScoringModel']>;
  } = {},
) {
  const { scoringModel = null, canEdit = true, confirmed = true, failing = false } = overrides;
  const answer = () => (failing ? throwError(() => new Error('refused')) : of(structuredClone(CREATED)));
  const scoringModelApi = {
    createMselScoringModelFromPreset: vi.fn(answer),
    copyMselScoringModelFromCite: vi.fn(answer),
    replaceMselScoringModel: vi.fn(overrides.replace ?? ((_id: string, body: MselScoringModel) => of(structuredClone(body)))),
  } satisfies ApiStub<MselScoringModelService>;
  const confirm = vi.fn(() => dialogRefStub<unknown, boolean>(confirmed).dialogRef);
  const errorService = { handleError: vi.fn() };
  const rendered = await renderComponent(MselScoringModelComponent, {
    providers: [
      { provide: MselScoringModelService, useValue: scoringModelApi },
      { provide: CrucibleDialogService, useValue: { confirm } satisfies Pick<CrucibleDialogService, 'confirm'> },
      { provide: ErrorService, useValue: errorService },
      {
        provide: MoveStore,
        useFactory: () => {
          const store = new MoveStore();
          store.set([
            { id: 'move-2', mselId: 'msel-1', moveNumber: n(2), description: 'Recovery' },
            { id: 'move-1', mselId: 'msel-1', moveNumber: n(1), description: 'Initial access' },
            { id: 'move-x', mselId: 'msel-other', moveNumber: 7, description: 'Elsewhere' },
          ]);
          return store;
        },
      },
    ],
    inputs: { mselId: 'msel-1', scoringModel: scoringModel ? structuredClone(scoringModel) : null, canEdit, citeScoringModels: CITE_MODELS },
  });
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();
  const changes = recordEmissions(outputToObservable(rendered.fixture.componentInstance.scoringModelChange));
  return { ...rendered, scoringModelApi, confirm, errorService, changes };
}

async function startFrom(fixture: ComponentFixture<unknown>, text: string) {
  const select = await TestbedHarnessEnvironment.loader(fixture).getHarness(MatSelectHarness.with({ ancestor: '.start-from' }));
  await select.open();
  return select.clickOptions({ text });
}

const category = (index: number) => screen.getByRole('group', { name: `Category ${index}` });
const save = () => screen.getByRole('button', { name: 'Save' });
const discard = () => screen.getByRole('button', { name: 'Discard' });

describe('MselScoringModelComponent', () => {
  /**
   * Verifies: a MSEL with no model of its own offers the four presets and a copy of each CITE model, and Create waits for a choice.
   * Interacts with: SCORING_MODEL_PRESETS, the Start From select (MatSelectHarness).
   * Data: no authored model; the CITE model Project Lagoon Questions by Move.
   */
  it('offers the presets and the CITE models to start from', async () => {
    const { fixture } = await renderScoringModel();

    expect(screen.getByRole('button', { name: 'Create Scoring Model' })).toBeDisabled();
    expect(screen.queryByLabelText('Scoring Model Description')).not.toBeInTheDocument();
    const select = await TestbedHarnessEnvironment.loader(fixture).getHarness(MatSelectHarness);
    await select.open();
    const options = await select.getOptions();
    expect(await Promise.all(options.map((o) => o.getText()))).toEqual([
      'Questions by Move',
      'DoD CTT Mission Impact Assessment',
      'DoD CTT Likelihood Assessment Matrix',
      'CISA NCISS',
      'Project Lagoon Questions by Move',
    ]);
  });

  /**
   * Verifies: a chosen preset's description shows under Start From in a hint that grows the field, so a long one pushes the
   * summary down rather than running over it.
   * Interacts with: the Start From select (MatSelectHarness), mat-hint, subscriptSizing.
   * Data: the Questions by Move preset, whose hint is two lines in a narrow field.
   */
  it('shows the preset description in a hint that grows the field', async () => {
    const { fixture } = await renderScoringModel();
    const select = await TestbedHarnessEnvironment.loader(fixture).getHarness(MatSelectHarness);

    await select.open();
    await select.clickOptions({ text: 'Questions by Move' });
    fixture.detectChanges();

    expect(screen.getByText(/Discussion questions for each move/)).toBeInTheDocument();
    const field = fixture.nativeElement.querySelector('mat-form-field.start-from') as HTMLElement;
    expect(field.querySelector('.mat-mdc-form-field-subscript-dynamic-size')).not.toBeNull();
  });

  /**
   * Verifies: creating from a preset asks the API for it, reports the model with its numbers as numbers, and opens it in the editor at once.
   * Interacts with: MselScoringModelService.createMselScoringModelFromPreset (stub), scoringModelChange, app-msel-scoring-model-editor.
   * Data: no authored model; the CISA NCISS preset, which the API answers with string display orders.
   */
  it('creates the model from a preset and edits it inline', async () => {
    const { fixture, scoringModelApi, changes } = await renderScoringModel();

    await startFrom(fixture, 'CISA NCISS');
    expect(screen.getByText(/eight weighted factors/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Create Scoring Model' }));
    fixture.detectChanges();

    expect(scoringModelApi.createMselScoringModelFromPreset).toHaveBeenCalledWith('msel-1', 'Nciss');
    expect(changes[0].categories[0].moveNumberLastDisplay).toBe(999);
    expect(screen.getByLabelText('Scoring Model Description')).toHaveValue('CISA NCISS');
    expect(save()).toBeDisabled();
  });

  /**
   * Verifies: choosing a CITE model copies it to be the MSEL's own.
   * Interacts with: MselScoringModelService.copyMselScoringModelFromCite (stub).
   * Data: no authored model; the CITE model cite-1.
   */
  it('copies a CITE scoring model', async () => {
    const { fixture, scoringModelApi } = await renderScoringModel();

    await startFrom(fixture, 'Project Lagoon Questions by Move');
    expect(screen.getByText(/The CITE scoring model itself is not changed/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Create Scoring Model' }));

    expect(scoringModelApi.copyMselScoringModelFromCite).toHaveBeenCalledWith('msel-1', 'cite-1');
  });

  /**
   * Verifies: the move picked in What a Team Sees stays picked through later edits: the MSEL's moves reach the editor as the same list each change detection, so the editor does not go back to the first move.
   * Interacts with: mselMoves (computed), the editor's preview move select (MatSelectHarness), the description field.
   * Data: AUTHORED; this MSEL's moves 1 and 2; Move 2 picked, then the description typed in.
   */
  it('keeps the previewed move through later edits', async () => {
    const { fixture } = await renderScoringModel({ scoringModel: AUTHORED });
    const select = await TestbedHarnessEnvironment.loader(fixture).getHarness(MatSelectHarness.with({ ancestor: '.preview-move' }));

    await select.open();
    await select.clickOptions({ text: 'Move 2 - Recovery' });
    await userEvent.setup().type(screen.getByLabelText('Scoring Model Description'), ' edited');
    // ngModel writes the select's value a microtask after change detection
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.directive(MselScoringModelEditorComponent)).componentInstance.previewMoveNumber).toBe(2);
    expect(await select.getValueText()).toBe('Move 2 - Recovery');
  });

  /**
   * Verifies: when CITE will not let the user read the model to copy, a dialog gives the API's reason instead of the error report, and nothing is created.
   * Interacts with: MselScoringModelService.copyMselScoringModelFromCite (stub, 403 with the CITE access denied problem type), CrucibleDialogService.confirm (stub), ErrorService.handleError (stub).
   * Data: no authored model; the CITE model cite-1, which CITE shows the user only as a participant.
   */
  it('explains in a dialog when CITE refuses the copy', async () => {
    const { fixture, scoringModelApi, confirm, errorService, changes } = await renderScoringModel();
    const reason = 'You can view the CITE scoring model "Project Lagoon Questions by Move" only as a participant, without its equations and weights.';
    scoringModelApi.copyMselScoringModelFromCite.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 403, error: { type: CITE_ACCESS_DENIED, title: reason } })));

    await startFrom(fixture, 'Project Lagoon Questions by Move');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Create Scoring Model' }));

    expect(confirm).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ title: 'CITE Access Denied', message: reason, cancelText: 'OK' }));
    expect(errorService.handleError).not.toHaveBeenCalled();
    expect(changes).toEqual([]);
  });

  /**
   * Verifies: a 403 that is Blueprint's own, with no CITE problem type, goes to the error report as before.
   * Interacts with: MselScoringModelService.copyMselScoringModelFromCite (stub, plain 403), CrucibleDialogService.confirm (stub), ErrorService.handleError (stub).
   * Data: no authored model; the CITE model cite-1.
   */
  it('reports a refusal of Blueprint\'s own as any other error', async () => {
    const { fixture, scoringModelApi, confirm, errorService } = await renderScoringModel();
    scoringModelApi.copyMselScoringModelFromCite.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 403, error: { title: 'Insufficient Permissions' } })));

    await startFrom(fixture, 'Project Lagoon Questions by Move');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Create Scoring Model' }));

    expect(confirm).not.toHaveBeenCalled();
    expect(errorService.handleError).toHaveBeenCalled();
  });

  /**
   * Verifies: the MSEL's model is summarized and shown in the editor with this MSEL's moves, with a warning for the categories still without questions.
   * Interacts with: summary, emptyCategoryWarning, MoveQuery, app-msel-scoring-model-editor.
   * Data: AUTHORED, two categories of which move 2's has no questions; moves 2 and 1 of this MSEL as the API sends them, and move 7 of another.
   */
  it('summarizes the model, warns of empty categories and edits it with the MSEL moves', async () => {
    const { fixture } = await renderScoringModel({ scoringModel: AUTHORED });

    expect(screen.getByText('Harbor Questions')).toBeInTheDocument();
    expect(screen.getByText('2 categories, 1 option')).toBeInTheDocument();
    expect(screen.getByText('** 1 scoring category has no questions or options yet **')).toBeInTheDocument();
    expect(screen.getByLabelText('Scoring Model Description')).toHaveValue('Harbor Questions');
    const select = await TestbedHarnessEnvironment.loader(fixture).getHarness(MatSelectHarness.with({ ancestor: '.preview-move' }));
    await select.open();
    expect(await Promise.all((await select.getOptions()).map((o) => o.getText()))).toEqual(['Move 1 - Initial access', 'Move 2 - Recovery']);
  });

  /**
   * Verifies: Save sends the edited model, with a new question and the categories in their new order, through the same endpoint the editor dialog used, and reports what the API stored.
   * Interacts with: Add Question, Move Category Down, MselScoringModelService.replaceMselScoringModel (stub), scoringModelChange, isDirty.
   * Data: AUTHORED; a question added to move 2's category, which is then moved first.
   */
  it('saves the edited model in the order shown', async () => {
    const { fixture, scoringModelApi, changes } = await renderScoringModel({ scoringModel: AUTHORED });
    const user = userEvent.setup();
    expect(save()).toBeDisabled();

    await user.click(within(category(2)).getByRole('button', { name: 'Add Question' }));
    await user.type(within(category(2)).getByLabelText('Question'), 'What went well?');
    await user.click(within(category(1)).getByRole('button', { name: 'Move Category Down' }));
    fixture.detectChanges();
    expect(screen.getByText('Changes have not been saved!')).toBeInTheDocument();
    expect(screen.getByText('2 categories, 2 options')).toBeInTheDocument();
    await user.click(save());
    fixture.detectChanges();

    expect(scoringModelApi.replaceMselScoringModel).toHaveBeenCalledTimes(1);
    const [mselId, sent] = scoringModelApi.replaceMselScoringModel.mock.calls[0];
    expect(mselId).toBe('msel-1');
    expect(sent.categories.map((c) => c.description)).toEqual(['Move 2', 'Move 1']);
    expect(sent.categories[0].options.map((o) => o.description)).toEqual(['What went well?']);
    expect(changes).toEqual([expect.objectContaining({ description: 'Harbor Questions' })]);
    expect(screen.queryByText('Changes have not been saved!')).not.toBeInTheDocument();
  });

  /**
   * Verifies: Discard puts the saved model back without saving, and nothing is reported.
   * Interacts with: discard, MselScoringModelService.replaceMselScoringModel (stub), scoringModelChange.
   * Data: AUTHORED; the description cleared before Discard.
   */
  it('discards the edits without saving', async () => {
    const { fixture, scoringModelApi, changes } = await renderScoringModel({ scoringModel: AUTHORED });
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText('Scoring Model Description'));
    fixture.detectChanges();
    expect(save()).toBeDisabled();
    await user.click(discard());
    fixture.detectChanges();

    expect(screen.getByLabelText('Scoring Model Description')).toHaveValue('Harbor Questions');
    expect(discard()).toBeDisabled();
    expect(scoringModelApi.replaceMselScoringModel).not.toHaveBeenCalled();
    expect(changes).toEqual([]);
  });

  /**
   * Verifies: a refused save keeps the edits up with the API's reason.
   * Interacts with: MselScoringModelService.replaceMselScoringModel (stub, 409), the alert.
   * Data: AUTHORED with its description changed; the API answers that the MSEL is pushed.
   */
  it('shows why a save was refused', async () => {
    const { fixture, changes } = await renderScoringModel({
      scoringModel: AUTHORED,
      replace: () => throwError(() => new HttpErrorResponse({ status: 409, error: { title: 'The scoring model cannot be changed while the MSEL is pushed.' } })),
    });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Scoring Model Description'), ' v2');
    await user.click(save());
    fixture.detectChanges();

    expect(screen.getByRole('alert')).toHaveTextContent('The scoring model cannot be changed while the MSEL is pushed.');
    expect(screen.getByLabelText('Scoring Model Description')).toHaveValue('Harbor Questions v2');
    expect(changes).toEqual([]);
  });

  /**
   * Verifies: replacing the model asks first, and a declined replacement changes nothing.
   * Interacts with: CrucibleDialogService.confirm (stub, declines), MselScoringModelService.createMselScoringModelFromPreset (stub).
   * Data: AUTHORED; the DoD CTT Mission Impact Assessment preset.
   */
  it('asks before replacing the model', async () => {
    const { fixture, confirm, scoringModelApi } = await renderScoringModel({ scoringModel: AUTHORED, confirmed: false });

    await startFrom(fixture, 'DoD CTT Mission Impact Assessment');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Replace Scoring Model' }));

    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Replace Scoring Model',
      message: 'Replace "Harbor Questions" with DoD CTT Mission Impact Assessment? Its categories and options are discarded.',
    }));
    expect(scoringModelApi.createMselScoringModelFromPreset).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Scoring Model Description')).toHaveValue('Harbor Questions');
  });

  /**
   * Verifies: a refused create is reported and nothing is shown or reported.
   * Interacts with: ErrorService.handleError (stub), scoringModelChange.
   * Data: no authored model; the API refuses the Questions by Move preset.
   */
  it('reports a refused create', async () => {
    const { fixture, errorService, changes } = await renderScoringModel({ failing: true });

    await startFrom(fixture, 'Questions by Move');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Create Scoring Model' }));

    expect(errorService.handleError).toHaveBeenCalled();
    expect(screen.queryByLabelText('Scoring Model Description')).not.toBeInTheDocument();
    expect(changes).toEqual([]);
  });

  /**
   * Verifies: someone who may not edit sees the model read-only, with no Save, Discard, Create or Replace.
   * Interacts with: canEdit, app-msel-scoring-model-editor canEdit.
   * Data: AUTHORED; canEdit false.
   */
  it('lets someone who may not edit only view the model', async () => {
    await renderScoringModel({ scoringModel: AUTHORED, canEdit: false });

    expect(screen.queryByRole('button', { name: /Replace Scoring Model|Create Scoring Model|Save|Discard/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Scoring Model Description')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Add Category' })).not.toBeInTheDocument();
  });

  it('says so when there is no model and it may not be edited', async () => {
    await renderScoringModel({ canEdit: false });

    expect(screen.getByText('No scoring model has been authored for this MSEL.')).toBeInTheDocument();
  });
});
