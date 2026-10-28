// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, input, output } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ProfileWriterComponent } from '../profile-writer/profile-writer.component';
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

@Component({ selector: 'app-profile-writer', template: '' })
class ProfileWriterStub {
  readonly kind = input<string>(undefined);
  readonly mselId = input<string>(undefined);
  readonly shortName = input<string>(undefined);
  readonly name = input<string>(undefined);
  readonly summary = input<string>(undefined);
  readonly description = input<string>(undefined);
  readonly useProfile = output<string>();
}

async function renderOrganizationEditDialog(data = dialogData()) {
  const rendered = await renderComponent(OrganizationEditDialogComponent, {
    imports: [...CRUCIBLE_DIALOG_IMPORTS, AngularEditorModule, MatFormFieldModule, MatInputModule],
    declarations: [OrganizationEditDialogComponent],
    childStubs: [{ replace: ProfileWriterComponent, with: ProfileWriterStub }],
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

  /**
   * Verifies: a MSEL's organization offers Write with AI with its names, summary and description, and a used profile becomes the description.
   * Interacts with: ProfileWriterStub inputs and useProfile.
   * Data: organization CPD "City Police", summary "Local police", on msel-1; the profile "<h2>CPD</h2>".
   */
  it('writes the description with AI for a MSEL organization', async () => {
    const { fixture, data } = await renderOrganizationEditDialog();

    const writer = fixture.debugElement.query(By.directive(ProfileWriterStub)).componentInstance as ProfileWriterStub;
    expect([writer.kind(), writer.mselId(), writer.shortName(), writer.name(), writer.summary()]).toEqual(['organization', 'msel-1', 'CPD', 'City Police', 'Local police']);
    writer.useProfile.emit('<h2>CPD</h2>');

    expect(data.organization.description).toBe('<h2>CPD</h2>');
  });

  /**
   * Verifies: a template organization, on no MSEL, has no Write with AI.
   * Interacts with: OrganizationEditDialogComponent template.
   * Data: organization CPD with no MSEL.
   */
  it('offers no Write with AI for an organization on no MSEL', async () => {
    const { fixture } = await renderOrganizationEditDialog(dialogData({ mselId: null }));

    expect(fixture.debugElement.query(By.directive(ProfileWriterStub))).toBeNull();
  });
});
