// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, Input } from '@angular/core';
import { By } from '@angular/platform-browser';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { Unit, UnitService } from 'src/app/generated/blueprint.api';
import { AdminUnitsComponent } from './admin-units.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { unstubbed } from 'src/app/test-utils/unstubbed';
import { AdminUnitUsersComponent } from '../admin-unit-users/admin-unit-users.component';

@Component({ selector: 'app-admin-unit-users', template: '' })
class UnitUsersStub {
  @Input() unitId: string;
  @Input() canManage: boolean;
}

const UNIT: Unit = { id: 'unit-1', name: 'Blue Team', shortName: 'BLUE', description: 'Defenders' };

async function renderUnits(overrides: { canManage?: boolean } = {}) {
  const { canManage = true } = overrides;
  const unitApi = {
    getUnits: vi.fn(() => of([structuredClone(UNIT)])),
    deleteUnit: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<UnitService>;
  // The user confirms every dialog.
  const confirm = vi.fn(() => dialogRefStub<unknown, boolean>(true).dialogRef);
  const dialog = { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>;
  const rendered = await renderComponent(AdminUnitsComponent, {
    imports: [
      MatButtonModule,
      MatCardModule,
      MatFormFieldModule,
      MatIconModule,
      MatInputModule,
      MatPaginatorModule,
      MatProgressSpinnerModule,
      MatSortModule,
      MatTableModule,
    ],
    childStubs: [
      { replace: AdminUnitUsersComponent, with: UnitUsersStub },
    ],
    providers: [
      { provide: UnitService, useValue: unitApi },
      { provide: CrucibleDialogService, useValue: dialog },
      unstubbed(MatDialog),
    ],
    inputs: { canManage },
  });
  return { ...rendered, unitApi, confirm };
}

const table = () => screen.getByRole('table');
const HEADER = ['Add Unit', 'Upload Units from JSON', 'Download Units as JSON'];
const ROW = ['Edit Blue Team', 'Delete Blue Team'];

describe('AdminUnitsComponent', () => {
  /**
   * Verifies: with canManage the units load and the header and row actions are offered.
   * Interacts with: UnitService.getUnits (stub), real UnitDataService and UnitQuery.
   * Data: canManage true; unit Blue Team.
   */
  it('offers unit actions with canManage', async () => {
    const { unitApi } = await renderUnits({ canManage: true });

    expect(unitApi.getUnits).toHaveBeenCalledTimes(1);
    for (const title of HEADER) {
      expect(within(table()).getByTitle(title)).toBeInTheDocument();
    }
    for (const name of ROW) {
      expect(within(table()).getByRole('button', { name })).toBeInTheDocument();
    }
  });

  /**
   * Verifies: without canManage the units are listed but no header or row action is rendered.
   * Interacts with: AdminUnitsComponent template.
   * Data: canManage false; unit Blue Team.
   */
  it('hides unit actions without canManage', async () => {
    await renderUnits({ canManage: false });

    expect(within(table()).getByText('Blue Team')).toBeInTheDocument();
    for (const title of HEADER) {
      expect(within(table()).queryByTitle(title)).not.toBeInTheDocument();
    }
    for (const name of ROW) {
      expect(within(table()).queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  /**
   * Verifies: expanding a unit shows its users with canManage passed through, true and false.
   * Interacts with: row click, UnitUsersStub inputs.
   * Data: canManage true and false.
   */
  it.each([true, false])('passes canManage %s to the expanded unit users', async (canManage) => {
    const { fixture } = await renderUnits({ canManage });
    const user = userEvent.setup();

    await user.click(within(table()).getByText('Blue Team'));

    const users = fixture.debugElement.query(By.directive(UnitUsersStub)).componentInstance as UnitUsersStub;
    expect(users.unitId).toBe('unit-1');
    expect(users.canManage).toBe(canManage);
  });

  /**
   * Verifies: confirming Delete removes the unit through the API and from the list.
   * Interacts with: CrucibleDialogService.confirm (stub, confirms), UnitService.deleteUnit (stub), real UnitStore.
   * Data: canManage true.
   */
  it('deletes a unit after confirmation', async () => {
    const { unitApi, confirm } = await renderUnits({ canManage: true });
    const user = userEvent.setup();

    await user.click(within(table()).getByRole('button', { name: 'Delete Blue Team' }));

    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delete Unit' }));
    expect(unitApi.deleteUnit).toHaveBeenCalledWith('unit-1');
    expect(within(table()).queryByText('Blue Team')).not.toBeInTheDocument();
  });
});
