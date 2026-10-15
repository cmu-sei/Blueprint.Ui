// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatRadioModule } from '@angular/material/radio';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { ScenarioEventCopyDialogComponent } from './scenario-event-copy-dialog.component';
import { renderComponent } from 'src/app/test-utils/render-component';

async function renderCopyDialog() {
  const data = { mselList: [{ id: 'msel-2', name: 'Exercise Bravo' }, { id: 'msel-3', name: 'Exercise Charlie' }] };
  const rendered = await renderComponent(ScenarioEventCopyDialogComponent, {
    imports: [...CRUCIBLE_DIALOG_IMPORTS, MatRadioModule],
    declarations: [ScenarioEventCopyDialogComponent],
    providers: [{ provide: MAT_DIALOG_DATA, useValue: data }],
  });
  const results: unknown[] = [];
  rendered.fixture.componentInstance.editComplete.subscribe((r) => results.push(r));
  return { ...rendered, results };
}

describe('ScenarioEventCopyDialogComponent', () => {
  /**
   * Verifies: the component mounts with the default test providers, lists the destination MSELs and disables Copy until one is chosen.
   * Interacts with: getDefaultProviders (placeholders and stubs only), crucible-dialog.
   * Data: MSELs Exercise Bravo and Exercise Charlie.
   */
  it('renders with the default test providers', async () => {
    const { fixture } = await renderCopyDialog();

    expect(fixture.componentInstance).toBeInstanceOf(ScenarioEventCopyDialogComponent);
    expect(screen.getByRole('radio', { name: 'Exercise Bravo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeDisabled();
  });

  /**
   * Verifies: choosing a MSEL and Copy emits its id; Cancel emits an empty id.
   * Interacts with: mat-radio-group ngModel, crucible-dialog submit and cancel, editComplete output.
   * Data: Exercise Charlie chosen.
   */
  it('emits the chosen MSEL on Copy and none on Cancel', async () => {
    const { results } = await renderCopyDialog();
    const user = userEvent.setup();

    await user.click(screen.getByRole('radio', { name: 'Exercise Charlie' }));
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(results).toEqual([{ mselId: 'msel-3' }, { mselId: '' }]);
  });
});
