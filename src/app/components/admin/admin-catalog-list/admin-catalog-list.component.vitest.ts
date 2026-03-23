// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import { BehaviorSubject, of } from 'rxjs';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { AdminCatalogListComponent } from './admin-catalog-list.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { CatalogDataService } from 'src/app/data/catalog/catalog-data.service';
import { CatalogQuery } from 'src/app/data/catalog/catalog.query';
import { InjectTypeQuery } from 'src/app/data/inject-type/inject-type.query';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { Catalog } from 'src/app/generated/blueprint.api';
import { MatDialog } from '@angular/material/dialog';

async function renderAdminCatalogList(
  overrides: {
    canEdit?: boolean;
    catalogs?: Catalog[];
  } = {},
) {
  const { canEdit = false, catalogs = [] } = overrides;
  const catalogsSubject = new BehaviorSubject<Catalog[]>(catalogs);

  return renderComponent(AdminCatalogListComponent, {
    declarations: [AdminCatalogListComponent],
    imports: [
      MatTableModule,
      MatPaginatorModule,
      MatSortModule,
      ReactiveFormsModule,
      FormsModule,
      MatInputModule,
      MatCheckboxModule,
    ],
    componentProperties: { canEdit, loggedInUserId: 'user-1' },
    providers: [
      {
        provide: CatalogDataService,
        useValue: {
          load: () => of(catalogs),
          add: () => of({}),
          update: () => of({}),
          delete: () => of({}),
          downloadJson: () => of(new Blob()),
        },
      },
      {
        provide: CatalogQuery,
        useValue: {
          selectAll: () => catalogsSubject.asObservable(),
          select: () => of(null),
          selectEntity: () => of(null),
        },
      },
      {
        provide: InjectTypeQuery,
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

describe('AdminCatalogListComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderAdminCatalogList();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show Add new Catalog button when canEdit is true', async () => {
    const { fixture } = await renderAdminCatalogList({ canEdit: true });
    fixture.detectChanges();
    const addButton = fixture.nativeElement.querySelector(
      'button[title="Add new Catalog"]',
    );
    expect(addButton).toBeTruthy();
  });

  it('should hide Add new Catalog button when canEdit is false', async () => {
    const { fixture } = await renderAdminCatalogList({ canEdit: false });
    fixture.detectChanges();
    const addButton = fixture.nativeElement.querySelector(
      'button[title="Add new Catalog"]',
    );
    expect(addButton).toBeNull();
  });

  it('should show upload button when canEdit is true', async () => {
    const { fixture } = await renderAdminCatalogList({ canEdit: true });
    fixture.detectChanges();
    const uploadButton = fixture.nativeElement.querySelector(
      'button[title="Upload a new catalog from a file"]',
    );
    expect(uploadButton).toBeTruthy();
  });

  it('should hide upload button when canEdit is false', async () => {
    const { fixture } = await renderAdminCatalogList({ canEdit: false });
    fixture.detectChanges();
    const uploadButton = fixture.nativeElement.querySelector(
      'button[title="Upload a new catalog from a file"]',
    );
    expect(uploadButton).toBeNull();
  });

  it('should display No Catalogs found when empty', async () => {
    await renderAdminCatalogList({ catalogs: [] });
    expect(screen.getByText('No Catalogs found')).toBeInTheDocument();
  });

  it('should display catalog name in the table', async () => {
    const catalogs: Catalog[] = [
      { id: 'cat-1', name: 'Test Catalog', description: 'A test catalog' },
    ];
    await renderAdminCatalogList({ catalogs });
    expect(screen.getByText('Test Catalog')).toBeInTheDocument();
  });
});
