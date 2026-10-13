// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { afterEach, describe, it, expect, vi } from 'vitest';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NgxMatDatepickerActions, NgxMatDatepickerApply, NgxMatDatepickerCancel, NgxMatDatepickerInput, NgxMatDatetimepicker } from '@ngxmc/datetime-picker';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { DataField, DataFieldType, MselItemStatus } from 'src/app/generated/blueprint.api';
import { DataValueComponent } from './data-value.component';
import { TimezoneAbbrPipe } from 'src/app/utilities/timezone-abbr';
import { renderComponent } from 'src/app/test-utils/render-component';

const SUBJECT: DataField = { id: 'df-subject', name: 'Subject', dataType: DataFieldType.String };
const STATUS: DataField = { id: 'df-status', name: 'Status', dataType: DataFieldType.Status };
const ASSIGNED: DataField = { id: 'df-team', name: 'Assigned To', dataType: DataFieldType.Team };
const WHEN: DataField = { id: 'df-when', name: 'When', dataType: DataFieldType.DateTime };

interface Flags {
  canEdit?: boolean;
  canApprove?: boolean;
  isOwner?: boolean;
  showValueOnly?: boolean;
}

async function renderDataValue(dataField: DataField, value: string, flags: Flags = {}) {
  const { canEdit = false, canApprove = false, isOwner = false, showValueOnly = false } = flags;
  const rendered = await renderComponent(DataValueComponent, {
    imports: [
      MatCheckboxModule,
      MatDatepickerModule,
      MatFormFieldModule,
      MatInputModule,
      MatNativeDateModule,
      MatSelectModule,
      MatTooltipModule,
      NgxMatDatepickerActions,
      NgxMatDatepickerApply,
      NgxMatDatepickerCancel,
      NgxMatDatepickerInput,
      NgxMatDatetimepicker,
    ],
    declarations: [DataValueComponent, TimezoneAbbrPipe],
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
  // A test that sets TZ runs in a zone with daylight saving time; this restores the host's.
  afterEach(() => {
    vi.unstubAllEnvs();
  });

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

  /**
   * Verifies: a DateTime value is labelled with the zone in effect on that date, in each of the three places the template shows it.
   * Interacts with: DatePipe, TimezoneAbbrPipe in the DataValueComponent template (view-only display, editable field, value-only view for an editor).
   * Data: TZ America/New_York; When = 12 Oct 2026 16:00 UTC (EDT) or 12 Nov 2026 17:00 UTC (EST, after DST ends); showValueOnly with no flags, canEdit alone, or showValueOnly with canEdit, canApprove and isOwner.
   */
  it.each(
    [
      { view: 'shown read-only', flags: { showValueOnly: true } },
      { view: 'in the editable field', flags: { canEdit: true } },
      { view: 'shown as a value to its editor', flags: { showValueOnly: true, canEdit: true, canApprove: true, isOwner: true } },
    ].flatMap((v) => [
      { ...v, value: '2026-10-12T16:00:00Z', label: '12 Oct 2026 12:00 EDT' },
      { ...v, value: '2026-11-12T17:00:00Z', label: '12 Nov 2026 12:00 EST' },
    ]),
  )('labels a date-time value $view as $label', async ({ flags, value, label }) => {
    vi.stubEnv('TZ', 'America/New_York');

    await renderDataValue(WHEN, value, flags);

    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
