// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import { BehaviorSubject, of } from 'rxjs';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { AdminUnitsComponent } from './admin-units.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { UnitDataService } from 'src/app/data/unit/unit-data.service';
import { UnitQuery } from 'src/app/data/unit/unit.query';
import { UserQuery } from 'src/app/data/user/user.query';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { Unit } from 'src/app/generated/blueprint.api';
import { MatDialog } from '@angular/material/dialog';

async function renderAdminUnits(
  overrides: {
    canManage?: boolean;
    units?: Unit[];
  } = {},
) {
  const { canManage = false, units = [] } = overrides;
  const unitsSubject = new BehaviorSubject<Unit[]>(units);

  return renderComponent(AdminUnitsComponent, {
    declarations: [AdminUnitsComponent],
    imports: [MatTableModule, MatPaginatorModule, MatSortModule],
    componentProperties: { canManage },
    providers: [
      {
        provide: UnitDataService,
        useValue: {
          load: () => of(units),
          add: () => of({}),
          updateUnit: () => of({}),
          delete: () => of({}),
        },
      },
      {
        provide: UnitQuery,
        useValue: {
          selectAll: () => unitsSubject.asObservable(),
          select: () => of(null),
          selectEntity: () => of(null),
        },
      },
      {
        provide: UserQuery,
        useValue: {
          selectAll: () => of([]),
          select: () => of(null),
        },
      },
      {
        provide: DialogService,
        useValue: {
          confirm: () => of({ confirm: true }),
        },
      },
      {
        provide: MatDialog,
        useValue: {
          open: () => ({
            componentInstance: { editComplete: of({}) },
            close: () => {},
          }),
        },
      },
    ],
  });
}

describe('AdminUnitsComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderAdminUnits();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show Add Unit button when canManage is true', async () => {
    const { fixture } = await renderAdminUnits({ canManage: true });
    fixture.detectChanges();
    const addButton = fixture.nativeElement.querySelector(
      'button[title="Add Unit"]',
    );
    expect(addButton).toBeTruthy();
  });

  it('should hide Add Unit button when canManage is false', async () => {
    const { fixture } = await renderAdminUnits({ canManage: false });
    fixture.detectChanges();
    const addButton = fixture.nativeElement.querySelector(
      'button[title="Add Unit"]',
    );
    expect(addButton).toBeNull();
  });

  it('should show Edit and Delete buttons for units when canManage is true', async () => {
    const units: Unit[] = [
      { id: 'unit-1', name: 'Alpha Unit', shortName: 'AU' },
    ];
    const { fixture } = await renderAdminUnits({ canManage: true, units });
    fixture.detectChanges();
    const editButton = fixture.nativeElement.querySelector(
      'button[title="Edit Alpha Unit"]',
    );
    const deleteButton = fixture.nativeElement.querySelector(
      'button[title="Delete Alpha Unit"]',
    );
    expect(editButton).toBeTruthy();
    expect(deleteButton).toBeTruthy();
  });

  it('should hide Edit and Delete buttons for units when canManage is false', async () => {
    const units: Unit[] = [
      { id: 'unit-1', name: 'Alpha Unit', shortName: 'AU' },
    ];
    const { fixture } = await renderAdminUnits({ canManage: false, units });
    fixture.detectChanges();
    const editButton = fixture.nativeElement.querySelector(
      'button[title="Edit Alpha Unit"]',
    );
    const deleteButton = fixture.nativeElement.querySelector(
      'button[title="Delete Alpha Unit"]',
    );
    expect(editButton).toBeNull();
    expect(deleteButton).toBeNull();
  });

  it('should display unit name and short name in the table', async () => {
    const units: Unit[] = [
      { id: 'unit-1', name: 'Alpha Unit', shortName: 'AU' },
    ];
    await renderAdminUnits({ units });
    expect(screen.getByText('Alpha Unit')).toBeInTheDocument();
    expect(screen.getByText('AU')).toBeInTheDocument();
  });
});
