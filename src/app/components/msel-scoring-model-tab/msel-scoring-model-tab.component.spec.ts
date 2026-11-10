// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, input, output } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSelectHarness } from '@angular/material/select/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, Subject, throwError } from 'rxjs';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import {
  CiteService,
  Msel,
  MselItemStatus,
  MselRole,
  MselScoringModel,
  MselScoringModelLink,
  MselScoringModelService,
  MselService,
  ScoringModel,
  SystemPermission,
  SystemPermissionsService,
} from 'src/app/generated/blueprint.api';
import { MselStore } from 'src/app/data/msel/msel.store';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { permissionApiStubs } from 'src/app/test-utils/mock-permission-data.service';
import { renderComponent } from 'src/app/test-utils/render-component';
import { CITE_ACCESS_DENIED } from 'src/app/utilities/cite-access';
import { MselScoringModelComponent } from '../msel-scoring-model/msel-scoring-model.component';
import { MselScoringModelTabComponent } from './msel-scoring-model-tab.component';

@Component({ selector: 'app-msel-scoring-model', template: '' })
class MselScoringModelStub {
  readonly mselId = input<string>(undefined);
  readonly scoringModel = input<MselScoringModel | null>(null);
  readonly canEdit = input<boolean>(false);
  readonly citeScoringModels = input<ScoringModel[]>([]);
  readonly scoringModelChange = output<MselScoringModel | null>();
  isDirty = () => false;
}

const ME = 'user-me';
const AUTHORED: MselScoringModel = {
  mselId: 'msel-1',
  description: 'Harbor Questions',
  categories: [{ id: 'cat-1', displayOrder: '1' as unknown as number, description: 'Move 1', moveNumberFirstDisplay: 1, moveNumberLastDisplay: 1, options: [] }],
};
// the CITE templates, and a model that belongs to an evaluation and so cannot be linked
const CITE_MODELS: ScoringModel[] = [
  { id: 'cite-1', description: 'Project Lagoon Questions by Move' },
  { id: 'cite-2', description: 'NCISS' },
  { id: 'cite-eval', description: 'Harbor Questions (evaluation)', evaluationId: 'eval-9' },
];

function msel(myRoles: MselRole[] = [], extra: Partial<Msel> = {}): Msel {
  return {
    id: 'msel-1',
    name: 'Exercise Alpha',
    status: MselItemStatus.Pending,
    useCite: true,
    createdBy: 'user-creator',
    teams: [],
    units: [],
    userMselRoles: myRoles.map((role, i) => ({ id: `umr-${i}`, userId: ME, mselId: 'msel-1', role })),
    ...extra,
  };
}

async function renderTab(
  overrides: { permissions?: SystemPermission[]; myRoles?: MselRole[]; mselExtra?: Partial<Msel>; authored?: MselScoringModel | null; citeModels?: ScoringModel[] } = {},
) {
  const { permissions = [], myRoles = [MselRole.Owner], mselExtra = {}, authored = null, citeModels = CITE_MODELS } = overrides;
  const citeApi = { getScoringModels: vi.fn(() => of(structuredClone(citeModels))) } satisfies ApiStub<CiteService>;
  const scoringModelApi = {
    getMselScoringModel: vi.fn(() => of(structuredClone(authored))),
    deleteMselScoringModel: vi.fn(() => of<unknown>(null)),
    // the API answers the MSEL as the link left it
    linkMselScoringModel: vi.fn((_id: string, body: MselScoringModelLink) =>
      of<Msel>({ ...msel(myRoles, mselExtra), citeScoringModelId: body.citeScoringModelId })),
  } satisfies ApiStub<MselScoringModelService>;
  // the Config tab's save; the link is not saved through it
  const mselApi = { updateMsel: vi.fn((_id: string, body: Msel) => of(structuredClone(body))) } satisfies ApiStub<MselService>;
  // The user confirms every dialog.
  const confirm = vi.fn(() => dialogRefStub<unknown, boolean>(true).dialogRef);
  const permissionApis = permissionApiStubs({ system: permissions });
  const rendered = await renderComponent(MselScoringModelTabComponent, {
    childStubs: [{ replace: MselScoringModelComponent, with: MselScoringModelStub }],
    providers: [
      { provide: SystemPermissionsService, useValue: permissionApis.systemPermissions },
      PermissionDataService,
      { provide: CiteService, useValue: citeApi },
      { provide: MselScoringModelService, useValue: scoringModelApi },
      { provide: MselService, useValue: mselApi },
      { provide: CrucibleDialogService, useValue: { confirm } satisfies Pick<CrucibleDialogService, 'confirm'> },
      {
        provide: MselStore,
        useFactory: () => {
          const store = new MselStore();
          store.set([msel(myRoles, mselExtra)]);
          store.setActive('msel-1');
          return store;
        },
      },
    ],
    inputs: { loggedInUserId: ME },
  });
  // ngModel applies [disabled] in a microtask.
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();
  return { ...rendered, citeApi, scoringModelApi, mselApi, confirm };
}

const authoredChild = (fixture: ComponentFixture<unknown>) =>
  fixture.debugElement.query(By.directive(MselScoringModelStub))?.componentInstance as MselScoringModelStub;
const linkRadio = () => screen.getByRole('radio', { name: 'Link a CITE scoring model' });
const authorRadio = () => screen.getByRole('radio', { name: 'Author it in Blueprint' });
const linkSelect = (fixture: ComponentFixture<unknown>) =>
  TestbedHarnessEnvironment.loader(fixture).getHarness(MatSelectHarness.with({ ancestor: '.link-select' }));

describe('MselScoringModelTabComponent', () => {
  /**
   * Verifies: a MSEL with its own scoring model opens on Author it in Blueprint, with the model, its numbers as numbers, and the CITE templates to copy handed to the editor.
   * Interacts with: MselScoringModelService.getMselScoringModel (stub), CiteService.getScoringModels (stub), app-msel-scoring-model (stub) inputs.
   * Data: MSEL role Owner; a pending MSEL with the authored model Harbor Questions; CITE_MODELS, one of which belongs to an evaluation.
   */
  it('opens an authored model in the editor', async () => {
    const { fixture, scoringModelApi } = await renderTab({ authored: AUTHORED });

    expect(scoringModelApi.getMselScoringModel).toHaveBeenCalledWith('msel-1');
    expect(authorRadio()).toBeChecked();
    const child = authoredChild(fixture);
    expect(child.mselId()).toBe('msel-1');
    expect(child.scoringModel().description).toBe('Harbor Questions');
    expect(child.scoringModel().categories[0].displayOrder).toBe(1);
    expect(child.canEdit()).toBe(true);
    expect(child.citeScoringModels().map((m) => m.id)).toEqual(['cite-1', 'cite-2']);
    expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument();
  });

  /**
   * Verifies: a MSEL without its own model opens on Link a CITE scoring model, offering CITE's templates and no editor.
   * Interacts with: the source radio group, the CITE Scoring Model select (MatSelectHarness).
   * Data: MSEL role Owner; a pending MSEL with no scoring model of either kind; CITE_MODELS.
   */
  it('offers the CITE scoring models to link when none is authored', async () => {
    const { fixture } = await renderTab();

    expect(linkRadio()).toBeChecked();
    expect(authoredChild(fixture)).toBeUndefined();
    const select = await linkSelect(fixture);
    await select.open();
    expect(await Promise.all((await select.getOptions()).map((o) => o.getText()))).toEqual(['-- None --', 'Project Lagoon Questions by Move', 'NCISS']);
  });

  /**
   * Verifies: the choice is held until Save Changes, which sends only the chosen model to the link endpoint, not the whole MSEL, and the MSEL the API answers replaces the one in the store.
   * Interacts with: the CITE Scoring Model select, Save Changes, MselScoringModelService.linkMselScoringModel (stub), MselService.updateMsel (stub), MselStore.
   * Data: MSEL role Owner; a pending MSEL with no linked model; NCISS chosen.
   */
  it('saves the linked model through the link endpoint', async () => {
    const { fixture, mselApi, scoringModelApi } = await renderTab();
    const user = userEvent.setup();
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled();

    const select = await linkSelect(fixture);
    await select.open();
    await select.clickOptions({ text: 'NCISS' });
    fixture.detectChanges();
    expect(screen.getByText('Changes have not been saved!')).toBeInTheDocument();
    expect(scoringModelApi.linkMselScoringModel).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    fixture.detectChanges();

    expect(scoringModelApi.linkMselScoringModel).toHaveBeenCalledExactlyOnceWith('msel-1', { citeScoringModelId: 'cite-2' });
    expect(mselApi.updateMsel).not.toHaveBeenCalled();
    expect(TestBed.inject(MselStore).getValue().entities['msel-1'].citeScoringModelId).toBe('cite-2');
    expect(screen.queryByText('Changes have not been saved!')).not.toBeInTheDocument();
  });

  /**
   * Verifies: choosing -- None -- clears the link, sent as null.
   * Interacts with: the CITE Scoring Model select, Save Changes, MselScoringModelService.linkMselScoringModel (stub).
   * Data: MSEL role Owner; a pending MSEL linked to cite-1; -- None -- chosen.
   */
  it('clears the link', async () => {
    const { fixture, scoringModelApi } = await renderTab({ mselExtra: { citeScoringModelId: 'cite-1' } });

    const select = await linkSelect(fixture);
    await select.open();
    await select.clickOptions({ text: '-- None --' });
    fixture.detectChanges();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(scoringModelApi.linkMselScoringModel).toHaveBeenCalledExactlyOnceWith('msel-1', { citeScoringModelId: null });
  });

  /**
   * Verifies: when CITE will not let the user read the chosen model, a dialog gives the API's reason, and the choice stays up unsaved.
   * Interacts with: MselScoringModelService.linkMselScoringModel (stub, 403 with the CITE access denied problem type), CrucibleDialogService.confirm (stub).
   * Data: MSEL role Owner; a pending MSEL with no linked model; NCISS chosen, which CITE shows the user only as a participant.
   */
  it('explains in a dialog when CITE refuses the link', async () => {
    const { fixture, scoringModelApi, confirm } = await renderTab();
    const reason = 'You can view the CITE scoring model "NCISS" only as a participant, without its equations and weights.';
    scoringModelApi.linkMselScoringModel.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 403, error: { type: CITE_ACCESS_DENIED, title: reason } })));

    const select = await linkSelect(fixture);
    await select.open();
    await select.clickOptions({ text: 'NCISS' });
    fixture.detectChanges();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Save Changes' }));
    fixture.detectChanges();

    expect(confirm).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ title: 'CITE Access Denied', message: reason }));
    expect(screen.getByText('Changes have not been saved!')).toBeInTheDocument();
    expect(TestBed.inject(MselStore).getValue().entities['msel-1'].citeScoringModelId).toBeUndefined();
  });

  /**
   * Verifies: a link chosen and not saved is dropped on choosing to author, which replaces the link, so leaving the tab asks about nothing.
   * Interacts with: the CITE Scoring Model select, the source radio group, hasPendingChanges.
   * Data: MSEL role Owner; a pending MSEL linked to cite-1; NCISS chosen, then Author it in Blueprint.
   */
  it('drops an unsaved link when the planner chooses to author', async () => {
    const { fixture, scoringModelApi } = await renderTab({ mselExtra: { citeScoringModelId: 'cite-1' } });

    const select = await linkSelect(fixture);
    await select.open();
    await select.clickOptions({ text: 'NCISS' });
    fixture.detectChanges();
    expect(fixture.componentInstance.hasPendingChanges()).toBe(true);
    await userEvent.setup().click(authorRadio());
    fixture.detectChanges();

    expect(fixture.componentInstance.hasPendingChanges()).toBe(false);
    expect(fixture.componentInstance.msel.citeScoringModelId).toBe('cite-1');
    expect(scoringModelApi.linkMselScoringModel).not.toHaveBeenCalled();
  });

  /**
   * Verifies: Cancel Changes puts the saved link back without saving.
   * Interacts with: the CITE Scoring Model select, Cancel Changes, MselService.updateMsel (stub).
   * Data: MSEL role Owner; a pending MSEL linked to cite-1; NCISS chosen, then cancelled.
   */
  it('cancels an unsaved link', async () => {
    const { fixture, mselApi } = await renderTab({ mselExtra: { citeScoringModelId: 'cite-1' } });

    const select = await linkSelect(fixture);
    expect(await select.getValueText()).toBe('Project Lagoon Questions by Move');
    await select.open();
    await select.clickOptions({ text: 'NCISS' });
    fixture.detectChanges();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Cancel Changes' }));
    fixture.detectChanges();

    expect(mselApi.updateMsel).not.toHaveBeenCalled();
    expect(await select.getValueText()).toBe('Project Lagoon Questions by Move');
    expect(fixture.componentInstance.hasPendingChanges()).toBe(false);
  });

  /**
   * Verifies: choosing Author it in Blueprint opens the editor with no model, for the planner to start one.
   * Interacts with: the source radio group, app-msel-scoring-model (stub).
   * Data: MSEL role Owner; a pending MSEL with no scoring model.
   */
  it('opens the editor when the planner chooses to author', async () => {
    const { fixture } = await renderTab();

    await userEvent.setup().click(authorRadio());
    fixture.detectChanges();

    expect(authoredChild(fixture).scoringModel()).toBeNull();
    expect(authoredChild(fixture).canEdit()).toBe(true);
    expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument();
  });

  /**
   * Verifies: going back to linking a CITE model deletes the authored model once the planner confirms.
   * Interacts with: CrucibleDialogService.confirm (stub, confirms), MselScoringModelService.deleteMselScoringModel (stub).
   * Data: MSEL role Owner; a pending MSEL with the authored model Harbor Questions.
   */
  it('deletes the authored model when the planner links a CITE model instead', async () => {
    const { fixture, confirm, scoringModelApi } = await renderTab({ authored: AUTHORED });

    await userEvent.setup().click(linkRadio());
    fixture.detectChanges();

    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Link a CITE Scoring Model',
      message: 'Linking a CITE scoring model deletes "Harbor Questions", the scoring model authored in Blueprint. Delete it?',
      confirmText: 'Delete',
    }));
    expect(scoringModelApi.deleteMselScoringModel).toHaveBeenCalledWith('msel-1');
    expect(authoredChild(fixture)).toBeUndefined();
    expect(linkRadio()).toBeChecked();
  });

  /**
   * Verifies: declining the confirmation keeps the authored model and its choice.
   * Interacts with: CrucibleDialogService.confirm (stub, declines once), MselScoringModelService.deleteMselScoringModel (stub).
   * Data: MSEL role Owner; a pending MSEL with the authored model Harbor Questions.
   */
  it('keeps the authored model when the planner declines', async () => {
    const { fixture, confirm, scoringModelApi } = await renderTab({ authored: AUTHORED });
    // a real confirmation answers after the click has been rendered
    const declined = new Subject<boolean>();
    confirm.mockReturnValueOnce({ afterClosed: () => declined.asObservable() } as MatDialogRef<unknown, boolean>);

    await userEvent.setup().click(linkRadio());
    fixture.detectChanges();
    declined.next(false);
    fixture.detectChanges();

    expect(scoringModelApi.deleteMselScoringModel).not.toHaveBeenCalled();
    expect(authorRadio()).toBeChecked();
    expect(authoredChild(fixture).scoringModel().description).toBe('Harbor Questions');
  });

  /**
   * Verifies: while the MSEL is pushed the source cannot be changed and the authored model is read-only.
   * Interacts with: integrationsLocked, the source radio group, app-msel-scoring-model (stub) canEdit.
   * Data: MSEL role Owner; a deployed MSEL with an evaluation and the authored model Harbor Questions.
   */
  it('locks the authored model while the MSEL is pushed', async () => {
    const { fixture } = await renderTab({ mselExtra: { status: MselItemStatus.Deployed, citeEvaluationId: 'eval-1' }, authored: AUTHORED });

    expect(linkRadio()).toBeDisabled();
    expect(authoredChild(fixture).canEdit()).toBe(false);
    expect(screen.getByText(/locked while the integrations are deployed/)).toBeInTheDocument();
  });

  /**
   * Verifies: while the MSEL is pushed the linked model is shown, by id and name, rather than offered, and there is nothing to save.
   * Interacts with: integrationsLocked, linkedScoringModelName.
   * Data: MSEL role Owner; a deployed MSEL with an evaluation, linked to cite-1.
   */
  it('shows the linked model read-only while the MSEL is pushed', async () => {
    const { fixture } = await renderTab({ mselExtra: { status: MselItemStatus.Deployed, citeEvaluationId: 'eval-1', citeScoringModelId: 'cite-1' } });

    expect(linkRadio()).toBeDisabled();
    expect(fixture.debugElement.query(By.css('.link-select'))).toBeNull();
    expect(screen.getByText('cite-1')).toBeInTheDocument();
    expect(screen.getByText('Project Lagoon Questions by Move')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument();
  });

  /**
   * Verifies: an Editor may link and author, as the API lets EditMsels, the owner or an editor change the scoring model.
   * Interacts with: real PermissionDataService over SystemPermissionsService (stub), MselPlus.hasRole.
   * Data: the Editor role with no permission; a pending MSEL linked to cite-1.
   */
  it('lets an Editor link and author', async () => {
    const { fixture } = await renderTab({ myRoles: [MselRole.Editor], mselExtra: { citeScoringModelId: 'cite-1' } });

    expect(linkRadio()).toBeEnabled();
    expect(authorRadio()).toBeEnabled();
    expect(await (await linkSelect(fixture)).isDisabled()).toBe(false);
  });

  /**
   * Verifies: the MSEL's other roles, an Approver here, only see the linked model.
   * Interacts with: canEdit.
   * Data: the Approver role (near miss: not Owner or Editor); a pending MSEL linked to cite-1.
   */
  it('lets an Approver only look', async () => {
    const { fixture } = await renderTab({ myRoles: [MselRole.Approver], mselExtra: { citeScoringModelId: 'cite-1' } });

    expect(linkRadio()).toBeDisabled();
    expect(fixture.debugElement.query(By.css('.link-select'))).toBeNull();
  });

  /**
   * Verifies: someone with no role and no permission only sees the linked model.
   * Interacts with: canEdit.
   * Data: no role; a pending MSEL linked to cite-1.
   */
  it('lets a viewer only look', async () => {
    const { fixture } = await renderTab({ myRoles: [], mselExtra: { citeScoringModelId: 'cite-1' } });

    expect(linkRadio()).toBeDisabled();
    expect(fixture.debugElement.query(By.css('.link-select'))).toBeNull();
    expect(screen.getByText('Project Lagoon Questions by Move')).toBeInTheDocument();
  });

  /**
   * Verifies: the two source radios explain where the scoring model lives and when it reaches CITE.
   * Interacts with: matTooltip on the mat-radio-button hosts (accessible description, set in a microtask).
   * Data: MSEL role Owner; a pending MSEL with nothing linked or authored.
   */
  it('explains the two sources in their tooltips', async () => {
    await renderTab();

    expect(linkRadio().closest('mat-radio-button')).toHaveAccessibleDescription(
      'Build the CITE evaluation from a scoring model that already exists in CITE and is maintained there.',
    );
    expect(authorRadio().closest('mat-radio-button')).toHaveAccessibleDescription(
      'Write the scoring model here with the MSEL; Blueprint creates it in CITE when the integrations are pushed.',
    );
  });
});
