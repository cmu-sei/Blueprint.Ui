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
import { CiteDutyEditDialogComponent } from './cite-duty-edit-dialog.component';
import { renderComponent } from 'src/app/test-utils/render-component';

const DUTY = { id: 'cd-1', mselId: 'msel-1', name: 'Incident commander', teamId: 'team-1', isTemplate: false };

function dialogData(overrides: Partial<typeof DUTY> = {}) {
  return { citeDuty: { ...structuredClone(DUTY), ...overrides }, teamList: [{ id: 'team-1', mselId: 'msel-1', name: 'Blue Team', shortName: 'BLUE' }] };
}

async function renderCiteDutyEditDialog(data = dialogData()) {
  const rendered = await renderComponent(CiteDutyEditDialogComponent, {
    imports: [...CRUCIBLE_DIALOG_IMPORTS, MatFormFieldModule, MatInputModule, MatSelectModule],
    declarations: [CiteDutyEditDialogComponent],
    providers: [{ provide: MAT_DIALOG_DATA, useValue: data }],
  });
  // ngModel writes the values into the inputs in a microtask.
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();
  const results: unknown[] = [];
  rendered.fixture.componentInstance.editComplete.subscribe((r) => results.push(r));
  return { ...rendered, data, results };
}

describe('CiteDutyEditDialogComponent', () => {
  /**
   * Verifies: the component mounts with the default test providers and shows its title.
   * Interacts with: getDefaultProviders (placeholders and stubs only), crucible-dialog.
   * Data: duty Incident commander for BLUE.
   */
  it('renders with the default test providers', async () => {
    const { fixture } = await renderCiteDutyEditDialog();

    expect(fixture.componentInstance).toBeInstanceOf(CiteDutyEditDialogComponent);
    expect(screen.getByRole('heading', { name: 'Edit CITE Duty' })).toBeInTheDocument();
  });

  /**
   * Verifies: Save emits the duty and Cancel emits none.
   * Interacts with: crucible-dialog submit and cancel, editComplete output.
   * Data: duty Incident commander for BLUE.
   */
  it('emits the duty on Save and none on Cancel', async () => {
    const { data, results } = await renderCiteDutyEditDialog();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(results).toEqual([
      { saveChanges: true, citeDuty: data.citeDuty },
      { saveChanges: false, citeDuty: null },
    ]);
  });

  /**
   * Verifies: Save is disabled while the duty is incomplete.
   * Interacts with: errorFree, crucible-dialog submitDisabled.
   * Data: a duty with no name.
   */
  it('disables Save for an incomplete duty', async () => {
    await renderCiteDutyEditDialog(dialogData({ name: '' }));

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  /**
   * Verifies: handleEditComplete(true) emits the save for an incomplete duty (current behavior).
   * Interacts with: handleEditComplete, editComplete output.
   * Data: a duty with no name.
   */
  it('saves an incomplete duty when handleEditComplete is called', async () => {
    const { fixture, data, results } = await renderCiteDutyEditDialog(dialogData({ name: '' }));

    fixture.componentInstance.handleEditComplete(true);

    // Current behavior; see agent-docs/ui-test-bugs/blueprint.ui.md.
    expect(results).toEqual([{ saveChanges: true, citeDuty: data.citeDuty }]);
  });
});
