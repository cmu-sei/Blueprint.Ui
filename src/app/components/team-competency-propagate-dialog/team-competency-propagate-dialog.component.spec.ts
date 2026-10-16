// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { MselCompetency } from 'src/app/generated/blueprint.api';
import { TeamCompetencyPropagateDialogComponent } from './team-competency-propagate-dialog.component';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';

const RELATED: MselCompetency[] = [
  { id: 'mc-1', competencyId: 'c-1', competency: { id: 'c-1', idNumber: 'K0001', shortName: 'Networking' } },
  { id: 'mc-2', competencyId: 'c-2', competency: { id: 'c-2', idNumber: 'S0002', shortName: 'Scripting' } },
];

async function renderPropagate() {
  const ref = dialogRefStub<TeamCompetencyPropagateDialogComponent, MselCompetency[]>();
  const rendered = await renderComponent(TeamCompetencyPropagateDialogComponent, {
    imports: [...CRUCIBLE_DIALOG_IMPORTS, MatCheckboxModule, MatTableModule, MatTooltipModule],
    declarations: [TeamCompetencyPropagateDialogComponent],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: { teamName: 'BLUE', action: 'add', competencies: RELATED } },
      { provide: MatDialogRef, useValue: ref.dialogRef },
    ],
  });
  return { ...rendered, close: ref.close };
}

describe('TeamCompetencyPropagateDialogComponent', () => {
  /**
   * Verifies: the component mounts with the default test providers with every related competency preselected.
   * Interacts with: getDefaultProviders (placeholders and stubs only), crucible-dialog.
   * Data: adding BLUE; related K0001 and S0002.
   */
  it('renders with the default test providers', async () => {
    const { fixture } = await renderPropagate();

    expect(fixture.componentInstance).toBeInstanceOf(TeamCompetencyPropagateDialogComponent);
    expect(screen.getByRole('heading', { name: 'Add Team from Related' })).toBeInTheDocument();
    expect(screen.getByText(/Also add team BLUE to the 2 related competencies/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Yes (2)' })).toBeEnabled();
  });

  /**
   * Verifies: Yes closes with the competencies still selected.
   * Interacts with: row click toggling, crucible-dialog submit, MatDialogRef.close (stub).
   * Data: S0002 deselected.
   */
  it('confirms the selected competencies', async () => {
    const { close } = await renderPropagate();
    const user = userEvent.setup();

    await user.click(within(screen.getByRole('table')).getByText('Scripting'));
    await user.click(screen.getByRole('button', { name: 'Yes (1)' }));

    expect(close).toHaveBeenCalledWith([RELATED[0]]);
  });
});
