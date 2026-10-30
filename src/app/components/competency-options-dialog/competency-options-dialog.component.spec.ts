// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import {
  CompetencyFramework,
  CompetencyFrameworkService,
  DataOption,
  MselCompetency,
} from 'src/app/generated/blueprint.api';
import { MselCompetencyStore } from 'src/app/data/msel-competency/msel-competency.store';
import { CompetencyOptionsDialogComponent } from './competency-options-dialog.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';

const POOL: MselCompetency[] = [
  { id: 'mc-1', mselId: 'msel-1', competencyId: 'c-1', competency: { id: 'c-1', competencyFrameworkId: 'fw-1', idNumber: 'K0001', shortName: 'Networking' } },
  { id: 'mc-2', mselId: 'msel-1', competencyId: 'c-2', competency: { id: 'c-2', competencyFrameworkId: 'fw-1', idNumber: 'S0002', shortName: 'Scripting' } },
];
const EXISTING: DataOption = { id: 'opt-1', dataFieldId: 'df-1', optionName: 'K0001', optionValue: 'Networking', displayOrder: 1 };

async function renderCompetencyOptions(overrides: { canEdit?: boolean; dataOptions?: DataOption[] } = {}) {
  const { canEdit = true, dataOptions = [EXISTING] } = overrides;
  const frameworkApi = {
    getCompetencyFrameworks: vi.fn(() => of<CompetencyFramework[]>([{ id: 'fw-1', name: 'NICE' }])),
  } satisfies ApiStub<CompetencyFrameworkService>;
  const ref = dialogRefStub<CompetencyOptionsDialogComponent, DataOption[]>();
  const rendered = await renderComponent(CompetencyOptionsDialogComponent, {
    imports: [
      ...CRUCIBLE_DIALOG_IMPORTS,
      MatButtonModule,
      MatCheckboxModule,
      MatFormFieldModule,
      MatIconModule,
      MatInputModule,
      MatPaginatorModule,
      MatSelectModule,
    ],
    declarations: [CompetencyOptionsDialogComponent],
    providers: [
      { provide: CompetencyFrameworkService, useValue: frameworkApi },
      { provide: MAT_DIALOG_DATA, useValue: { dataFieldId: 'df-1', dataOptions, canEdit } },
      { provide: MatDialogRef, useValue: ref.dialogRef },
      // The MSEL's competency pool, loaded by the MSEL page; seeded instead.
      {
        provide: MselCompetencyStore,
        useFactory: () => {
          const store = new MselCompetencyStore();
          store.set(structuredClone(POOL));
          return store;
        },
      },
    ],
  });
  return { ...rendered, close: ref.close };
}

const table = () => screen.getByRole('table');
const row = (idNumber: string) => within(table()).getByText(idNumber).closest('tr') as HTMLElement;

describe('CompetencyOptionsDialogComponent', () => {
  /**
   * Verifies: the pool is listed with framework and type, and the existing option is preselected.
   * Interacts with: real MselCompetencyQuery (seeded), CompetencyFrameworkService.getCompetencyFrameworks (stub).
   * Data: pool K0001 (selected) and S0002; framework NICE.
   */
  it('lists the competency pool with the current selection', async () => {
    await renderCompetencyOptions();

    expect(screen.getByRole('heading', { name: 'Manage Competencies (1 selected)' })).toBeInTheDocument();
    expect(within(row('K0001')).getByText('NICE')).toBeInTheDocument();
    expect(within(row('K0001')).getByText('Knowledge')).toBeInTheDocument();
    expect(within(row('S0002')).getByText('Skill')).toBeInTheDocument();
  });

  /**
   * Verifies: with canEdit ticking a competency adds it, and Close returns the options in selection order.
   * Interacts with: mat-checkbox change, MatDialogRef.close (stub).
   * Data: canEdit true; S0002 ticked.
   */
  it('adds a ticked competency as an option with canEdit', async () => {
    const { close } = await renderCompetencyOptions({ canEdit: true });
    const user = userEvent.setup();

    await user.click(within(row('S0002')).getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(close).toHaveBeenCalledWith([
      { ...EXISTING, displayOrder: 1, competencyId: 'c-1' },
      expect.objectContaining({ dataFieldId: 'df-1', optionName: 'S0002', optionValue: 'Scripting', displayOrder: 2, competencyId: 'c-2' }),
    ]);
  });

  /**
   * Verifies: without canEdit there are no checkboxes, clicking a row changes nothing, and Close saves nothing.
   * Interacts with: CompetencyOptionsDialogComponent template, MatDialogRef.close (stub).
   * Data: canEdit false; S0002 row clicked.
   */
  it('lists the pool read-only without canEdit', async () => {
    const { close } = await renderCompetencyOptions({ canEdit: false });
    const user = userEvent.setup();

    expect(within(table()).queryAllByRole('checkbox')).toEqual([]);
    await user.click(row('S0002'));
    expect(screen.getByRole('heading', { name: 'Manage Competencies (1 selected)' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(close).toHaveBeenCalledWith(undefined);
  });

  /**
   * Verifies: an editor who looks and closes saves nothing, so an option whose competency has left the pool is not
   * deleted by viewing the list.
   * Interacts with: MatDialogRef.close (stub).
   * Data: canEdit true; options K0001 (in the pool) and X9999 (no longer in the pool); nothing ticked.
   */
  it('saves nothing when an editor closes without a change', async () => {
    const stale: DataOption = { id: 'opt-9', dataFieldId: 'df-1', optionName: 'X9999', optionValue: 'Retired', displayOrder: 2 };
    const { close } = await renderCompetencyOptions({ canEdit: true, dataOptions: [EXISTING, stale] });
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(close).toHaveBeenCalledWith(undefined);
  });
});
