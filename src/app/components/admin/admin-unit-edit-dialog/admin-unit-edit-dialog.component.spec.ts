// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { AngularEditorModule } from '@kolkov/angular-editor';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminUnitEditDialogComponent } from './admin-unit-edit-dialog.component';
import { renderComponent } from 'src/app/test-utils/render-component';

const UNIT = { id: 'unit-1', name: 'Blue Team', shortName: 'BLUE', description: 'Defenders' };

function dialogData(overrides: Partial<typeof UNIT> = {}) {
  return { unit: { ...structuredClone(UNIT), ...overrides } };
}

async function renderAdminUnitEditDialog(data = dialogData()) {
  const rendered = await renderComponent(AdminUnitEditDialogComponent, {
    imports: [...CRUCIBLE_DIALOG_IMPORTS, AngularEditorModule, MatFormFieldModule, MatInputModule],
    declarations: [AdminUnitEditDialogComponent],
    // angular-editor injects HttpClient for its image upload.
    providers: [{ provide: MAT_DIALOG_DATA, useValue: data }, provideHttpClient(), provideHttpClientTesting()],
  });
  // ngModel writes the values into the inputs in a microtask.
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();
  const results: unknown[] = [];
  rendered.fixture.componentInstance.editComplete.subscribe((r) => results.push(r));
  return { ...rendered, data, results };
}

// angular-editor's toolbar makes whole-document role queries slow, so the
// buttons are looked up in the dialog actions.
const actions = () => within(document.querySelector('mat-dialog-actions') as HTMLElement);

describe('AdminUnitEditDialogComponent', () => {
  /**
   * Verifies: the component mounts with the default test providers and shows its title.
   * Interacts with: getDefaultProviders (placeholders and stubs only), crucible-dialog.
   * Data: unit Blue Team (BLUE).
   */
  it('renders with the default test providers', async () => {
    const { fixture } = await renderAdminUnitEditDialog();

    expect(fixture.componentInstance).toBeInstanceOf(AdminUnitEditDialogComponent);
    expect(screen.getByRole('heading', { name: 'Edit Unit' })).toBeInTheDocument();
  });

  /**
   * Verifies: Save emits the unit and Cancel emits none.
   * Interacts with: crucible-dialog submit and cancel, editComplete output.
   * Data: unit Blue Team (BLUE).
   */
  it('emits the unit on Save and none on Cancel', async () => {
    const { data, results } = await renderAdminUnitEditDialog();
    const user = userEvent.setup();

    await user.click(actions().getByRole('button', { name: 'Save' }));
    await user.click(actions().getByRole('button', { name: 'Cancel' }));

    expect(results).toEqual([
      { saveChanges: true, unit: data.unit },
      { saveChanges: false, unit: null },
    ]);
  });

  /**
   * Verifies: Save is disabled while the unit is incomplete.
   * Interacts with: errorFree, crucible-dialog submitDisabled.
   * Data: a unit with no short name.
   */
  it('disables Save for an incomplete unit', async () => {
    await renderAdminUnitEditDialog(dialogData({ shortName: '' }));

    expect(actions().getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  /**
   * Verifies: handleEditComplete(true) emits the save for an incomplete unit (current behavior).
   * Interacts with: handleEditComplete, editComplete output.
   * Data: a unit with no short name.
   */
  it('saves an incomplete unit when handleEditComplete is called', async () => {
    const { fixture, data, results } = await renderAdminUnitEditDialog(dialogData({ shortName: '' }));

    fixture.componentInstance.handleEditComplete(true);

    // Current behavior; see agent-docs/ui-test-bugs/blueprint.ui.md.
    expect(results).toEqual([{ saveChanges: true, unit: data.unit }]);
  });
});
