// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { TeamAddDialogComponent } from './team-add-dialog.component';
import { renderComponent } from 'src/app/test-utils/render-component';

async function renderTeamAdd() {
  const data = {
    unitList: [
      { id: 'unit-1', name: 'Blue Cell', shortName: 'BLUE' },
      { id: 'unit-2', name: 'Red Cell', shortName: 'RED' },
    ],
  };
  const rendered = await renderComponent(TeamAddDialogComponent, {
    imports: [...CRUCIBLE_DIALOG_IMPORTS, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule],
    declarations: [TeamAddDialogComponent],
    providers: [{ provide: MAT_DIALOG_DATA, useValue: data }],
  });
  const results: unknown[] = [];
  rendered.fixture.componentInstance.editComplete.subscribe((r) => results.push(r));
  return { ...rendered, results };
}

describe('TeamAddDialogComponent', () => {
  /**
   * Verifies: the component mounts with the default test providers and offers one button per unit.
   * Interacts with: getDefaultProviders (placeholders and stubs only), crucible-dialog.
   * Data: units BLUE and RED.
   */
  it('renders with the default test providers', async () => {
    const { fixture } = await renderTeamAdd();

    expect(fixture.componentInstance).toBeInstanceOf(TeamAddDialogComponent);
    expect(screen.getByRole('button', { name: 'BLUE - Blue Cell' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'RED - Red Cell' })).toBeInTheDocument();
  });

  /**
   * Verifies: the search narrows the units, choosing one emits its id, and Cancel emits none.
   * Interacts with: the search input, unit buttons, editComplete output.
   * Data: search "red"; RED chosen; then Cancel.
   */
  it('emits the chosen unit and nothing on Cancel', async () => {
    const { results } = await renderTeamAdd();
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText('Search'), 'red');
    expect(screen.queryByRole('button', { name: 'BLUE - Blue Cell' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'RED - Red Cell' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(results).toEqual([
      { saveChanges: true, unitId: 'unit-2' },
      { saveChanges: false, team: null },
    ]);
  });
});
