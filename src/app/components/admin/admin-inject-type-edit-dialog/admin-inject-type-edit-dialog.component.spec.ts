// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { AdminInjectTypeEditDialogComponent } from './admin-inject-type-edit-dialog.component';
import { renderComponent } from 'src/app/test-utils/render-component';

const INJECT_TYPE = { id: 'it-email', name: 'Email', description: 'An email inject' };

function dialogData(overrides: Partial<typeof INJECT_TYPE> = {}) {
  return { injectType: { ...structuredClone(INJECT_TYPE), ...overrides }, teamList: [] };
}

async function renderAdminInjectTypeEditDialog(data = dialogData()) {
  const rendered = await renderComponent(AdminInjectTypeEditDialogComponent, {
    imports: [...CRUCIBLE_DIALOG_IMPORTS, MatFormFieldModule, MatInputModule],
    declarations: [AdminInjectTypeEditDialogComponent],
    providers: [{ provide: MAT_DIALOG_DATA, useValue: data }],
  });
  // ngModel writes the values into the inputs in a microtask.
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();
  const results: unknown[] = [];
  rendered.fixture.componentInstance.editComplete.subscribe((r) => results.push(r));
  return { ...rendered, data, results };
}

describe('AdminInjectTypeEditDialogComponent', () => {
  /**
   * Verifies: the component mounts with the default test providers and shows its title.
   * Interacts with: getDefaultProviders (placeholders and stubs only), crucible-dialog.
   * Data: inject type Email.
   */
  it('renders with the default test providers', async () => {
    const { fixture } = await renderAdminInjectTypeEditDialog();

    expect(fixture.componentInstance).toBeInstanceOf(AdminInjectTypeEditDialogComponent);
    expect(screen.getByRole('heading', { name: 'Edit Inject Type' })).toBeInTheDocument();
  });

  /**
   * Verifies: Save emits the inject type and Cancel emits none.
   * Interacts with: crucible-dialog submit and cancel, editComplete output.
   * Data: inject type Email.
   */
  it('emits the inject type on Save and none on Cancel', async () => {
    const { data, results } = await renderAdminInjectTypeEditDialog();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(results).toEqual([
      { saveChanges: true, injectType: data.injectType },
      { saveChanges: false, injectType: null },
    ]);
  });

  /**
   * Verifies: Save is disabled while the inject type is incomplete.
   * Interacts with: errorFree, crucible-dialog submitDisabled.
   * Data: an inject type with no description.
   */
  it('disables Save for an incomplete inject type', async () => {
    await renderAdminInjectTypeEditDialog(dialogData({ description: '' }));

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  /**
   * Verifies: handleEditComplete(true) emits the save for an incomplete inject type (current behavior).
   * Interacts with: handleEditComplete, editComplete output.
   * Data: an inject type with no description.
   */
  it('saves an incomplete inject type when handleEditComplete is called', async () => {
    const { fixture, data, results } = await renderAdminInjectTypeEditDialog(dialogData({ description: '' }));

    fixture.componentInstance.handleEditComplete(true);

    // Current behavior; see agent-docs/ui-test-bugs/blueprint.ui.md.
    expect(results).toEqual([{ saveChanges: true, injectType: data.injectType }]);
  });
});
