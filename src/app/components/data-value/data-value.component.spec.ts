// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { afterEach, describe, it, expect, vi } from 'vitest';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSelectHarness } from '@angular/material/select/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NgxMatDatepickerActions, NgxMatDatepickerApply, NgxMatDatepickerCancel, NgxMatDatepickerInput, NgxMatDatetimepicker } from '@ngxmc/datetime-picker';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { DataField, DataFieldType, MselItemStatus } from 'src/app/generated/blueprint.api';
import { DataValueComponent } from './data-value.component';
import { TimezoneAbbrPipe } from 'src/app/utilities/timezone-abbr';
import { IsDateTimeValuePipe } from 'src/app/utilities/date-time-value';
import { renderComponent } from 'src/app/test-utils/render-component';

const SUBJECT: DataField = { id: 'df-subject', name: 'Subject', dataType: DataFieldType.String };
const STATUS: DataField = { id: 'df-status', name: 'Status', dataType: DataFieldType.Status };
const ASSIGNED: DataField = { id: 'df-team', name: 'Assigned To', dataType: DataFieldType.Team };
const WHEN: DataField = { id: 'df-when', name: 'When', dataType: DataFieldType.DateTime };
// The data field that sets a Gallery Article's status, and the statuses the MSEL offers.
const ARTICLE_STATUS: DataField = { id: 'df-article-status', name: 'Article Status', dataType: DataFieldType.String, galleryArticleParameter: 'Status' };
const GALLERY_STATUSES = ['Gray', 'Green', 'Red'];

interface Flags {
  canEdit?: boolean;
  canApprove?: boolean;
  isOwner?: boolean;
  showValueOnly?: boolean;
}

async function renderDataValue(dataField: DataField, value: string, flags: Flags = {}, galleryItemStatusOptions: string[] = []) {
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
    declarations: [DataValueComponent, TimezoneAbbrPipe, IsDateTimeValuePipe],
    inputs: {
      dataField,
      value,
      canEdit,
      canApprove,
      isOwner,
      showValueOnly,
      unitOptions: [{ id: 'unit-blue', shortName: 'BLUE' }, { id: 'unit-red', shortName: 'RED' }],
      galleryItemStatusOptions,
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

  /**
   * Verifies: a DateTime value that is not a date, such as a team left behind by a data type change, is shown as its text instead of breaking the page or showing a made-up date, in each of the three places the template shows a date.
   * Interacts with: IsDateTimeValuePipe, the dateTimeValue template (view-only display, editable field, value-only view for an editor).
   * Data: When = "TEAM1" (the date pipe throws), "Team 2" or "42" (new Date() reads both as dates); showValueOnly with no flags, canEdit alone, or showValueOnly with canEdit, canApprove and isOwner.
   */
  it.each(
    [
      { view: 'shown read-only', flags: { showValueOnly: true } },
      { view: 'in the editable field', flags: { canEdit: true } },
      { view: 'shown as a value to its editor', flags: { showValueOnly: true, canEdit: true, canApprove: true, isOwner: true } },
    ].flatMap((v) => ['TEAM1', 'Team 2', '42'].map((value) => ({ ...v, value }))),
  )('shows the date-time value $value as its text $view', async ({ flags, value }) => {
    await renderDataValue(WHEN, value, flags);

    expect(screen.getByText(value)).toHaveAttribute('title', 'Not a date and time');
  });

  /**
   * Verifies: the editable DateTime field says how to fix a value that is not a date.
   * Interacts with: valueError, valueErrorMatcher, mat-error.
   * Data: When = "Team 2"; canEdit.
   */
  it('asks for a new date in the editable field when the value is not a date', async () => {
    await renderDataValue(WHEN, 'Team 2', { canEdit: true });

    expect(screen.getByText('Not a date and time. Choose a new one.')).toBeInTheDocument();
  });

  /**
   * Verifies: a numeric field chosen from a list shows only its dropdown, with no number box beside it.
   * Interacts with: the numeric and dropdown branches of the template, mat-select options, valueChange output.
   * Data: an Integer or Double field chosen from the options One (1) and Two (2); value 1; canEdit; Two chosen.
   */
  it.each([DataFieldType.Integer, DataFieldType.Double])('shows only the dropdown for a %s field chosen from a list', async (dataType) => {
    const field: DataField = {
      id: 'df-count',
      name: 'Count',
      dataType,
      isChosenFromList: true,
      dataOptions: [
        { id: 'do-1', dataFieldId: 'df-count', optionName: 'One', optionValue: '1' },
        { id: 'do-2', dataFieldId: 'df-count', optionName: 'Two', optionValue: '2' },
      ],
    };
    const { changes } = await renderDataValue(field, '1', { canEdit: true });
    const user = userEvent.setup();

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'Two' }));

    expect(changes).toEqual(['2']);
  });

  /**
   * Verifies: a numeric field not chosen from a list keeps its number box.
   * Interacts with: the numeric branch of the template.
   * Data: a Double field; value 1.5; canEdit.
   */
  it('shows the number box for a Double field', async () => {
    await renderDataValue({ id: 'df-ratio', name: 'Ratio', dataType: DataFieldType.Double }, '1.5', { canEdit: true });

    expect(screen.getByRole('textbox', { name: 'Ratio' })).toHaveValue('1.5');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  /**
   * Verifies: with canEdit, a Gallery Article Status field offers the MSEL's statuses in a select instead of a text box, in the form field and in the value-only view, and emits the chosen status.
   * Interacts with: useGalleryItemStatusSelect, getGalleryItemStatus (legacy "open" shown as Green), galleryItemStatusChange, valueChange output.
   * Data: Article Status (String, Gallery parameter Status) = "open"; statuses Gray, Green, Red; canEdit only, with showValueOnly false or true; Red chosen.
   */
  it.each([false, true])('lets a Gallery status be chosen with canEdit (showValueOnly %s)', async (showValueOnly) => {
    const { fixture, changes } = await renderDataValue(ARTICLE_STATUS, 'open', { canEdit: true, showValueOnly }, GALLERY_STATUSES);
    // In the value-only view the select has no form field, so it opens through the harness.
    const select = await TestbedHarnessEnvironment.loader(fixture).getHarness(MatSelectHarness);

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-disabled', 'false');
    expect(await select.getValueText()).toBe('Green');
    await select.open();
    expect(await Promise.all((await select.getOptions()).map((o) => o.getText()))).toEqual(['', 'Gray', 'Green', 'Red']);
    await select.clickOptions({ text: 'Red' });

    expect(changes).toEqual(['Red']);
  });

  /**
   * Verifies: without canEdit the Gallery status select is disabled, even for an approver who owns the event, in the form field and in the value-only view.
   * Interacts with: the Gallery status mat-select [disabled].
   * Data: Article Status = "Green"; statuses Gray, Green, Red; canEdit false with canApprove and isOwner true (near miss), showValueOnly false or true.
   */
  it.each([false, true])('disables the Gallery status select without canEdit (showValueOnly %s)', async (showValueOnly) => {
    await renderDataValue(ARTICLE_STATUS, 'Green', { canEdit: false, canApprove: true, isOwner: true, showValueOnly }, GALLERY_STATUSES);

    expect(screen.getByRole('combobox')).toHaveAttribute('aria-disabled', 'true');
  });

  /**
   * Verifies: the Gallery status select replaces the own option list of a status field chosen from a list.
   * Interacts with: useGalleryItemStatusSelect, the dropdown branch.
   * Data: Article Status chosen from the option A, = "Green"; statuses Gray, Green, Red; canEdit.
   */
  it('offers the Gallery statuses instead of the option list of a status field', async () => {
    const field: DataField = {
      ...ARTICLE_STATUS,
      isChosenFromList: true,
      dataOptions: [{ id: 'do-a', dataFieldId: 'df-article-status', optionName: 'A', optionValue: 'A' }],
    };
    await renderDataValue(field, 'Green', { canEdit: true }, GALLERY_STATUSES);
    const user = userEvent.setup();

    expect(screen.getAllByRole('combobox')).toHaveLength(1);
    await user.click(screen.getByRole('combobox'));

    expect(screen.getAllByRole('option').map((o) => o.textContent.trim())).toEqual(['', 'Gray', 'Green', 'Red']);
  });

  /**
   * Verifies: a text box, not the Gallery status select, is shown when the MSEL offers no statuses or the field is not the Status parameter.
   * Interacts with: useGalleryItemStatusSelect, the string branch.
   * Data: Article Status with no statuses; a Subject field with statuses Gray, Green, Red; value "Green"; canEdit.
   */
  it.each([
    { label: 'without MSEL statuses', field: ARTICLE_STATUS, statuses: [] as string[] },
    { label: 'for another field', field: SUBJECT, statuses: GALLERY_STATUSES },
  ])('keeps the text box $label', async ({ field, statuses }) => {
    await renderDataValue(field, 'Green', { canEdit: true }, statuses);

    expect(screen.getByRole('textbox', { name: field.name })).toHaveValue('Green');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  /**
   * Verifies: read-only, a Gallery status is shown by its color name, any case or legacy name, with its color swatch; any other value is shown as it is, with no swatch.
   * Interacts with: the view-only branch, getGalleryItemStatus, galleryItemStatusColors.
   * Data: Article Status = "CRITICAL" (legacy Orange), "red" or "Pending review"; showValueOnly with no flags.
   */
  it.each([
    { value: 'CRITICAL', shown: 'Orange', color: 'rgb(250, 163, 2)' },
    { value: 'red', shown: 'Red', color: 'rgb(255, 51, 51)' },
    { value: 'Pending review', shown: 'Pending review', color: null as string },
  ])('shows the Gallery status $value as $shown', async ({ value, shown, color }) => {
    const { container } = await renderDataValue(ARTICLE_STATUS, value, { showValueOnly: true }, GALLERY_STATUSES);

    expect(screen.getByText(shown)).toBeInTheDocument();
    const swatch = container.querySelector<HTMLElement>('.gallery-status-swatch');
    expect(swatch?.style.backgroundColor ?? null).toBe(color);
  });
});
