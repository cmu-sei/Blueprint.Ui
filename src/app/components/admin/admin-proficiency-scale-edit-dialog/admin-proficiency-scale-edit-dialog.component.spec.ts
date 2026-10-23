// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { AdminProficiencyScaleEditDialogComponent } from './admin-proficiency-scale-edit-dialog.component';
import { renderComponent } from 'src/app/test-utils/render-component';

const SCALE = { id: 'scale-1', name: 'Five Point', description: 'Novice to expert' };

function dialogData(overrides: Partial<typeof SCALE> = {}) {
  return { scale: { ...structuredClone(SCALE), ...overrides } };
}

async function renderAdminProficiencyScaleEditDialog(data = dialogData()) {
  const rendered = await renderComponent(AdminProficiencyScaleEditDialogComponent, {
    imports: [...CRUCIBLE_DIALOG_IMPORTS, MatFormFieldModule, MatInputModule],
    declarations: [AdminProficiencyScaleEditDialogComponent],
    providers: [{ provide: MAT_DIALOG_DATA, useValue: data }],
  });
  // ngModel writes the values into the inputs in a microtask.
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();
  const results: unknown[] = [];
  rendered.fixture.componentInstance.editComplete.subscribe((r) => results.push(r));
  return { ...rendered, data, results };
}

describe('AdminProficiencyScaleEditDialogComponent', () => {
  /**
   * Verifies: the component mounts with the default test providers and shows its title.
   * Interacts with: getDefaultProviders (placeholders and stubs only), crucible-dialog.
   * Data: scale Five Point.
   */
  it('renders with the default test providers', async () => {
    const { fixture } = await renderAdminProficiencyScaleEditDialog();

    expect(fixture.componentInstance).toBeInstanceOf(AdminProficiencyScaleEditDialogComponent);
    expect(screen.getByRole('heading', { name: 'Edit Proficiency Scale' })).toBeInTheDocument();
  });

  /**
   * Verifies: Save emits the scale and Cancel emits none.
   * Interacts with: crucible-dialog submit and cancel, editComplete output.
   * Data: scale Five Point.
   */
  it('emits the scale on Save and none on Cancel', async () => {
    const { data, results } = await renderAdminProficiencyScaleEditDialog();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(results).toEqual([
      { saveChanges: true, scale: data.scale },
      { saveChanges: false, scale: null },
    ]);
  });

  /**
   * Verifies: Save is disabled while the scale is incomplete.
   * Interacts with: errorFree, crucible-dialog submitDisabled.
   * Data: a scale with no name.
   */
  it('disables Save for an incomplete scale', async () => {
    await renderAdminProficiencyScaleEditDialog(dialogData({ name: '' }));

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});
