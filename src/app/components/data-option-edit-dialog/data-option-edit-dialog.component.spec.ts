// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { DataOptionEditDialogComponent } from './data-option-edit-dialog.component';
import { renderComponent } from 'src/app/test-utils/render-component';

const OPTION = { id: 'opt-1', dataFieldId: 'df-1', optionName: 'HIGH', optionValue: 'High priority', displayOrder: 1 };

function dialogData(overrides: Partial<typeof OPTION> = {}) {
  return { dataOption: { ...structuredClone(OPTION), ...overrides } };
}

async function renderDataOptionEditDialog(data = dialogData()) {
  const rendered = await renderComponent(DataOptionEditDialogComponent, {
    imports: [...CRUCIBLE_DIALOG_IMPORTS, MatFormFieldModule, MatInputModule],
    declarations: [DataOptionEditDialogComponent],
    providers: [{ provide: MAT_DIALOG_DATA, useValue: data }],
  });
  // ngModel writes the values into the inputs in a microtask.
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();
  const results: unknown[] = [];
  rendered.fixture.componentInstance.editComplete.subscribe((r) => results.push(r));
  return { ...rendered, data, results };
}

describe('DataOptionEditDialogComponent', () => {
  /**
   * Verifies: the component mounts with the default test providers and shows its title.
   * Interacts with: getDefaultProviders (placeholders and stubs only), crucible-dialog.
   * Data: option HIGH, High priority.
   */
  it('renders with the default test providers', async () => {
    const { fixture } = await renderDataOptionEditDialog();

    expect(fixture.componentInstance).toBeInstanceOf(DataOptionEditDialogComponent);
    expect(screen.getByRole('heading', { name: 'Edit Option' })).toBeInTheDocument();
  });

  /**
   * Verifies: Save emits the option and Cancel emits none.
   * Interacts with: crucible-dialog submit and cancel, editComplete output.
   * Data: option HIGH, High priority.
   */
  it('emits the option on Save and none on Cancel', async () => {
    const { data, results } = await renderDataOptionEditDialog();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(results).toEqual([
      { saveChanges: true, dataOption: data.dataOption },
      { saveChanges: false, dataOption: null },
    ]);
  });

  /**
   * Verifies: Save is disabled while the option is incomplete.
   * Interacts with: errorFree, crucible-dialog submitDisabled.
   * Data: an option with an empty value.
   */
  it('disables Save for an incomplete option', async () => {
    await renderDataOptionEditDialog(dialogData({ optionValue: '' }));

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  /**
   * Verifies: handleEditComplete(true) emits the save for an incomplete option (current behavior).
   * Interacts with: handleEditComplete, editComplete output.
   * Data: an option with an empty value.
   */
  it('saves an incomplete option when handleEditComplete is called', async () => {
    const { fixture, data, results } = await renderDataOptionEditDialog(dialogData({ optionValue: '' }));

    fixture.componentInstance.handleEditComplete(true);

    // Current behavior; see agent-docs/ui-test-bugs/blueprint.ui.md.
    expect(results).toEqual([{ saveChanges: true, dataOption: data.dataOption }]);
  });
});
