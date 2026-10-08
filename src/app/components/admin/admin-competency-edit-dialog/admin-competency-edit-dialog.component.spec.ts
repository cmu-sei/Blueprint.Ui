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
import { Competency } from 'src/app/generated/blueprint.api';
import { AdminCompetencyEditDialogComponent } from './admin-competency-edit-dialog.component';
import { renderComponent } from 'src/app/test-utils/render-component';

const COMPETENCY = { id: 'c-1', competencyFrameworkId: 'fw-1', idNumber: 'K0001', shortName: 'Networking', description: 'Network knowledge' } as Competency;

function dialogData(overrides: Partial<typeof COMPETENCY> = {}) {
  return { competency: { ...structuredClone(COMPETENCY), ...overrides } };
}

async function renderAdminCompetencyEditDialog(data = dialogData()) {
  const rendered = await renderComponent(AdminCompetencyEditDialogComponent, {
    imports: [...CRUCIBLE_DIALOG_IMPORTS, MatFormFieldModule, MatInputModule, MatSelectModule],
    declarations: [AdminCompetencyEditDialogComponent],
    providers: [{ provide: MAT_DIALOG_DATA, useValue: data }],
  });
  // ngModel writes the values into the inputs in a microtask.
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();
  const results: unknown[] = [];
  rendered.fixture.componentInstance.editComplete.subscribe((r) => results.push(r));
  return { ...rendered, data, results };
}

describe('AdminCompetencyEditDialogComponent', () => {
  /**
   * Verifies: the component mounts with the default test providers and shows its title.
   * Interacts with: getDefaultProviders (placeholders and stubs only), crucible-dialog.
   * Data: competency K0001 Networking.
   */
  it('renders with the default test providers', async () => {
    const { fixture } = await renderAdminCompetencyEditDialog();

    expect(fixture.componentInstance).toBeInstanceOf(AdminCompetencyEditDialogComponent);
    expect(screen.getByRole('heading', { name: 'Edit Competency' })).toBeInTheDocument();
  });

  /**
   * Verifies: Save emits the competency and Cancel emits none.
   * Interacts with: crucible-dialog submit and cancel, editComplete output.
   * Data: competency K0001 Networking.
   */
  it('emits the competency on Save and none on Cancel', async () => {
    const { data, results } = await renderAdminCompetencyEditDialog();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(results).toEqual([
      { saveChanges: true, competency: data.competency },
      { saveChanges: false, competency: null },
    ]);
  });

  /**
   * Verifies: Save is disabled while the competency is incomplete.
   * Interacts with: errorFree, crucible-dialog submitDisabled.
   * Data: a competency with no ID number and no short name.
   */
  it('disables Save for an incomplete competency', async () => {
    await renderAdminCompetencyEditDialog(dialogData({ idNumber: '', shortName: '' }));

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});
