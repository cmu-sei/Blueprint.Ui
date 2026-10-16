// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { CiteAction } from 'src/app/generated/blueprint.api';
import { CiteActionEditDialogComponent } from './cite-action-edit-dialog.component';
import { renderComponent } from 'src/app/test-utils/render-component';

const ACTION = { id: 'ca-1', mselId: 'msel-1', description: 'Isolate the host', moveNumber: 1, actionNumber: 1, teamId: 'team-1', isTemplate: false } as CiteAction;

function dialogData(overrides: Partial<typeof ACTION> = {}) {
  return { citeAction: { ...structuredClone(ACTION), ...overrides }, teamList: [{ id: 'team-1', mselId: 'msel-1', name: 'Blue Team', shortName: 'BLUE' }], moveList: [{ id: 'move-1', mselId: 'msel-1', moveNumber: 1 }] };
}

async function renderCiteActionEditDialog(data = dialogData()) {
  const rendered = await renderComponent(CiteActionEditDialogComponent, {
    imports: [...CRUCIBLE_DIALOG_IMPORTS, MatFormFieldModule, MatInputModule, MatSelectModule],
    declarations: [CiteActionEditDialogComponent],
    providers: [{ provide: MAT_DIALOG_DATA, useValue: data }],
  });
  // ngModel writes the values into the inputs in a microtask.
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();
  const results: unknown[] = [];
  rendered.fixture.componentInstance.editComplete.subscribe((r) => results.push(r));
  return { ...rendered, data, results };
}

describe('CiteActionEditDialogComponent', () => {
  /**
   * Verifies: the component mounts with the default test providers and shows its title.
   * Interacts with: getDefaultProviders (placeholders and stubs only), crucible-dialog.
   * Data: action Isolate the host for BLUE in move 1.
   */
  it('renders with the default test providers', async () => {
    const { fixture } = await renderCiteActionEditDialog();

    expect(fixture.componentInstance).toBeInstanceOf(CiteActionEditDialogComponent);
    expect(screen.getByRole('heading', { name: 'Edit CITE Action' })).toBeInTheDocument();
  });

  /**
   * Verifies: Save emits the action and Cancel emits none.
   * Interacts with: crucible-dialog submit and cancel, editComplete output.
   * Data: action Isolate the host for BLUE in move 1.
   */
  it('emits the action on Save and none on Cancel', async () => {
    const { data, results } = await renderCiteActionEditDialog();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(results).toEqual([
      { saveChanges: true, citeAction: data.citeAction },
      { saveChanges: false, citeAction: null },
    ]);
  });

  /**
   * Verifies: Save is disabled while the action is incomplete.
   * Interacts with: errorFree, crucible-dialog submitDisabled.
   * Data: an action with no description.
   */
  it('disables Save for an incomplete action', async () => {
    await renderCiteActionEditDialog(dialogData({ description: '' }));

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  /**
   * Verifies: handleEditComplete(true) emits the save for an incomplete action (current behavior).
   * Interacts with: handleEditComplete, editComplete output.
   * Data: an action with no description.
   */
  it('saves an incomplete action when handleEditComplete is called', async () => {
    const { fixture, data, results } = await renderCiteActionEditDialog(dialogData({ description: '' }));

    fixture.componentInstance.handleEditComplete(true);

    // Current behavior; see agent-docs/ui-test-bugs/blueprint.ui.md.
    expect(results).toEqual([{ saveChanges: true, citeAction: data.citeAction }]);
  });
});
