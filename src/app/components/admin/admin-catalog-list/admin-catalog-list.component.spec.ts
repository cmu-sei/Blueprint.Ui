// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, Type, input, output } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRippleModule } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { Catalog, CatalogService } from 'src/app/generated/blueprint.api';
import { AdminCatalogListComponent } from './admin-catalog-list.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { InjectListComponent } from '../../inject-list/inject-list.component';
import { CatalogUnitsComponent } from '../../catalog-units/catalog-units.component';

@Component({ selector: 'app-inject-list', template: '' })
class InjectListStub {
  readonly loggedInUserId = input<string>(undefined);
  readonly canEdit = input<boolean>(undefined);
  readonly isEditMode = input<boolean>(undefined);
  readonly catalog = input<Catalog>(undefined);
  readonly injectType = input<unknown>(undefined);
  readonly injectList = input<unknown>(undefined);
  readonly selectedInjectIdList = output<string[]>();
}
@Component({ selector: 'app-catalog-units', template: '' })
class CatalogUnitsStub {
  readonly loggedInUserId = input<string>(undefined);
  readonly canEdit = input<boolean>(undefined);
  readonly catalog = input<Catalog>(undefined);
}

const CATALOG: Catalog = {
  id: 'cat-1',
  name: 'Ransomware Catalog',
  description: 'Ransomware injects',
  injectTypeId: 'it-email',
  isPublic: false,
};

async function renderCatalogList(overrides: { canEdit?: boolean; catalogs?: Catalog[] } = {}) {
  const { canEdit = true, catalogs = [CATALOG] } = overrides;
  const catalogApi = {
    getCatalogs: vi.fn(() => of(structuredClone(catalogs))),
    copyCatalog: vi.fn(() => of(structuredClone(CATALOG))),
    deleteCatalog: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<CatalogService>;
  // The user confirms every dialog.
  const confirm = vi.fn(() => dialogRefStub<unknown, boolean>(true).dialogRef);
  const dialog = { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>;
  const open = vi.fn();
  const rendered = await renderComponent(AdminCatalogListComponent, {
    imports: [
      MatButtonModule,
      MatCheckboxModule,
      MatExpansionModule,
      MatFormFieldModule,
      MatIconModule,
      MatInputModule,
      MatPaginatorModule,
      MatRippleModule,
      MatSortModule,
      MatTableModule,
    ],
    childStubs: [
      { replace: InjectListComponent, with: InjectListStub },
      { replace: CatalogUnitsComponent, with: CatalogUnitsStub },
    ],
    providers: [
      { provide: CatalogService, useValue: catalogApi },
      { provide: CrucibleDialogService, useValue: dialog },
      { provide: MatDialog, useValue: { open } satisfies Pick<MatDialog, 'open'> },
    ],
    inputs: { canEdit, loggedInUserId: 'user-1' },
  });
  // ngModel applies [disabled] to the public checkbox in a microtask.
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();
  return { ...rendered, catalogApi, confirm, open };
}

const table = () => screen.getByRole('table');

function child<T>(fixture: ComponentFixture<unknown>, stub: Type<T>): T {
  return fixture.debugElement.query(By.directive(stub)).componentInstance;
}

describe('AdminCatalogListComponent', () => {
  /**
   * Verifies: the component loads the catalogs and lists them.
   * Interacts with: CatalogService.getCatalogs (stub), real CatalogDataService and CatalogQuery.
   * Data: one catalog.
   */
  it('lists the loaded catalogs', async () => {
    const { catalogApi } = await renderCatalogList();

    expect(catalogApi.getCatalogs).toHaveBeenCalledTimes(1);
    expect(within(table()).getByText('Ransomware Catalog')).toBeInTheDocument();
    expect(within(table()).getByText('Ransomware injects')).toBeInTheDocument();
  });

  /**
   * Verifies: with canEdit the Add and Upload buttons show, the row actions are enabled, and canEdit is passed to the inject and unit lists.
   * Interacts with: AdminCatalogListComponent template, child stubs' inputs.
   * Data: canEdit true; one catalog.
   */
  it('offers add, upload and row actions with canEdit', async () => {
    const { fixture } = await renderCatalogList({ canEdit: true });

    expect(within(table()).getByTitle('Add new Catalog')).toBeInTheDocument();
    expect(within(table()).getByTitle('Upload a new catalog from a file')).toBeInTheDocument();
    for (const title of [
      'Edit Ransomware Catalog catalog',
      'Copy Ransomware Catalog',
      'Download Ransomware Catalog',
      'Delete Ransomware Catalog catalog',
    ]) {
      expect(within(table()).getByRole('button', { name: title })).toBeEnabled();
    }
    expect(within(table()).getByRole('checkbox')).toBeEnabled();
    expect(child(fixture, InjectListStub).canEdit()).toBe(true);
    expect(child(fixture, CatalogUnitsStub).canEdit()).toBe(true);
  });

  /**
   * Verifies: without canEdit the Add and Upload buttons are absent, every row action and the public checkbox are disabled, and canEdit false reaches both child lists.
   * Interacts with: AdminCatalogListComponent template, child stubs' inputs.
   * Data: canEdit false; one catalog.
   */
  it('hides add and upload and disables row actions without canEdit', async () => {
    const { fixture } = await renderCatalogList({ canEdit: false });

    expect(within(table()).queryByTitle('Add new Catalog')).not.toBeInTheDocument();
    expect(within(table()).queryByTitle('Upload a new catalog from a file')).not.toBeInTheDocument();
    for (const title of [
      'Edit Ransomware Catalog catalog',
      'Copy Ransomware Catalog',
      'Download Ransomware Catalog',
      'Delete Ransomware Catalog catalog',
    ]) {
      expect(within(table()).getByRole('button', { name: title })).toBeDisabled();
    }
    expect(within(table()).getByRole('checkbox')).toBeDisabled();
    expect(child(fixture, InjectListStub).canEdit()).toBe(false);
    expect(child(fixture, CatalogUnitsStub).canEdit()).toBe(false);
  });

  /**
   * Verifies: before any row is expanded, every catalog already has its own inject list and unit list rendered (current behavior).
   * Interacts with: AdminCatalogListComponent template (detail row), child stubs' inputs.
   * Data: canEdit true; two catalogs; no row clicked.
   */
  it('renders the inject and unit lists of every catalog at once', async () => {
    const second: Catalog = { ...CATALOG, id: 'cat-2', name: 'Phishing Catalog', description: 'Phishing injects' };
    const { fixture } = await renderCatalogList({ catalogs: [CATALOG, second] });

    const catalogsOf = <T extends { catalog: () => Catalog }>(stub: Type<T>) =>
      fixture.debugElement.queryAll(By.directive(stub)).map((d) => (d.componentInstance as T).catalog().id);
    // Current behavior; see agent-docs/ui-test-bugs/blueprint.ui.md.
    expect(catalogsOf(InjectListStub).sort()).toEqual(['cat-1', 'cat-2']);
    expect(catalogsOf(CatalogUnitsStub).sort()).toEqual(['cat-1', 'cat-2']);
  });

  /**
   * Verifies: confirming Delete on a row deletes that catalog through the API and removes it from the list.
   * Interacts with: CrucibleDialogService.confirm (stub, confirms), CatalogService.deleteCatalog (stub), real CatalogStore.
   * Data: canEdit true; one catalog.
   */
  it('deletes a catalog after confirmation', async () => {
    const { catalogApi, confirm } = await renderCatalogList({ canEdit: true });
    const user = userEvent.setup();

    await user.click(within(table()).getByRole('button', { name: 'Delete Ransomware Catalog catalog' }));

    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delete Catalog' }));
    expect(catalogApi.deleteCatalog).toHaveBeenCalledWith('cat-1');
    expect(within(table()).queryByText('Ransomware Catalog')).not.toBeInTheDocument();
  });
});
