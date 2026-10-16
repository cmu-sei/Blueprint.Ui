// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
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

@Component({ selector: 'app-data-value', template: '', standalone: false })
class DataValueStub {
  @Input() value: string;
  @Output() valueChange = new EventEmitter<string>();
  @Input() dataField: DataField;
  @Input() canEdit: boolean;
  @Input() canApprove: boolean;
  @Input() isOwner: boolean;
  @Input() showValueOnly: boolean;
  @Input() organizationOptions: unknown[];
  @Input() teamOptions: unknown[];
  @Input() unitOptions: unknown[];
  @Input() cardOptions: unknown[];
  @Input() moveOptions: unknown[];
  @Input() gallerySourceTypeOptions: unknown[];
  @Input() galleryItemStatusOptions: string[];
  @Input() userOptions: unknown[];
}
@Component({ selector: 'app-duration-edit', template: '', standalone: false })
class DurationEditStub {
  @Input() startTime: Date;
  @Input() canEdit: boolean;
  @Input() durationSeconds: number;
  @Output() durationSecondsChange = new EventEmitter<number>();
  @Input() timeName: string;
  @Input() postScript: string;
  @Output() change = new EventEmitter<number>();
}
@Component({ selector: 'app-steamfitter-task', template: '', standalone: false })
class SteamfitterTaskStub {
  @Input() scenarioEvent: ScenarioEvent;
  @Input() canEdit: boolean;
}

const TITLE: DataField = { id: 'df-title', name: 'Title', dataType: DataFieldType.String, displayOrder: 1, onScenarioEventList: true };

interface Roles {
  isEditor?: boolean;
  isApprover?: boolean;
  isOwner?: boolean;
  isEditingRestricted?: boolean;
  // The event targets Steamfitter and the MSEL uses it, so the Steamfitter Task tab is offered.
  steamfitter?: boolean;
}

function dialogData(roles: Roles = {}) {
  const { isEditor = false, isApprover = false, isOwner = false, isEditingRestricted = false, steamfitter = false } = roles;
  return {
    scenarioEvent: {
      id: 'se-1',
      mselId: 'msel-1',
      scenarioEventType: EventType.Inject,
      deltaSeconds: 600,
      rowMetadata: '',
      dataValues: [{ id: 'dv-1', scenarioEventId: 'se-1', dataFieldId: 'df-title', value: 'Phishing wave' }],
      integrationTarget: steamfitter ? IntegrationTarget.Steamfitter : undefined,
      steamfitterTask: { id: 'task-1', name: steamfitter ? 'Ping the VM' : 'Unused task' },
      steamfitterTaskId: 'task-1',
    } as ScenarioEvent,
    integrationTargetOptions: [],
    dataFields: [TITLE],
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

async function renderEventEdit(roles: Roles = {}) {
  const data = dialogData(roles);
  const rendered = await renderComponent(ScenarioEventEditDialogComponent, {
    imports: [...CRUCIBLE_DIALOG_IMPORTS, MatFormFieldModule, MatInputModule, MatSelectModule, MatTabsModule],
    declarations: [ScenarioEventEditDialogComponent, DataValueStub, DurationEditStub, SteamfitterTaskStub],
    providers: [{ provide: MAT_DIALOG_DATA, useValue: data }],
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
    expect(child(fixture, DataValueStub).canEdit).toBe(true);
    expect(child(fixture, DataValueStub).canApprove).toBe(false);
    expect(child(fixture, DurationEditStub).canEdit).toBe(true);
    expect(screen.getByRole('textbox', { name: 'Row Metadata' })).toBeEnabled();
    await user.click(screen.getByText('Steamfitter Task'));
    expect(child(fixture, SteamfitterTaskStub).canEdit).toBe(true);
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
    expect(child(fixture, DataValueStub).canEdit).toBe(false);
    expect(child(fixture, DurationEditStub).canEdit).toBe(false);
    expect(screen.getByRole('textbox', { name: 'Row Metadata' })).toBeDisabled();
    await user.click(screen.getByText('Steamfitter Task'));
    expect(child(fixture, SteamfitterTaskStub).canEdit).toBe(false);
  });

  /**
   * Verifies: the data values get canApprove and isOwner from the approver and owner roles.
   * Interacts with: DataValueStub inputs.
   * Data: isEditor true; approver and owner true, then false.
   */
  it.each([true, false])('passes canApprove and isOwner %s to the data values', async (granted) => {
    const { fixture } = await renderEventEdit({ isEditor: true, isApprover: granted, isOwner: granted });

    expect(child(fixture, DataValueStub).canApprove).toBe(granted);
    expect(child(fixture, DataValueStub).isOwner).toBe(granted);
  });

  /**
   * Verifies: on a starter MSEL an editor cannot change an inject's values, and the event type is not offered.
   * Interacts with: isEditingRestricted, DataValueStub input.
   * Data: isEditor true; isEditingRestricted true; an Inject.
   */
  it('restricts inject values on a starter MSEL', async () => {
    const { fixture } = await renderEventEdit({ isEditor: true, isEditingRestricted: true });

    expect(child(fixture, DataValueStub).canEdit).toBe(false);
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
   * Verifies: the event's data values get the MSEL's Gallery source types and Gallery article statuses the list passed in.
   * Interacts with: DataValueStub inputs, MAT_DIALOG_DATA.
   * Data: gallerySourceTypes News and Social; galleryItemStatuses Green and Red; isEditor.
   */
  it("passes the MSEL's Gallery source types and statuses to the data values", async () => {
    const { fixture } = await renderEventEdit({ isEditor: true });

    expect(child(fixture, DataValueStub).gallerySourceTypeOptions).toEqual(['News', 'Social']);
    expect(child(fixture, DataValueStub).galleryItemStatusOptions).toEqual(['Green', 'Red']);
  });
});
