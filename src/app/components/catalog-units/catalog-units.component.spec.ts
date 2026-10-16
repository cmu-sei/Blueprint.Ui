// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { Catalog, CatalogUnit, CatalogUnitService, Unit } from 'src/app/generated/blueprint.api';
import { CatalogUnitDataService } from 'src/app/data/catalog-unit/catalog-unit-data.service';
import { UnitStore } from 'src/app/data/unit/unit.store';
import { CatalogUnitsComponent } from './catalog-units.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';

const BLUE: Unit = { id: 'unit-blue', name: 'Blue Team', shortName: 'BLUE' };
const RED: Unit = { id: 'unit-red', name: 'Red Team', shortName: 'RED' };
const CATALOG: Catalog = { id: 'cat-1', name: 'Ransomware Catalog' };
const BLUE_ACCESS: CatalogUnit = { id: 'cu-1', catalogId: 'cat-1', unitId: 'unit-blue', unit: BLUE };
// Another catalog's access row, as its own CatalogUnitsComponent loads it.
const RED_ACCESS_OTHER: CatalogUnit = { id: 'cu-9', catalogId: 'cat-2', unitId: 'unit-red', unit: RED };

async function renderCatalogUnits(overrides: { canEdit?: boolean } = {}) {
  const { canEdit = true } = overrides;
  const catalogUnitApi = {
    getCatalogUnits: vi.fn((catalogId: string) =>
      of(structuredClone(catalogId === 'cat-1' ? [BLUE_ACCESS] : [RED_ACCESS_OTHER])),
    ),
    createCatalogUnit: vi.fn((cu: CatalogUnit) => of<CatalogUnit>({ ...cu, id: 'cu-2', unit: RED })),
    deleteCatalogUnit: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<CatalogUnitService>;
  const rendered = await renderComponent(CatalogUnitsComponent, {
    imports: [MatButtonModule, MatExpansionModule, MatIconModule, MatTableModule],
    declarations: [CatalogUnitsComponent],
    providers: [
      { provide: CatalogUnitService, useValue: catalogUnitApi },
      // The admin container loads the units; the store is seeded instead.
      {
        provide: UnitStore,
        useFactory: () => {
          const store = new UnitStore();
          store.set(structuredClone([BLUE, RED]));
          return store;
        },
      },
    ],
    inputs: { canEdit, catalog: CATALOG, loggedInUserId: 'user-1' },
  });
  return { ...rendered, catalogUnitApi };
}

const table = () => screen.getByRole('table');

describe('CatalogUnitsComponent', () => {
  /**
   * Verifies: the catalog's unit access is loaded and listed.
   * Interacts with: CatalogUnitService.getCatalogUnits (stub), real CatalogUnitDataService and CatalogUnitQuery, real UnitQuery.
   * Data: Blue Team has access to cat-1.
   */
  it('lists the units with access', async () => {
    const { catalogUnitApi } = await renderCatalogUnits();

    expect(catalogUnitApi.getCatalogUnits).toHaveBeenCalledWith('cat-1');
    expect(within(table()).getByText('BLUE')).toBeInTheDocument();
    expect(within(table()).getByText('Blue Team')).toBeInTheDocument();
  });

  /**
   * Verifies: with canEdit a unit can be removed, and the Add a Unit panel offers only the units without access.
   * Interacts with: CatalogUnitService.createCatalogUnit / deleteCatalogUnit (stubs), mat-expansion-panel.
   * Data: canEdit true; Blue has access, Red does not.
   */
  it('adds and removes units with canEdit', async () => {
    const { catalogUnitApi } = await renderCatalogUnits({ canEdit: true });
    const user = userEvent.setup();

    await user.click(screen.getByText('Add a Unit'));
    expect(screen.queryByRole('button', { name: 'Add BLUE to this catalog' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add RED to this catalog' }));
    expect(catalogUnitApi.createCatalogUnit).toHaveBeenCalledWith({ catalogId: 'cat-1', unitId: 'unit-red' });

    await user.click(within(table()).getByRole('button', { name: 'Remove BLUE from this catalog' }));
    expect(catalogUnitApi.deleteCatalogUnit).toHaveBeenCalledWith('cu-1');
  });

  /**
   * Verifies: without canEdit the unit access is listed read-only: no Remove button and no Add a Unit panel.
   * Interacts with: CatalogUnitsComponent template.
   * Data: canEdit false; Blue has access.
   */
  it('hides Remove and Add a Unit without canEdit', async () => {
    await renderCatalogUnits({ canEdit: false });

    expect(within(table()).getByText('BLUE')).toBeInTheDocument();
    expect(within(table()).queryByRole('button', { name: 'Remove BLUE from this catalog' })).not.toBeInTheDocument();
    expect(screen.queryByText('Add a Unit')).not.toBeInTheDocument();
  });

  /**
   * Verifies: after another catalog's access loads, this catalog's list shows that catalog's units instead of its own (current behavior).
   * Interacts with: real CatalogUnitDataService.loadByCatalog (as a second CatalogUnitsComponent calls it), real CatalogUnitQuery.
   * Data: cat-1 grants Blue; cat-2 grants Red and is loaded afterwards.
   */
  it('shows the access rows of the catalog loaded last', async () => {
    const { fixture } = await renderCatalogUnits();

    TestBed.inject(CatalogUnitDataService).loadByCatalog('cat-2');
    fixture.detectChanges();

    // Current behavior; see agent-docs/ui-test-bugs/blueprint.ui.md.
    expect(within(table()).getByText('RED')).toBeInTheDocument();
    expect(within(table()).queryByText('BLUE')).not.toBeInTheDocument();
  });
});
