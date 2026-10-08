// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { DataField, DataFieldType, MselItemStatus } from 'src/app/generated/blueprint.api';
import { DataValueComponent } from './data-value.component';
import { renderComponent } from 'src/app/test-utils/render-component';

const SUBJECT: DataField = { id: 'df-subject', name: 'Subject', dataType: DataFieldType.String };
const STATUS: DataField = { id: 'df-status', name: 'Status', dataType: DataFieldType.Status };
const ASSIGNED: DataField = { id: 'df-team', name: 'Assigned To', dataType: DataFieldType.Team };

interface Flags {
  canEdit?: boolean;
  canApprove?: boolean;
  isOwner?: boolean;
  showValueOnly?: boolean;
}

async function renderDataValue(dataField: DataField, value: string, flags: Flags = {}) {
  const { canEdit = false, canApprove = false, isOwner = false, showValueOnly = false } = flags;
  const rendered = await renderComponent(DataValueComponent, {
    imports: [MatCheckboxModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatTooltipModule],
    declarations: [DataValueComponent],
    inputs: {
      dataField,
      value,
      canEdit,
      canApprove,
      isOwner,
      showValueOnly,
      unitOptions: [{ id: 'unit-blue', shortName: 'BLUE' }, { id: 'unit-red', shortName: 'RED' }],
    },
  });
  // ngModel applies [disabled] in a microtask.
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();
  const changes: string[] = [];
  rendered.fixture.componentInstance.valueChange.subscribe((v) => changes.push(v));
  return { ...rendered, changes };
}

describe('DataValueComponent', () => {
  /**
   * Verifies: a string value is editable with canEdit and emits each change.
   * Interacts with: ngModel, valueChange output.
   * Data: Subject = "Urgent"; canEdit true; "!" typed.
   */
  it('edits a string value with canEdit', async () => {
    const { changes } = await renderDataValue(SUBJECT, 'Urgent', { canEdit: true });
    const user = userEvent.setup();

    const input = screen.getByRole('textbox', { name: 'Subject' });
    expect(input).toBeEnabled();
    await user.type(input, '!');

    expect(changes).toEqual(['Urgent!']);
  });

  /**
   * Verifies: without canEdit the string input is disabled, even for an approver who owns the event.
   * Interacts with: DataValueComponent template.
   * Data: Subject; canEdit false, canApprove true, isOwner true (near miss: other flags granted).
   */
  it('disables a string value without canEdit', async () => {
    await renderDataValue(SUBJECT, 'Urgent', { canEdit: false, canApprove: true, isOwner: true });

    expect(screen.getByRole('textbox', { name: 'Subject' })).toBeDisabled();
  });

  /**
   * Verifies: the Status select follows canApprove alone: enabled with it, disabled without it even with canEdit and isOwner.
   * Interacts with: mat-select [disabled].
   * Data: Status = Pending; canApprove true, or canApprove false with canEdit and isOwner true.
   */
  it.each([
    { canApprove: true, disabled: 'false' },
    { canApprove: false, disabled: 'true' },
  ])('sets the Status select aria-disabled $disabled with canApprove $canApprove', async ({ canApprove, disabled }) => {
    await renderDataValue(STATUS, MselItemStatus.Pending, { canApprove, canEdit: true, isOwner: true });

    expect(screen.getByRole('combobox')).toHaveAttribute('aria-disabled', disabled);
  });

  /**
   * Verifies: the assigned-unit select follows isOwner alone: enabled for the owner, disabled otherwise even with canEdit and canApprove.
   * Interacts with: mat-select [disabled].
   * Data: Assigned To = BLUE; isOwner true, or isOwner false with canEdit and canApprove true.
   */
  it.each([
    { isOwner: true, disabled: 'false' },
    { isOwner: false, disabled: 'true' },
  ])('sets the Assigned To select aria-disabled $disabled with isOwner $isOwner', async ({ isOwner, disabled }) => {
    await renderDataValue(ASSIGNED, 'BLUE', { isOwner, canEdit: true, canApprove: true });

    expect(screen.getByRole('combobox')).toHaveAttribute('aria-disabled', disabled);
  });

  /**
   * Verifies: the owner can reassign the event to another unit.
   * Interacts with: mat-select options, valueChange output.
   * Data: Assigned To = BLUE; isOwner true; RED chosen.
   */
  it('reassigns the unit as the owner', async () => {
    const { changes } = await renderDataValue(ASSIGNED, 'BLUE', { isOwner: true });
    const user = userEvent.setup();

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'RED' }));

    expect(changes).toEqual(['RED']);
  });

  /**
   * Verifies: with showValueOnly and no edit, approve or owner flag the value is shown as text, with no control.
   * Interacts with: the view-only branch of the template.
   * Data: Subject = "Urgent"; every flag false.
   */
  it('shows only the text without any edit flag', async () => {
    await renderDataValue(SUBJECT, 'Urgent', { showValueOnly: true });

    expect(screen.getByText('Urgent')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
