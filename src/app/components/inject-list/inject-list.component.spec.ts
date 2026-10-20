// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, EventEmitter, Output, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import {
  Catalog,
  CatalogInject,
  CatalogInjectService,
  DataField,
  DataFieldService,
  InjectService,
  InjectType,
  Injectm,
} from 'src/app/generated/blueprint.api';
import { CatalogInjectDataService } from 'src/app/data/catalog-inject/catalog-inject-data.service';
import { InjectListComponent } from './inject-list.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { unstubbed } from 'src/app/test-utils/unstubbed';

@Component({ selector: 'app-data-value', template: '', standalone: false })
class DataValueStub {
  readonly value = input<string>(undefined);
  @Output() valueChange = new EventEmitter<string>();
  readonly dataField = input<DataField>(undefined);
  readonly canEdit = input<boolean>(undefined);
  readonly canApprove = input<boolean>(undefined);
  readonly isOwner = input<boolean>(undefined);
  readonly showValueOnly = input<boolean>(undefined);
  readonly organizationOptions = input<unknown[]>(undefined);
  readonly teamOptions = input<unknown[]>(undefined);
  readonly unitOptions = input<unknown[]>(undefined);
  readonly cardOptions = input<unknown[]>(undefined);
  readonly moveOptions = input<unknown[]>(undefined);
  readonly gallerySourceTypeOptions = input<unknown[]>(undefined);
  readonly galleryItemStatusOptions = input<string[]>(undefined);
  readonly userOptions = input<unknown[]>(undefined);
}

const PHISH: Injectm = { id: 'inj-1', name: 'Phish', description: 'Phishing email', injectTypeId: 'it-email', dataValues: [] };
const NOTE: Injectm = { id: 'inj-2', name: 'Ransom note', description: 'Ransom', injectTypeId: 'it-email', requiresInjectId: 'inj-1', dataValues: [] };
// An inject of another catalog, as that catalog's own inject list loads it.
const OTHER_CATALOG_INJECT: Injectm = { id: 'inj-9', name: 'Wiper', description: 'Disk wiper', injectTypeId: 'it-email', dataValues: [] };
const CATALOG: Catalog = { id: 'cat-1', name: 'Ransomware Catalog', injectTypeId: 'it-email' };
const EMAIL: InjectType = { id: 'it-email', name: 'Email' };

async function renderInjectList(
  overrides: { canEdit?: boolean; isEditMode?: boolean; catalog?: Catalog; injectType?: InjectType } = {},
) {
  const { canEdit = true, isEditMode = true, catalog = CATALOG, injectType = {} } = overrides;
  const catalogInjectApi = {
    getCatalogInjects: vi.fn((catalogId: string) =>
      of<CatalogInject[]>(
        structuredClone(
          catalogId === 'cat-1'
            ? [{ id: 'ci-1', catalogId: 'cat-1', injectId: 'inj-1', inject: PHISH }]
            : [{ id: 'ci-9', catalogId: 'cat-2', injectId: 'inj-9', inject: OTHER_CATALOG_INJECT }],
        ),
      ),
    ),
    deleteCatalogInjectByIds: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<CatalogInjectService>;
  const injectApi = {
    getInjectsByInjectType: vi.fn(() => of(structuredClone([PHISH, NOTE]))),
  } satisfies ApiStub<InjectService>;
  const dataFieldApi = {
    getDataFieldsByInjectType: vi.fn(() => of<DataField[]>([])),
  } satisfies ApiStub<DataFieldService>;
  // The user confirms every dialog.
  const confirm = vi.fn(() => dialogRefStub<unknown, boolean>(true).dialogRef);
  const dialog = { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>;
  const rendered = await renderComponent(InjectListComponent, {
    imports: [MatButtonModule, MatCheckboxModule, MatIconModule, MatMenuModule, MatSortModule, MatTableModule],
    declarations: [InjectListComponent, DataValueStub],
    providers: [
      { provide: CatalogInjectService, useValue: catalogInjectApi },
      { provide: InjectService, useValue: injectApi },
      { provide: DataFieldService, useValue: dataFieldApi },
      { provide: CrucibleDialogService, useValue: dialog },
      unstubbed(MatDialog),
    ],
    inputs: { canEdit, isEditMode, catalog, injectType, loggedInUserId: 'user-1' },
  });
  const selections: string[][] = [];
  rendered.fixture.componentInstance.selectedInjectIdList.subscribe((ids) => selections.push([...ids]));
  return { ...rendered, catalogInjectApi, injectApi, confirm, selections };
}

const table = () => screen.getByRole('table');
const ROW_ACTIONS = ['Edit Phish inject', 'Copy Phish', 'Delete Phish inject'];

describe('InjectListComponent', () => {
  /**
   * Verifies: in a catalog with canEdit the injects load and Add, Edit, Copy and Delete are offered.
   * Interacts with: CatalogInjectService.getCatalogInjects and DataFieldService.getDataFieldsByInjectType (stubs), real CatalogInjectDataService.
   * Data: canEdit true; edit mode; catalog cat-1 holding Phish.
   */
  it('offers inject actions in a catalog with canEdit', async () => {
    const { catalogInjectApi } = await renderInjectList({ canEdit: true });

    expect(catalogInjectApi.getCatalogInjects).toHaveBeenCalledWith('cat-1');
    expect(within(table()).getByTitle('Add Inject')).toBeInTheDocument();
    for (const name of ROW_ACTIONS) {
      expect(within(table()).getByRole('button', { name })).toBeInTheDocument();
    }
  });

  /**
   * Verifies: without canEdit the catalog's injects are listed with no Add, Edit, Copy or Delete.
   * Interacts with: InjectListComponent template.
   * Data: canEdit false; edit mode; catalog cat-1 holding Phish.
   */
  it('hides inject actions without canEdit', async () => {
    await renderInjectList({ canEdit: false });

    expect(within(table()).getByText('Phish')).toBeInTheDocument();
    expect(within(table()).queryByTitle('Add Inject')).not.toBeInTheDocument();
    for (const name of ROW_ACTIONS) {
      expect(within(table()).queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  /**
   * Verifies: Delete in a catalog removes the inject from the catalog without a confirmation.
   * Interacts with: CatalogInjectService.deleteCatalogInjectByIds (stub), CrucibleDialogService.confirm (not called).
   * Data: canEdit true; catalog cat-1 holding Phish.
   */
  it('removes an inject from the catalog', async () => {
    const { catalogInjectApi, confirm } = await renderInjectList({ canEdit: true });
    const user = userEvent.setup();

    await user.click(within(table()).getByRole('button', { name: 'Delete Phish inject' }));

    expect(catalogInjectApi.deleteCatalogInjectByIds).toHaveBeenCalledWith('cat-1', 'inj-1');
    expect(confirm).not.toHaveBeenCalled();
  });

  /**
   * Verifies: after another catalog's injects load, this catalog's list shows that catalog's injects instead of its own (current behavior).
   * Interacts with: real CatalogInjectDataService.loadByCatalog (as a second InjectListComponent calls it), real CatalogInjectQuery.
   * Data: cat-1 holds Phish; cat-2 holds Wiper and is loaded afterwards.
   */
  it('shows the injects of the catalog loaded last', async () => {
    const { fixture } = await renderInjectList({ canEdit: true });

    TestBed.inject(CatalogInjectDataService).loadByCatalog('cat-2');
    fixture.detectChanges();

    // Current behavior; see agent-docs/ui-test-bugs/blueprint.ui.md.
    expect(within(table()).getByText('Wiper')).toBeInTheDocument();
    expect(within(table()).queryByText('Phish')).not.toBeInTheDocument();
  });

  /**
   * Verifies: in select mode an inject type's injects get checkboxes, and choosing one that requires another asks to add both, then emits both ids.
   * Interacts with: InjectService.getInjectsByInjectType (stub), mat-checkbox change, CrucibleDialogService.confirm (stub, confirms), selectedInjectIdList output.
   * Data: select mode (isEditMode false); inject type Email; Ransom note requires Phish.
   */
  it('selects an inject together with its prerequisite', async () => {
    const { injectApi, confirm, selections } = await renderInjectList({
      isEditMode: false,
      canEdit: false,
      catalog: {},
      injectType: EMAIL,
    });
    const user = userEvent.setup();

    expect(injectApi.getInjectsByInjectType).toHaveBeenCalledWith('it-email');
    const noteRow = within(table()).getByText('Ransom note').closest('mat-row') as HTMLElement;
    await user.click(within(noteRow).getByRole('checkbox'));

    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Inject Requires Additional Injects' }));
    expect(selections).toEqual([['inj-1', 'inj-2']]);
    expect(within(table()).queryByRole('button', { name: 'Edit Ransom note inject' })).not.toBeInTheDocument();
  });
});
