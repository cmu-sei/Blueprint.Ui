// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { of } from 'rxjs';
import { NetworkService } from 'src/app/generated/blueprint.api';
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

const ORGANIZATION: {
  id: string;
  mselId: string;
  name: string;
  shortName: string;
  summary: string;
  email: string;
  description: string;
  domain?: string;
} = {
  id: 'org-1',
  mselId: 'msel-1',
  name: 'City Police',
  shortName: 'CPD',
  summary: 'Local police',
  email: 'police@example.com',
  description: '',
};

function dialogData(overrides: Partial<typeof ORGANIZATION> = {}) {
  return {
    organization: { ...structuredClone(ORGANIZATION), ...overrides },
    title: 'Edit Organization',
  };
}

// the networks the dialog lists for the team or organization it edits
const networkApi = {
  getNetworksByMsel: vi.fn(() =>
    of([
      {
        id: 'n-lan',
        name: 'bank-lan',
        range: '10.20.0.0/24',
        teamIds: ['team-1'],
        organizationIds: ['org-1'],
      },
      { id: 'n-dmz', name: 'bank-dmz', teamIds: [], organizationIds: [] },
    ]),
  ),
};

async function renderOrganizationEditDialog(data = dialogData()) {
  const rendered = await renderComponent(OrganizationEditDialogComponent, {
    imports: [
      ...CRUCIBLE_DIALOG_IMPORTS,
      AngularEditorModule,
      MatFormFieldModule,
      MatInputModule,
    ],
    declarations: [OrganizationEditDialogComponent],
    // angular-editor injects HttpClient for its image upload.
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: NetworkService, useValue: networkApi },
      provideHttpClient(),
      provideHttpClientTesting(),
    ],
  });
  // ngModel writes the values into the inputs in a microtask.
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();
  const results: unknown[] = [];
  rendered.fixture.componentInstance.editComplete.subscribe((r) =>
    results.push(r),
  );
  return { ...rendered, data, results };
}

// angular-editor's toolbar makes whole-document role queries slow, so the
// buttons are looked up in the dialog actions.
const actions = () =>
  within(document.querySelector('mat-dialog-actions') as HTMLElement);

describe('OrganizationEditDialogComponent', () => {
  /**
   * Verifies: the component mounts with the default test providers and shows its title.
   * Interacts with: getDefaultProviders (placeholders and stubs only), crucible-dialog.
   * Data: organization City Police (CPD).
   */
  it('renders with the default test providers', async () => {
    const { fixture } = await renderOrganizationEditDialog();

    expect(fixture.componentInstance).toBeInstanceOf(
      OrganizationEditDialogComponent,
    );
    expect(
      screen.getByRole('heading', { name: 'Edit Organization' }),
    ).toBeInTheDocument();
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
   * Verifies: the dialog lists the networks the organization has access to, with their ranges, and says to change them on the Networks tab.
   * Data: bank-lan open to org-1, bank-dmz open to nobody.
   */
  it('lists the networks the organization has access to', async () => {
    await renderOrganizationEditDialog();

    expect(screen.getByText('Networks with access')).toBeInTheDocument();
    expect(screen.getByText('bank-lan')).toBeInTheDocument();
    expect(screen.getByText('10.20.0.0/24')).toBeInTheDocument();
    expect(screen.queryByText('bank-dmz')).toBeNull();
    expect(screen.getByText(/use the Networks tab/)).toBeInTheDocument();
  });

  /**
   * Verifies: the domain is saved trimmed and lower-cased.
   * Interacts with: the Domain input, saveOrganization, crucible-dialog submit.
   * Data: City Police with no domain; " Example-Police.org " entered, then saved.
   */
  it('saves the domain', async () => {
    const { data, results } = await renderOrganizationEditDialog();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Domain'), ' Example-Police.org ');
    await user.click(actions().getByRole('button', { name: 'Save' }));

    expect(results).toHaveLength(1);
    expect(data.organization.domain).toBe('example-police.org');
  });

  /**
   * Verifies: the email's domain is offered, not applied, and the button fills the Domain when chosen.
   * Interacts with: emailDomain, useEmailDomain, the Domain input.
   * Data: City Police with email police@example.com and no domain.
   */
  it('offers the email domain and applies it only when chosen', async () => {
    const { data } = await renderOrganizationEditDialog();
    const user = userEvent.setup();

    expect(screen.getByLabelText('Domain')).toHaveValue('');
    expect(data.organization.domain).toBeUndefined();

    await user.click(screen.getByRole('button', { name: 'Use example.com' }));

    expect(screen.getByLabelText('Domain')).toHaveValue('example.com');
    expect(data.organization.domain).toBe('example.com');
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
    const { fixture, data, results } = await renderOrganizationEditDialog(
      dialogData({ email: '' }),
    );

    fixture.componentInstance.handleEditComplete(true);

    // Current behavior; see agent-docs/ui-test-bugs/blueprint.ui.md.
    expect(results).toEqual([
      { saveChanges: true, organization: data.organization },
    ]);
  });
});
