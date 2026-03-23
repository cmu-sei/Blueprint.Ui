// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import { BehaviorSubject, of } from 'rxjs';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { AdminInjectTypesComponent } from './admin-inject-types.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { InjectTypeDataService } from 'src/app/data/inject-type/inject-type-data.service';
import { InjectTypeQuery } from 'src/app/data/inject-type/inject-type.query';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { TeamQuery } from 'src/app/data/team/team.query';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { InjectType } from 'src/app/generated/blueprint.api';
import { MatDialog } from '@angular/material/dialog';

async function renderAdminInjectTypes(
  overrides: {
    canEdit?: boolean;
    injectTypes?: InjectType[];
  } = {},
) {
  const { canEdit = false, injectTypes = [] } = overrides;
  const injectTypesSubject = new BehaviorSubject<InjectType[]>(injectTypes);

  return renderComponent(AdminInjectTypesComponent, {
    declarations: [AdminInjectTypesComponent],
    imports: [MatTableModule, MatPaginatorModule, MatSortModule],
    componentProperties: { canEdit, loggedInUserId: 'user-1' },
    providers: [
      {
        provide: InjectTypeDataService,
        useValue: {
          load: () => of(injectTypes),
          add: () => of({}),
          update: () => of({}),
          delete: () => of({}),
        },
      },
      {
        provide: InjectTypeQuery,
        useValue: {
          selectAll: () => injectTypesSubject.asObservable(),
          select: () => of(null),
          selectEntity: () => of(null),
        },
      },
      {
        provide: MselQuery,
        useValue: {
          selectAll: () => of([]),
          select: () => of(null),
          selectActive: () => of(null),
          selectEntity: () => of(null),
          selectLoading: () => of(false),
        },
      },
      {
        provide: TeamQuery,
        useValue: {
          selectAll: () => of([]),
          select: () => of(null),
          selectEntity: () => of(null),
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

describe('AdminInjectTypesComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderAdminInjectTypes();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show Add button when canEdit is true', async () => {
    const { fixture } = await renderAdminInjectTypes({ canEdit: true });
    fixture.detectChanges();
    const addButton = fixture.nativeElement.querySelector(
      'button[title="Add new inject type"]',
    );
    expect(addButton).toBeTruthy();
  });

  it('should hide Add button when canEdit is false', async () => {
    const { fixture } = await renderAdminInjectTypes({ canEdit: false });
    fixture.detectChanges();
    const addButton = fixture.nativeElement.querySelector(
      'button[title="Add new inject type"]',
    );
    expect(addButton).toBeNull();
  });

  it('should display inject type name in the table', async () => {
    const injectTypes: InjectType[] = [
      { id: 'it-1', name: 'Email Inject', description: 'Email-based inject' },
    ];
    await renderAdminInjectTypes({ injectTypes });
    expect(screen.getByText('Email Inject')).toBeInTheDocument();
  });

  it('should display No Inject Types found when empty', async () => {
    await renderAdminInjectTypes({ injectTypes: [] });
    expect(screen.getByText('No Inject Types found')).toBeInTheDocument();
  });
});
