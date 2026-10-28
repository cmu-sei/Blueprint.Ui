// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, input, output } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { dialogRefStub, dismissedDialogRefStub } from 'src/app/test-utils/dialog-refs';
import { DataValueDraftDialogComponent } from 'src/app/components/data-value-draft-dialog/data-value-draft-dialog.component';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { DataField, DataFieldType, EventType, ScenarioEvent } from 'src/app/generated/blueprint.api';
import { IntegrationTarget } from 'src/app/data/scenario-event/scenario-event-data.service';
import { ScenarioEventEditDialogComponent } from './scenario-event-edit-dialog.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { DataValueComponent } from '../data-value/data-value.component';
import { DurationEditComponent } from '../shared/duration-edit/duration-edit.component';
import { SteamfitterTaskComponent } from '../steamfitter-task/steamfitter-task.component';

@Component({ selector: 'app-data-value', template: '' })
class DataValueStub {
  readonly value = input<string>(undefined);
  readonly valueChange = output<string>();
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
  readonly canAiWrite = input<boolean>(undefined);
  readonly aiWrite = output<void>();
}
@Component({ selector: 'app-duration-edit', template: '' })
class DurationEditStub {
  readonly startTime = input<Date>(undefined);
  readonly canEdit = input<boolean>(undefined);
  readonly durationSeconds = input<number>(undefined);
  readonly durationSecondsChange = output<number>();
  readonly timeName = input<string>(undefined);
  readonly postScript = input<string>(undefined);
  readonly change = output<number>();
}
@Component({ selector: 'app-steamfitter-task', template: '' })
class SteamfitterTaskStub {
  readonly scenarioEvent = input<ScenarioEvent>(undefined);
  readonly canEdit = input<boolean>(undefined);
}

const TITLE: DataField = { id: 'df-title', name: 'Title', dataType: DataFieldType.String, displayOrder: 1, onScenarioEventList: true };
const BODY: DataField = { id: 'df-body', name: 'Description', dataType: DataFieldType.Html, displayOrder: 2, onScenarioEventList: true };

interface Roles {
  isEditor?: boolean;
  isApprover?: boolean;
  isOwner?: boolean;
  isEditingRestricted?: boolean;
  // The event targets Steamfitter and the MSEL uses it, so the Steamfitter Task tab is offered.
  steamfitter?: boolean;
  // A When (DateTime) field holding this value, shown on the All tab only while Title is on the Default tab.
  when?: string;
  titleOnDefaultTab?: boolean;
}

const WHEN: DataField = { id: 'df-when', name: 'When', dataType: DataFieldType.DateTime, displayOrder: 2, onScenarioEventList: true };

function dialogData(roles: Roles = {}) {
  const { isEditor = false, isApprover = false, isOwner = false, isEditingRestricted = false, steamfitter = false, when, titleOnDefaultTab = false } = roles;
  return {
    scenarioEvent: {
      id: 'se-1',
      mselId: 'msel-1',
      scenarioEventType: EventType.Inject,
      deltaSeconds: 600,
      rowMetadata: '',
      dataValues: [
        { id: 'dv-1', scenarioEventId: 'se-1', dataFieldId: 'df-title', value: 'Phishing wave' },
        ...(when === undefined ? [] : [{ id: 'dv-2', scenarioEventId: 'se-1', dataFieldId: 'df-when', value: when }]),
      ],
      integrationTarget: steamfitter ? IntegrationTarget.Steamfitter : undefined,
      steamfitterTask: { id: 'task-1', name: steamfitter ? 'Ping the VM' : 'Unused task' },
      steamfitterTaskId: 'task-1',
    } as ScenarioEvent,
    integrationTargetOptions: [],
    dataFields: [{ ...TITLE, isShownOnDefaultTab: titleOnDefaultTab }, ...(when === undefined ? [] : [WHEN])],
    organizationList: [],
    teamList: [],
    unitList: [],
    moveList: [],
    cardList: [],
    gallerySourceTypes: ['News', 'Social'],
    galleryItemStatuses: ['Green', 'Red'],
    isNew: false,
    isOwner,
    isApprover,
    isEditor,
    isEditingRestricted,
    showScenarioEventType: !isEditingRestricted,
    useCite: false,
    useGallery: false,
    useSteamfitter: steamfitter,
    userList: [],
    mselStartTime: new Date('2026-01-01T12:00:00Z'),
  };
}

async function renderEventEdit(roles: Roles = {}, open = vi.fn(), withBody = false) {
  const data = dialogData(roles);
  if (withBody) {
    data.dataFields = [TITLE, BODY];
  }
  const rendered = await renderComponent(ScenarioEventEditDialogComponent, {
    imports: [...CRUCIBLE_DIALOG_IMPORTS, MatFormFieldModule, MatInputModule, MatSelectModule, MatTabsModule],
    childStubs: [
      { replace: DataValueComponent, with: DataValueStub },
      { replace: DurationEditComponent, with: DurationEditStub },
      { replace: SteamfitterTaskComponent, with: SteamfitterTaskStub },
    ],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialog, useValue: { open } satisfies Pick<MatDialog, 'open'> },
    ],
  });
  // ngModel applies [disabled] in a microtask.
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();
  const results: { saveChanges: boolean; scenarioEvent?: ScenarioEvent }[] = [];
  rendered.fixture.componentInstance.editComplete.subscribe((r) => results.push(r));
  return { ...rendered, data, results };
}

function child<T>(fixture: ComponentFixture<unknown>, stub: new (...args: never[]) => T): T {
  return fixture.debugElement.query(By.directive(stub)).componentInstance;
}

describe('ScenarioEventEditDialogComponent', () => {
  /**
   * Verifies: an editor can save, edit the values, start time, metadata and Steamfitter task; the values are approvable only for an approver.
   * Interacts with: crucible-dialog submit state, DataValueStub, DurationEditStub and SteamfitterTaskStub inputs, the Steamfitter Task tab.
   * Data: isEditor true (isApprover false); an Inject with a Title value that targets Steamfitter.
   */
  it('lets an editor edit the event', async () => {
    const { fixture } = await renderEventEdit({ isEditor: true, steamfitter: true });
    const user = userEvent.setup();

    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    expect(child(fixture, DataValueStub).canEdit()).toBe(true);
    expect(child(fixture, DataValueStub).canApprove()).toBe(false);
    expect(child(fixture, DurationEditStub).canEdit()).toBe(true);
    expect(screen.getByRole('textbox', { name: 'Row Metadata' })).toBeEnabled();
    await user.click(screen.getByText('Steamfitter Task'));
    expect(child(fixture, SteamfitterTaskStub).canEdit()).toBe(true);
  });

  /**
   * Verifies: without the editor role Save is disabled and the values, start time, metadata and Steamfitter task are read-only, even for an approver who owns the event.
   * Interacts with: crucible-dialog submit state, DataValueStub, DurationEditStub and SteamfitterTaskStub inputs, the Steamfitter Task tab.
   * Data: isEditor false; isApprover and isOwner true (near miss); an Inject that targets Steamfitter.
   */
  it('makes the event read-only without the editor role', async () => {
    const { fixture } = await renderEventEdit({ isEditor: false, isApprover: true, isOwner: true, steamfitter: true });
    const user = userEvent.setup();

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(child(fixture, DataValueStub).canEdit()).toBe(false);
    expect(child(fixture, DurationEditStub).canEdit()).toBe(false);
    expect(screen.getByRole('textbox', { name: 'Row Metadata' })).toBeDisabled();
    await user.click(screen.getByText('Steamfitter Task'));
    expect(child(fixture, SteamfitterTaskStub).canEdit()).toBe(false);
  });

  /**
   * Verifies: the data values get canApprove and isOwner from the approver and owner roles.
   * Interacts with: DataValueStub inputs.
   * Data: isEditor true; approver and owner true, then false.
   */
  it.each([true, false])('passes canApprove and isOwner %s to the data values', async (granted) => {
    const { fixture } = await renderEventEdit({ isEditor: true, isApprover: granted, isOwner: granted });

    expect(child(fixture, DataValueStub).canApprove()).toBe(granted);
    expect(child(fixture, DataValueStub).isOwner()).toBe(granted);
  });

  /**
   * Verifies: on a starter MSEL an editor cannot change an inject's values, and the event type is not offered.
   * Interacts with: isEditingRestricted, DataValueStub input.
   * Data: isEditor true; isEditingRestricted true; an Inject.
   */
  it('restricts inject values on a starter MSEL', async () => {
    const { fixture } = await renderEventEdit({ isEditor: true, isEditingRestricted: true });

    expect(child(fixture, DataValueStub).canEdit()).toBe(false);
    expect(screen.queryByRole('combobox', { name: 'Scenario Event Type' })).not.toBeInTheDocument();
  });

  /**
   * Verifies: the event type can be changed only by the owner.
   * Interacts with: mat-select [disabled].
   * Data: isOwner true, then isOwner false with isEditor and isApprover true.
   */
  it.each([
    { roles: { isOwner: true, isEditor: true }, disabled: 'false' },
    { roles: { isOwner: false, isEditor: true, isApprover: true }, disabled: 'true' },
  ])('sets the event type select aria-disabled $disabled', async ({ roles, disabled }) => {
    await renderEventEdit(roles);

    expect(screen.getByRole('combobox', { name: 'Scenario Event Type' })).toHaveAttribute('aria-disabled', disabled);
  });

  /**
   * Verifies: saving an event that does not target Steamfitter drops its Steamfitter task.
   * Interacts with: crucible-dialog submit, handleEditComplete, editComplete output.
   * Data: isEditor true; no integration target; a stray Steamfitter task.
   */
  it('drops the Steamfitter task when saving a non-Steamfitter event', async () => {
    const { results } = await renderEventEdit({ isEditor: true });
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(results).toHaveLength(1);
    expect(results[0].scenarioEvent.steamfitterTask).toBeNull();
    expect(results[0].scenarioEvent.steamfitterTaskId).toBeNull();
  });

  /**
   * Verifies: a DateTime value that is not a date disables Save only when it is on screen and can be edited, so Save never waits on a value that can't be fixed; a value of only spaces is empty.
   * Interacts with: hasBadData, canEditDataValues, sortedDataFields, crucible-dialog submitDisabled.
   * Data: isEditor; When (DateTime) = "Team 2" editable, on a starter MSEL (isEditingRestricted), or hidden from the Default tab (Title on it); When = "  ".
   */
  it.each([
    { label: 'that can be edited', roles: { when: 'Team 2' }, disabled: true },
    { label: 'on a starter MSEL, where inject values are read-only', roles: { when: 'Team 2', isEditingRestricted: true }, disabled: false },
    { label: 'hidden from the Default tab', roles: { when: 'Team 2', titleOnDefaultTab: true }, disabled: false },
    { label: 'that is only spaces', roles: { when: '  ' }, disabled: false },
  ])('sets Save disabled $disabled for a DateTime value $label', async ({ roles, disabled }) => {
    await renderEventEdit({ isEditor: true, ...roles });

    expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(disabled);
  });

  /**
   * Verifies: the event's data values get the MSEL's Gallery source types and Gallery article statuses the list passed in.
   * Interacts with: DataValueStub inputs, MAT_DIALOG_DATA.
   * Data: gallerySourceTypes News and Social; galleryItemStatuses Green and Red; isEditor.
   */
  it("passes the MSEL's Gallery source types and statuses to the data values", async () => {
    const { fixture } = await renderEventEdit({ isEditor: true });

    expect(child(fixture, DataValueStub).gallerySourceTypeOptions()).toEqual(['News', 'Social']);
    expect(child(fixture, DataValueStub).galleryItemStatusOptions()).toEqual(['Green', 'Red']);
  });

  /**
   * Verifies: Write with AI is offered on the Html field only, opens the writer with the inject's unsaved values, and the accepted value lands in the field that had none.
   * Interacts with: DataValueStub canAiWrite and aiWrite, MatDialog.open, the writer's afterClosed result.
   * Data: Title "Phishing wave" (String) and Description (Html, no value yet); the writer returns "<p>Users report a fake payroll email.</p>".
   */
  it('writes an Html field with AI and keeps the accepted value', async () => {
    const ref = dialogRefStub<DataValueDraftDialogComponent, string>('<p>Users report a fake payroll email.</p>');
    const open = vi.fn(() => ref.dialogRef);
    const { fixture, data } = await renderEventEdit({ isEditor: true }, open, true);

    const [title, body] = fixture.debugElement.queryAll(By.directive(DataValueStub)).map((d) => d.componentInstance as DataValueStub);
    expect(title.canAiWrite()).toBe(false);
    expect(body.canAiWrite()).toBe(true);
    body.aiWrite.emit();

    expect(open).toHaveBeenCalledWith(DataValueDraftDialogComponent, expect.objectContaining({
      data: expect.objectContaining({
        mselId: 'msel-1',
        scenarioEventId: 'se-1',
        deltaSeconds: 600,
        dataField: BODY,
        values: { 'df-title': 'Phishing wave' },
        gallerySourceTypes: ['News', 'Social'],
      }),
    }));
    expect(data.scenarioEvent.dataValues).toContainEqual({ dataFieldId: 'df-body', value: '<p>Users report a fake payroll email.</p>' });
    expect(fixture.componentInstance.blankDataValue.value).toBe('');
  });

  /**
   * Verifies: dismissing the writer leaves the event's values alone.
   * Interacts with: MatDialog.open, afterClosed emitting undefined.
   * Data: Title "Phishing wave"; Description with no value; the writer dismissed.
   */
  it('changes nothing when the writer is dismissed', async () => {
    const ref = dismissedDialogRefStub<DataValueDraftDialogComponent, string>();
    const { fixture, data } = await renderEventEdit({ isEditor: true }, vi.fn(() => ref.dialogRef), true);

    (fixture.debugElement.queryAll(By.directive(DataValueStub))[1].componentInstance as DataValueStub).aiWrite.emit();

    expect(data.scenarioEvent.dataValues).toEqual([{ id: 'dv-1', scenarioEventId: 'se-1', dataFieldId: 'df-title', value: 'Phishing wave' }]);
  });
});
