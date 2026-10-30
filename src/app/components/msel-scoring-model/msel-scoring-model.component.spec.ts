// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { MatDialog } from '@angular/material/dialog';
import { MatSelectHarness } from '@angular/material/select/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture } from '@angular/core/testing';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { screen } from '@testing-library/angular';
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
import { MselScoringModelEditDialogComponent } from '../msel-scoring-model-edit-dialog/msel-scoring-model-edit-dialog.component';
import { MselScoringModelComponent } from './msel-scoring-model.component';

const n = (value: number) => `${value}` as unknown as number;
const AUTHORED: MselScoringModel = {
  mselId: 'msel-1',
  description: 'Harbor Questions',
  displayScoringModelByMoveNumber: true,
  categories: [
    {
      id: 'cat-1', displayOrder: 1, description: 'Move 1', moveNumberFirstDisplay: 1, moveNumberLastDisplay: 1,
      scoringOptionSelection: CiteScoringOptionSelection.None, options: [{ id: 'opt-1', displayOrder: 1, description: 'Who calls?', value: 1 }],
    },
    { id: 'cat-2', displayOrder: 2, description: 'Move 2', moveNumberFirstDisplay: 2, moveNumberLastDisplay: 2, scoringOptionSelection: CiteScoringOptionSelection.None, options: [] },
  ],
};
// as the API answers it, every int a string
const CREATED: MselScoringModel = { mselId: 'msel-1', description: 'CISA NCISS', categories: [{ id: 'cat-9', displayOrder: n(1), description: 'Functional Impact', moveNumberFirstDisplay: n(0), moveNumberLastDisplay: n(999), options: [] }] };
const CITE_MODELS: ScoringModel[] = [{ id: 'cite-1', description: 'Project Lagoon Questions by Move' }];

async function renderScoringModel(overrides: { scoringModel?: MselScoringModel | null; canEdit?: boolean; confirmed?: boolean; failing?: boolean } = {}) {
  const { scoringModel = null, canEdit = true, confirmed = true, failing = false } = overrides;
  const answer = () => (failing ? throwError(() => new Error('refused')) : of(structuredClone(CREATED)));
  const scoringModelApi = {
    createMselScoringModelFromPreset: vi.fn(answer),
    copyMselScoringModelFromCite: vi.fn(answer),
  } satisfies ApiStub<MselScoringModelService>;
  const saved: MselScoringModel = { ...AUTHORED, description: 'Saved' };
  const open = vi.fn(() => dialogRefStub<unknown, MselScoringModel>(saved).dialogRef);
  const confirm = vi.fn(() => dialogRefStub<unknown, boolean>(confirmed).dialogRef);
  const errorService = { handleError: vi.fn() };
  const rendered = await renderComponent(MselScoringModelComponent, {
    providers: [
      { provide: MselScoringModelService, useValue: scoringModelApi },
      { provide: MatDialog, useValue: { open } satisfies Pick<MatDialog, 'open'> },
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
    inputs: { mselId: 'msel-1', scoringModel, canEdit, citeScoringModels: CITE_MODELS },
  });
  const changes = recordEmissions(outputToObservable(rendered.fixture.componentInstance.scoringModelChange));
  return { ...rendered, scoringModelApi, open, confirm, errorService, changes, saved };
}

async function startFrom(fixture: ComponentFixture<unknown>, text: string) {
  const select = await TestbedHarnessEnvironment.loader(fixture).getHarness(MatSelectHarness);
  await select.open();
  return select.clickOptions({ text });
}

describe('MselScoringModelComponent', () => {
  /**
   * Verifies: a MSEL with no model of its own offers the four presets and a copy of each CITE model, and Create waits for a choice.
   * Interacts with: SCORING_MODEL_PRESETS, the Start From select (MatSelectHarness).
   * Data: no authored model; the CITE model Project Lagoon Questions by Move.
   */
  it('offers the presets and the CITE models to start from', async () => {
    const { fixture } = await renderScoringModel();

    expect(screen.getByRole('button', { name: 'Create Scoring Model' })).toBeDisabled();
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
   * Verifies: creating from a preset asks the API for it, reports the model with its numbers as numbers, and opens the editor on it.
   * Interacts with: MselScoringModelService.createMselScoringModelFromPreset (stub), scoringModelChange, MatDialog.open (stub).
   * Data: no authored model; the CISA NCISS preset, which the API answers with string display orders.
   */
  it('creates the model from a preset and opens the editor', async () => {
    const { fixture, scoringModelApi, changes, open } = await renderScoringModel();

    await startFrom(fixture, 'CISA NCISS');
    expect(screen.getByText(/eight weighted factors/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Create Scoring Model' }));

    expect(scoringModelApi.createMselScoringModelFromPreset).toHaveBeenCalledWith('msel-1', 'Nciss');
    expect(changes[0].categories[0].moveNumberLastDisplay).toBe(999);
    expect(open).toHaveBeenCalledWith(MselScoringModelEditDialogComponent, expect.objectContaining({
      data: expect.objectContaining({ mselId: 'msel-1', canEdit: true }),
    }));
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
   * Verifies: the MSEL's model is summarized, with a warning for the categories still without questions.
   * Interacts with: summary, emptyCategoryWarning.
   * Data: AUTHORED, two categories of which move 2's has no questions.
   */
  it('summarizes the model and warns of empty categories', async () => {
    await renderScoringModel({ scoringModel: AUTHORED });

    expect(screen.getByText('Harbor Questions')).toBeInTheDocument();
    expect(screen.getByText('2 categories, 1 option')).toBeInTheDocument();
    expect(screen.getByText('** 1 scoring category has no questions or options yet **')).toBeInTheDocument();
  });

  /**
   * Verifies: Edit Scoring Model opens the editor with this MSEL's moves, and reports the model the editor saved.
   * Interacts with: MatDialog.open (stub, closes with the saved model), MoveQuery, scoringModelChange.
   * Data: AUTHORED; moves 2 and 1 of this MSEL as the API sends them, and move 7 of another.
   */
  it('opens the editor with the MSEL moves and takes what it saves', async () => {
    const { open, changes, saved } = await renderScoringModel({ scoringModel: AUTHORED });

    await userEvent.setup().click(screen.getByRole('button', { name: 'Edit Scoring Model' }));

    const [, config] = open.mock.calls[0] as unknown as [unknown, { data: { moves: { moveNumber: number }[] } }];
    expect(config.data.moves.map((m) => m.moveNumber).sort()).toEqual([1, 2]);
    expect(changes).toEqual([saved]);
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
  });

  /**
   * Verifies: a refused create is reported and nothing is opened.
   * Interacts with: ErrorService.handleError (stub), MatDialog.open (stub).
   * Data: no authored model; the API refuses the Questions by Move preset.
   */
  it('reports a refused create', async () => {
    const { fixture, errorService, open, changes } = await renderScoringModel({ failing: true });

    await startFrom(fixture, 'Questions by Move');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Create Scoring Model' }));

    expect(errorService.handleError).toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(changes).toEqual([]);
  });

  /**
   * Verifies: someone who may not edit can view the model but not create or replace one.
   * Interacts with: canEdit.
   * Data: AUTHORED, then no model; canEdit false.
   */
  it('lets someone who may not edit only view the model', async () => {
    const { open } = await renderScoringModel({ scoringModel: AUTHORED, canEdit: false });

    expect(screen.queryByRole('button', { name: /Replace Scoring Model|Create Scoring Model/ })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'View Scoring Model' }));
    expect(open).toHaveBeenCalledWith(MselScoringModelEditDialogComponent, expect.objectContaining({ data: expect.objectContaining({ canEdit: false }) }));
  });

  it('says so when there is no model and it may not be edited', async () => {
    await renderScoringModel({ canEdit: false });

    expect(screen.getByText('No scoring model has been authored for this MSEL.')).toBeInTheDocument();
  });
});
