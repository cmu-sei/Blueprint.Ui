// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { afterEach, describe, it, expect, vi } from 'vitest';
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
import { TimezoneAbbrPipe } from 'src/app/utilities/timezone-abbr';
import { renderComponent } from 'src/app/test-utils/render-component';

const INVITATION = { id: 'inv-1', mselId: 'msel-1', teamId: 'team-1', emailDomain: '@example.com', expirationDateTime: new Date('2026-12-31T12:00:00Z'), maxUsersAllowed: 5, userCount: 0, isTeamLeader: false } as Invitation;

function dialogData(overrides: Partial<typeof INVITATION> = {}, cite: { useCite?: boolean; citeTeamRoles?: string[] } = {}) {
  return {
    invitation: { ...structuredClone(INVITATION), ...overrides },
    teamList: [{ id: 'team-1', mselId: 'msel-1', name: 'Blue Team', shortName: 'BLUE' }],
    useCite: cite.useCite ?? false,
    citeTeamRoles: cite.citeTeamRoles ?? [],
  };
}

async function renderInvitationEditDialog(data = dialogData()) {
  const rendered = await renderComponent(InvitationEditDialogComponent, {
    imports: [...CRUCIBLE_DIALOG_IMPORTS, MatCheckboxModule, MatDatepickerModule, MatFormFieldModule, MatInputModule, MatNativeDateModule, MatSelectModule, NgxMatDatepickerActions, NgxMatDatepickerApply, NgxMatDatepickerCancel, NgxMatDatepickerInput, NgxMatDatetimepicker],
    declarations: [InvitationEditDialogComponent, TimezoneAbbrPipe],
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
  // A test that sets TZ runs in a zone with daylight saving time; this restores the host's.
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  /**
   * Verifies: with CITE the invitation's CITE team role is shown and the chosen role is saved with it.
   * Interacts with: the CITE Team Role select, crucible-dialog submit, editComplete output.
   * Data: useCite true; CITE roles Member and Contributor; the invitation gives Member.
   */
  it('saves the CITE team role chosen for the invitation', async () => {
    const { results } = await renderInvitationEditDialog(
      dialogData({ citeTeamRole: 'Member' }, { useCite: true, citeTeamRoles: ['Member', 'Contributor'] })
    );
    const user = userEvent.setup();

    const select = screen.getByRole('combobox', { name: 'CITE Team Role' });
    expect(select).toHaveTextContent('Member');
    await user.click(select);
    await user.click(screen.getByRole('option', { name: 'Contributor' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(results).toEqual([expect.objectContaining({ saveChanges: true, invitation: expect.objectContaining({ citeTeamRole: 'Contributor' }) })]);
  });

  /**
   * Verifies: without CITE there is no CITE team role to choose.
   * Interacts with: InvitationEditDialogComponent template.
   * Data: useCite false.
   */
  it('hides the CITE team role without CITE', async () => {
    await renderInvitationEditDialog();

    expect(screen.queryByRole('combobox', { name: 'CITE Team Role' })).not.toBeInTheDocument();
  });

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

  /**
   * Verifies: the expiration time is labelled with the zone in effect on that date.
   * Interacts with: DatePipe, TimezoneAbbrPipe in the expiration field.
   * Data: TZ America/New_York; expiration 20 Oct 2026 16:00 UTC (EDT) or 20 Nov 2026 17:00 UTC (EST, after DST ends).
   */
  it.each([
    { date: '2026-10-20T16:00:00Z', label: '20 Oct 2026 12:00 EDT' },
    { date: '2026-11-20T17:00:00Z', label: '20 Nov 2026 12:00 EST' },
  ])('labels the expiration time with the zone in effect on that date ($label)', async ({ date, label }) => {
    vi.stubEnv('TZ', 'America/New_York');

    await renderInvitationEditDialog(dialogData({ expirationDateTime: new Date(date) }));

    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
