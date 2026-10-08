// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { of } from 'rxjs';
import { Catalog, DataField, DataFieldService } from 'src/app/generated/blueprint.api';
import { AdminCatalogEditDialogComponent } from './admin-catalog-edit-dialog.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';

const CATALOG = { id: 'cat-1', name: 'Ransomware Catalog', description: 'Ransomware injects', injectTypeId: 'it-email', isPublic: false, listDataFields: '' } as Catalog;

function dialogData(overrides: Partial<typeof CATALOG> = {}) {
  return { catalog: { ...structuredClone(CATALOG), ...overrides }, injectTypeList: [{ id: 'it-email', name: 'Email' }] };
}

async function renderAdminCatalogEditDialog(data = dialogData()) {
  const dataFieldApi = {
    getDataFieldsByInjectType: vi.fn(() => of<DataField[]>([{ id: 'df-1', injectTypeId: 'it-email', name: 'Subject', displayOrder: 1 }])),
  } satisfies ApiStub<DataFieldService>;
  const rendered = await renderComponent(AdminCatalogEditDialogComponent, {
    imports: [...CRUCIBLE_DIALOG_IMPORTS, MatCheckboxModule, MatFormFieldModule, MatInputModule, MatSelectModule],
    declarations: [AdminCatalogEditDialogComponent],
    providers: [{ provide: MAT_DIALOG_DATA, useValue: data }, { provide: DataFieldService, useValue: dataFieldApi }],
  });
  // ngModel writes the values into the inputs in a microtask.
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();
  const results: unknown[] = [];
  rendered.fixture.componentInstance.editComplete.subscribe((r) => results.push(r));
  return { ...rendered, data, results, dataFieldApi };
}

describe('AdminCatalogEditDialogComponent', () => {
  /**
   * Verifies: the component mounts with the default test providers and shows its title.
   * Interacts with: getDefaultProviders (placeholders and stubs only), crucible-dialog.
   * Data: catalog Ransomware Catalog of inject type Email, whose data field Subject loads from the API.
   */
  it('renders with the default test providers', async () => {
    const { fixture } = await renderAdminCatalogEditDialog();

    expect(fixture.componentInstance).toBeInstanceOf(AdminCatalogEditDialogComponent);
    expect(screen.getByRole('heading', { name: 'Edit Catalog' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Subject' })).toBeInTheDocument();
  });

  /**
   * Verifies: Save emits the catalog and Cancel emits none.
   * Interacts with: crucible-dialog submit and cancel, editComplete output.
   * Data: catalog Ransomware Catalog of inject type Email, whose data field Subject loads from the API.
   */
  it('emits the catalog on Save and none on Cancel', async () => {
    const { data, results } = await renderAdminCatalogEditDialog();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(results).toEqual([
      { saveChanges: true, catalog: data.catalog },
      { saveChanges: false, catalog: null },
    ]);
  });

  /**
   * Verifies: Save is disabled while the catalog is incomplete.
   * Interacts with: errorFree, crucible-dialog submitDisabled.
   * Data: a catalog with no description.
   */
  it('disables Save for an incomplete catalog', async () => {
    await renderAdminCatalogEditDialog(dialogData({ description: '' }));

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  /**
   * Verifies: handleEditComplete(true) emits the save for an incomplete catalog (current behavior).
   * Interacts with: handleEditComplete, editComplete output.
   * Data: a catalog with no description.
   */
  it('saves an incomplete catalog when handleEditComplete is called', async () => {
    const { fixture, data, results } = await renderAdminCatalogEditDialog(dialogData({ description: '' }));

    fixture.componentInstance.handleEditComplete(true);

    // Current behavior; see agent-docs/ui-test-bugs/blueprint.ui.md.
    expect(results).toEqual([{ saveChanges: true, catalog: data.catalog }]);
  });
});
