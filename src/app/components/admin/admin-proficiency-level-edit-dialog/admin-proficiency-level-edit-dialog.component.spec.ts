// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { AdminProficiencyLevelEditDialogComponent } from './admin-proficiency-level-edit-dialog.component';
import { renderComponent } from 'src/app/test-utils/render-component';

const LEVEL = { id: 'level-1', proficiencyScaleId: 'scale-1', name: 'Novice', value: 1, displayOrder: 1, description: 'Just starting' };

function dialogData(overrides: Partial<typeof LEVEL> = {}) {
  return { level: { ...structuredClone(LEVEL), ...overrides } };
}

async function renderAdminProficiencyLevelEditDialog(data = dialogData()) {
  const rendered = await renderComponent(AdminProficiencyLevelEditDialogComponent, {
    imports: [...CRUCIBLE_DIALOG_IMPORTS, MatFormFieldModule, MatInputModule],
    declarations: [AdminProficiencyLevelEditDialogComponent],
    providers: [{ provide: MAT_DIALOG_DATA, useValue: data }],
  });
  // ngModel writes the values into the inputs in a microtask.
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();
  const results: unknown[] = [];
  rendered.fixture.componentInstance.editComplete.subscribe((r) => results.push(r));
  return { ...rendered, data, results };
}

describe('AdminProficiencyLevelEditDialogComponent', () => {
  /**
   * Verifies: the component mounts with the default test providers and shows its title.
   * Interacts with: getDefaultProviders (placeholders and stubs only), crucible-dialog.
   * Data: level Novice.
   */
  it('renders with the default test providers', async () => {
    const { fixture } = await renderAdminProficiencyLevelEditDialog();

    expect(fixture.componentInstance).toBeInstanceOf(AdminProficiencyLevelEditDialogComponent);
    expect(screen.getByRole('heading', { name: 'Edit Proficiency Level' })).toBeInTheDocument();
  });

  /**
   * Verifies: Save emits the level and Cancel emits none.
   * Interacts with: crucible-dialog submit and cancel, editComplete output.
   * Data: level Novice.
   */
  it('emits the level on Save and none on Cancel', async () => {
    const { data, results } = await renderAdminProficiencyLevelEditDialog();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(results).toEqual([
      { saveChanges: true, level: data.level },
      { saveChanges: false, level: null },
    ]);
  });

  /**
   * Verifies: Save is disabled while the level is incomplete.
   * Interacts with: errorFree, crucible-dialog submitDisabled.
   * Data: a level with no name.
   */
  it('disables Save for an incomplete level', async () => {
    await renderAdminProficiencyLevelEditDialog(dialogData({ name: '' }));

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});
