// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { NgxMatDatepickerActions, NgxMatDatepickerApply, NgxMatDatepickerCancel, NgxMatDatepickerInput, NgxMatDatetimepicker } from '@ngxmc/datetime-picker';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { Invitation } from 'src/app/generated/blueprint.api';
import { InvitationEditDialogComponent } from './invitation-edit-dialog.component';
import { renderComponent } from 'src/app/test-utils/render-component';

const INVITATION = { id: 'inv-1', mselId: 'msel-1', teamId: 'team-1', emailDomain: '@example.com', expirationDateTime: new Date('2026-12-31T12:00:00Z'), maxUsersAllowed: 5, userCount: 0, isTeamLeader: false } as Invitation;

function dialogData(overrides: Partial<typeof INVITATION> = {}) {
  return { invitation: { ...structuredClone(INVITATION), ...overrides }, teamList: [{ id: 'team-1', mselId: 'msel-1', name: 'Blue Team', shortName: 'BLUE' }] };
}

async function renderInvitationEditDialog(data = dialogData()) {
  const rendered = await renderComponent(InvitationEditDialogComponent, {
    imports: [...CRUCIBLE_DIALOG_IMPORTS, MatCheckboxModule, MatDatepickerModule, MatFormFieldModule, MatInputModule, MatNativeDateModule, MatSelectModule, NgxMatDatepickerActions, NgxMatDatepickerApply, NgxMatDatepickerCancel, NgxMatDatepickerInput, NgxMatDatetimepicker],
    declarations: [InvitationEditDialogComponent],
    providers: [{ provide: MAT_DIALOG_DATA, useValue: data }],
  });
  // ngModel writes the values into the inputs in a microtask.
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();
  const results: unknown[] = [];
  rendered.fixture.componentInstance.editComplete.subscribe((r) => results.push(r));
  return { ...rendered, data, results };
}

describe('InvitationEditDialogComponent', () => {
  /**
   * Verifies: the component mounts with the default test providers and shows its title.
   * Interacts with: getDefaultProviders (placeholders and stubs only), crucible-dialog.
   * Data: invitation for BLUE limited to @example.com.
   */
  it('renders with the default test providers', async () => {
    const { fixture } = await renderInvitationEditDialog();

    expect(fixture.componentInstance).toBeInstanceOf(InvitationEditDialogComponent);
    expect(screen.getByRole('heading', { name: 'Edit an Invitation to this MSEL' })).toBeInTheDocument();
    expect(screen.getByText(/BLUE - Blue Team/)).toBeInTheDocument();
  });

  /**
   * Verifies: Save emits the invitation and Cancel emits none.
   * Interacts with: crucible-dialog submit and cancel, editComplete output.
   * Data: invitation for BLUE limited to @example.com.
   */
  it('emits the invitation on Save and none on Cancel', async () => {
    const { data, results } = await renderInvitationEditDialog();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(results).toEqual([
      { saveChanges: true, invitation: data.invitation },
      { saveChanges: false, invitation: null },
    ]);
  });

  /**
   * Verifies: Save is disabled while the invitation is incomplete.
   * Interacts with: errorFree, crucible-dialog submitDisabled.
   * Data: an email domain without an @.
   */
  it('disables Save for an incomplete invitation', async () => {
    await renderInvitationEditDialog(dialogData({ emailDomain: 'abc' }));

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  /**
   * Verifies: handleEditComplete(true) emits the save for an incomplete invitation (current behavior).
   * Interacts with: handleEditComplete, editComplete output.
   * Data: an email domain without an @.
   */
  it('saves an incomplete invitation when handleEditComplete is called', async () => {
    const { fixture, data, results } = await renderInvitationEditDialog(dialogData({ emailDomain: 'abc' }));

    fixture.componentInstance.handleEditComplete(true);

    // Current behavior; see agent-docs/ui-test-bugs/blueprint.ui.md.
    expect(results).toEqual([{ saveChanges: true, invitation: data.invitation }]);
  });
});
