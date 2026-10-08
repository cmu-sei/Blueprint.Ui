// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { AngularEditorModule } from '@kolkov/angular-editor';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { OrganizationEditDialogComponent } from './organization-edit-dialog.component';
import { renderComponent } from 'src/app/test-utils/render-component';

const ORGANIZATION = { id: 'org-1', mselId: 'msel-1', name: 'City Police', shortName: 'CPD', summary: 'Local police', email: 'police@example.com', description: '' };

function dialogData(overrides: Partial<typeof ORGANIZATION> = {}) {
  return { organization: { ...structuredClone(ORGANIZATION), ...overrides }, title: 'Edit Organization' };
}

async function renderOrganizationEditDialog(data = dialogData()) {
  const rendered = await renderComponent(OrganizationEditDialogComponent, {
    imports: [...CRUCIBLE_DIALOG_IMPORTS, AngularEditorModule, MatFormFieldModule, MatInputModule],
    declarations: [OrganizationEditDialogComponent],
    // angular-editor injects HttpClient for its image upload.
    providers: [{ provide: MAT_DIALOG_DATA, useValue: data }, provideHttpClient(), provideHttpClientTesting()],
  });
  // ngModel writes the values into the inputs in a microtask.
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();
  const results: unknown[] = [];
  rendered.fixture.componentInstance.editComplete.subscribe((r) => results.push(r));
  return { ...rendered, data, results };
}

// angular-editor's toolbar makes whole-document role queries slow, so the
// buttons are looked up in the dialog actions.
const actions = () => within(document.querySelector('mat-dialog-actions') as HTMLElement);

describe('OrganizationEditDialogComponent', () => {
  /**
   * Verifies: the component mounts with the default test providers and shows its title.
   * Interacts with: getDefaultProviders (placeholders and stubs only), crucible-dialog.
   * Data: organization City Police (CPD).
   */
  it('renders with the default test providers', async () => {
    const { fixture } = await renderOrganizationEditDialog();

    expect(fixture.componentInstance).toBeInstanceOf(OrganizationEditDialogComponent);
    expect(screen.getByRole('heading', { name: 'Edit Organization' })).toBeInTheDocument();
  });

  /**
   * Verifies: Save emits the organization and Cancel emits none.
   * Interacts with: crucible-dialog submit and cancel, editComplete output.
   * Data: organization City Police (CPD).
   */
  it('emits the organization on Save and none on Cancel', async () => {
    const { data, results } = await renderOrganizationEditDialog();
    const user = userEvent.setup();

    await user.click(actions().getByRole('button', { name: 'Save' }));
    await user.click(actions().getByRole('button', { name: 'Cancel' }));

    expect(results).toEqual([
      { saveChanges: true, organization: data.organization },
      { saveChanges: false, organization: null },
    ]);
  });

  /**
   * Verifies: Save is disabled while the organization is incomplete.
   * Interacts with: errorFree, crucible-dialog submitDisabled.
   * Data: an organization with no email.
   */
  it('disables Save for an incomplete organization', async () => {
    await renderOrganizationEditDialog(dialogData({ email: '' }));

    expect(actions().getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  /**
   * Verifies: handleEditComplete(true) emits the save for an incomplete organization (current behavior).
   * Interacts with: handleEditComplete, editComplete output.
   * Data: an organization with no email.
   */
  it('saves an incomplete organization when handleEditComplete is called', async () => {
    const { fixture, data, results } = await renderOrganizationEditDialog(dialogData({ email: '' }));

    fixture.componentInstance.handleEditComplete(true);

    // Current behavior; see agent-docs/ui-test-bugs/blueprint.ui.md.
    expect(results).toEqual([{ saveChanges: true, organization: data.organization }]);
  });
});
