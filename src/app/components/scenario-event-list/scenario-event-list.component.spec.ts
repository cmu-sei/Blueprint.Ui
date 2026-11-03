// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Component, EventEmitter, input, output } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule } from '@angular/material/sort';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import {
  DataField,
  DataFieldType,
  DataValue,
  EventType,
  Msel,
  MselRole,
  MselService,
  ScenarioEvent,
  ScenarioEventService,
  SystemPermission,
  SystemPermissionsService,
} from 'src/app/generated/blueprint.api';
import { DataFieldStore } from 'src/app/data/data-field/data-field.store';
import { DataValueStore } from 'src/app/data/data-value/data-value.store';
import { MselStore } from 'src/app/data/msel/msel.store';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { ScenarioEventStore } from 'src/app/data/scenario-event/scenario-event.store';
import { ScenarioEventEditDialogComponent } from '../scenario-event-edit-dialog/scenario-event-edit-dialog.component';
import { ScenarioEventListComponent } from './scenario-event-list.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { permissionApiStubs } from 'src/app/test-utils/mock-permission-data.service';
import { DurationViewComponent } from '../shared/duration-view/duration-view.component';
import { DataValueComponent } from '../data-value/data-value.component';

@Component({ selector: 'app-duration-view', template: '' })
class DurationViewStub {
  readonly startTime = input<Date>(undefined);
  readonly durationSeconds = input<number>(undefined);
  readonly showRealTime = input<boolean>(undefined);
}
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
}

const ME = 'user-me';
const TITLE: DataField = { id: 'df-title', mselId: 'msel-1', name: 'Title', dataType: DataFieldType.String, displayOrder: 1, onScenarioEventList: true, isInformationField: true };
const EVENTS: ScenarioEvent[] = [
  { id: 'se-1', mselId: 'msel-1', scenarioEventType: EventType.Inject, deltaSeconds: 0, groupOrder: 1, isHidden: false },
  { id: 'se-2', mselId: 'msel-1', scenarioEventType: EventType.Inject, deltaSeconds: 60, groupOrder: 1, isHidden: true },
  // A non-Inject event renders its values in a separate branch of the row template.
  { id: 'se-3', mselId: 'msel-1', scenarioEventType: EventType.Information, deltaSeconds: 120, groupOrder: 1, isHidden: false },
];
const VALUES: DataValue[] = [
  { id: 'dv-1', scenarioEventId: 'se-1', dataFieldId: 'df-title', value: 'Phishing wave' },
  { id: 'dv-2', scenarioEventId: 'se-2', dataFieldId: 'df-title', value: 'Ransom note' },
  { id: 'dv-3', scenarioEventId: 'se-3', dataFieldId: 'df-title', value: 'Status update' },
];
const ALL_BUT_EDIT_MSELS = Object.values(SystemPermission).filter((p) => p !== SystemPermission.EditMsels);

function msel(myRoles: MselRole[] = [], extra: Partial<Msel> = {}): Msel {
  return {
    id: 'msel-1',
    name: 'Exercise Alpha',
    createdBy: 'someone-else',
    teams: [],
    units: [],
    userMselRoles: myRoles.map((role, i) => ({ id: `umr-${i}`, userId: ME, mselId: 'msel-1', role })),
    ...extra,
  };
}

function seeded<S extends { set(entities: unknown[]): void }>(Store: new () => S, entities: unknown[]) {
  return {
    provide: Store,
    useFactory: () => {
      const store = new Store();
      store.set(structuredClone(entities));
      return store;
    },
  };
}

async function renderEventList(
  overrides: { permissions?: SystemPermission[]; myRoles?: MselRole[]; isStarterMsel?: boolean; mselExtra?: Partial<Msel> } = {},
) {
  const { permissions = [], myRoles = [], isStarterMsel = false, mselExtra = {} } = overrides;
  const mselApi = {
    getMyMsels: vi.fn(() => of<Msel[]>([])),
  } satisfies ApiStub<MselService>;
  const eventApi = {
    updateScenarioEvent: vi.fn((id: string, se: ScenarioEvent) => of([structuredClone(se)])),
    deleteScenarioEvent: vi.fn(() => of<unknown>(null)),
    batchDeleteScenarioEvents: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<ScenarioEventService>;
  // The user confirms every dialog.
  const confirm = vi.fn(() => dialogRefStub<unknown, boolean>(true).dialogRef);
  const dialog = { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>;
  // ScenarioEventListComponent loads the permissions itself in its
  // constructor, so the real service is provided over the stubbed endpoint.
  const permissionApis = permissionApiStubs({ system: permissions });
  // Edit opens ScenarioEventEditDialogComponent and subscribes to its editComplete;
  // the stand-in ref carries that emitter, which never fires here.
  const editRef = Object.assign(dialogRefStub<ScenarioEventEditDialogComponent>().dialogRef, {
    componentInstance: { editComplete: new EventEmitter<unknown>() },
  });
  const open = vi.fn().mockReturnValue(editRef);
  const rendered = await renderComponent(ScenarioEventListComponent, {
    imports: [
      DragDropModule,
      MatButtonModule,
      MatCheckboxModule,
      MatFormFieldModule,
      MatIconModule,
      MatInputModule,
      MatMenuModule,
      MatSelectModule,
      MatSortModule,
    ],
    childStubs: [
      { replace: DurationViewComponent, with: DurationViewStub },
      { replace: DataValueComponent, with: DataValueStub },
    ],
    providers: [
      { provide: SystemPermissionsService, useValue: permissionApis.systemPermissions },
      PermissionDataService,
      { provide: MselService, useValue: mselApi },
      { provide: ScenarioEventService, useValue: eventApi },
      { provide: CrucibleDialogService, useValue: dialog },
      { provide: MatDialog, useValue: { open } satisfies Pick<MatDialog, 'open'> },
      // The MSEL page loads all of this; the stores are seeded instead.
      {
        provide: MselStore,
        useFactory: () => {
          const store = new MselStore();
          store.set([msel(myRoles, mselExtra)]);
          store.setActive('msel-1');
          return store;
        },
      },
      seeded(DataFieldStore, [TITLE]),
      seeded(DataValueStore, VALUES),
      seeded(ScenarioEventStore, EVENTS),
    ],
    inputs: { loggedInUserId: ME, isStarterMsel },
  });
  return { ...rendered, eventApi, confirm, open };
}

const table = () => screen.getByRole('table');
const row = (n: number) => within(within(table()).getByTitle(`Event ${n} Action List`).closest('tr') as HTMLElement);
function dataValues(fixture: ComponentFixture<unknown>): DataValueStub[] {
  return fixture.debugElement.queryAll(By.directive(DataValueStub)).map((d) => d.componentInstance);
}
async function openEventMenu(n: number) {
  const user = userEvent.setup();
  await user.click(row(n).getByRole('button', { name: `Event ${n} Action List` }));
  return user;
}

describe('ScenarioEventListComponent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  /**
   * Verifies: the MSEL's events are listed in time order with their data values.
   * Interacts with: real ScenarioEventQuery, DataFieldQuery and DataValueQuery (seeded), real ScenarioEventDataService view helpers, DataValueStub inputs.
   * Data: two Inject events, Phishing wave (0 s, shown) and Ransom note (60 s, hidden), and an Information event, Status update (120 s).
   */
  it('lists the events with their values', async () => {
    const { fixture } = await renderEventList({ permissions: [SystemPermission.EditMsels] });

    expect(dataValues(fixture).map((v) => v.value())).toEqual(['Phishing wave', 'Ransom note', 'Status update']);
  });

  /**
   * Verifies: with EditMsels, as the owner, or as an MSEL Editor, the events can be selected, highlighted, copied, deleted and hidden, and their values edited.
   * Interacts with: real PermissionDataService over SystemPermissionsService (stub), MselPlus.hasRole, the event action menu, DataValueStub inputs.
   * Data: EditMsels with no role; or the Owner role; or the Editor role.
   */
  it.each([
    { label: 'with EditMsels', permissions: [SystemPermission.EditMsels], myRoles: [] },
    { label: 'as the MSEL owner', permissions: [], myRoles: [MselRole.Owner] },
    { label: 'as an MSEL Editor', permissions: [], myRoles: [MselRole.Editor] },
  ])('offers event actions $label', async ({ permissions, myRoles }) => {
    const { fixture } = await renderEventList({ permissions, myRoles });

    expect(within(table()).getByTitle('Select All/None')).toBeInTheDocument();
    expect(row(1).getByTitle('Select event 1')).toBeInTheDocument();
    expect(row(1).getByRole('button', { name: 'Hide event 1 on the Exercise View' })).toBeEnabled();
    await openEventMenu(1);
    for (const name of ['Highlight', 'Copy', 'Delete']) {
      expect(screen.getByRole('menuitem', { name })).toBeInTheDocument();
    }
    expect(dataValues(fixture)[0].canEdit()).toBe(true);
    expect(dataValues(fixture)[0].isOwner()).toBe(true);
  });

  /**
   * Verifies: a Viewer without EditMsels gets a read-only list: no selection or header actions, only View and Edit in the menu, Hide disabled, and read-only values.
   * Interacts with: real PermissionDataService (stubbed grants), MselPlus.hasRole, DataValueStub inputs.
   * Data: every permission but EditMsels (near miss: ManageMsels); MSEL roles Viewer and Evaluator.
   */
  it('lists the events read-only without EditMsels or an editing role', async () => {
    const { fixture } = await renderEventList({ permissions: ALL_BUT_EDIT_MSELS, myRoles: [MselRole.Viewer, MselRole.Evaluator] });

    expect(within(table()).queryByTitle('Select All/None')).not.toBeInTheDocument();
    expect(within(table()).queryByRole('button', { name: 'Action List' })).not.toBeInTheDocument();
    expect(row(1).queryByTitle('Select event 1')).not.toBeInTheDocument();
    expect(row(1).getByRole('button', { name: 'Hide event 1 on the Exercise View' })).toBeDisabled();
    for (const value of dataValues(fixture)) {
      expect(value.canEdit()).toBe(false);
      expect(value.canApprove()).toBe(false);
      expect(value.isOwner()).toBe(false);
    }
    await openEventMenu(1);
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeInTheDocument();
    for (const name of ['Highlight', 'Copy', 'Delete']) {
      expect(screen.queryByRole('menuitem', { name })).not.toBeInTheDocument();
    }
  });

  /**
   * Verifies: an MSEL Approver without EditMsels may approve the events' values; the Approver role includes Editor, so the values are editable too.
   * Interacts with: MselPlus.hasRole, DataValueStub inputs.
   * Data: no system permission; MSEL role Approver.
   */
  it('lets an MSEL Approver approve values', async () => {
    const { fixture } = await renderEventList({ myRoles: [MselRole.Approver] });

    for (const value of dataValues(fixture)) {
      expect(value.canApprove()).toBe(true);
      expect(value.canEdit()).toBe(true);
    }
  });

  /**
   * Verifies: Edit opens the event edit dialog with isOwner, isApprover and isEditor true for EditMsels or the Approver role (which canEditMsel counts as an editor).
   * Interacts with: the event action menu, ScenarioEventListComponent.displayEditDialog, MatDialog.open (stub).
   * Data: EditMsels with no role; or the Approver role with no system permission.
   */
  it.each([
    { label: 'with EditMsels', permissions: [SystemPermission.EditMsels], myRoles: [] },
    { label: 'as an MSEL Approver', permissions: [], myRoles: [MselRole.Approver] },
  ])('opens the edit dialog as an editor $label', async ({ permissions, myRoles }) => {
    const { open } = await renderEventList({ permissions, myRoles });

    const user = await openEventMenu(1);
    await user.click(screen.getByTitle('Edit event 1'));

    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0][0]).toBe(ScenarioEventEditDialogComponent);
    expect(open.mock.calls[0][1].data).toEqual(expect.objectContaining({ isOwner: true, isApprover: true, isEditor: true }));
  });

  /**
   * Verifies: for a Viewer without EditMsels, Edit opens the event edit dialog with isOwner, isApprover and isEditor all false.
   * Interacts with: the event action menu, ScenarioEventListComponent.displayEditDialog, MatDialog.open (stub).
   * Data: every permission but EditMsels (near miss: ManageMsels); MSEL roles Viewer and Evaluator.
   */
  it('opens the edit dialog read-only without EditMsels or an editing role', async () => {
    const { open } = await renderEventList({ permissions: ALL_BUT_EDIT_MSELS, myRoles: [MselRole.Viewer, MselRole.Evaluator] });

    const user = await openEventMenu(1);
    await user.click(screen.getByTitle('Edit event 1'));

    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0][1].data).toEqual(expect.objectContaining({ isOwner: false, isApprover: false, isEditor: false }));
  });

  /**
   * Verifies: the Unhide button is enabled for a Viewer without EditMsels, and saves the event as shown (current behavior).
   * Interacts with: ScenarioEventService.updateScenarioEvent (stub).
   * Data: every permission but EditMsels; MSEL role Viewer; event 2 is hidden.
   */
  it('lets a viewer unhide an event', async () => {
    const { eventApi } = await renderEventList({ permissions: ALL_BUT_EDIT_MSELS, myRoles: [MselRole.Viewer] });
    const user = userEvent.setup();

    await user.click(row(2).getByRole('button', { name: 'Unhide event 2 on the Exercise View' }));

    // Current behavior; see agent-docs/ui-test-bugs/blueprint.ui.md.
    expect(eventApi.updateScenarioEvent).toHaveBeenCalledWith('se-2', expect.objectContaining({ isHidden: false }));
  });

  /**
   * Verifies: on a starter MSEL even an EditMsels user cannot edit values, copy, hide or unhide.
   * Interacts with: isStarterMsel, DataValueStub inputs, the event action menu.
   * Data: EditMsels; isStarterMsel true.
   */
  it('restricts a starter MSEL', async () => {
    const { fixture } = await renderEventList({ permissions: [SystemPermission.EditMsels], isStarterMsel: true });

    expect(dataValues(fixture)[0].canEdit()).toBe(false);
    expect(row(1).queryByRole('button', { name: 'Hide event 1 on the Exercise View' })).not.toBeInTheDocument();
    expect(row(2).queryByRole('button', { name: 'Unhide event 2 on the Exercise View' })).not.toBeInTheDocument();
    await openEventMenu(1);
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Copy' })).not.toBeInTheDocument();
  });

  /**
   * Verifies: confirming Delete in an event's menu deletes the event.
   * Interacts with: CrucibleDialogService.confirm (stub, confirms), ScenarioEventService.deleteScenarioEvent (stub).
   * Data: EditMsels; event 1.
   */
  it('deletes an event after confirmation', async () => {
    const { eventApi, confirm } = await renderEventList({ permissions: [SystemPermission.EditMsels] });

    const user = await openEventMenu(1);
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));

    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delete Event', confirmText: 'Delete' }));
    expect(eventApi.deleteScenarioEvent).toHaveBeenCalledWith('se-1');
  });

  /**
   * Verifies: deleting the selected events asks with the standard Delete title and button before deleting them.
   * Interacts with: batchDeleteScenarioEvents(), CrucibleDialogService.confirm (stub, confirms), ScenarioEventService.batchDeleteScenarioEvents (stub).
   * Data: EditMsels; event se-1 selected.
   */
  it('confirms deleting the selected events', async () => {
    const { eventApi, confirm, fixture } = await renderEventList({ permissions: [SystemPermission.EditMsels] });

    fixture.componentInstance.selectedEventIdList = ['se-1'];
    fixture.componentInstance.batchDeleteScenarioEvents();

    expect(confirm).toHaveBeenCalledWith({
      title: 'Delete Selected Events',
      message: 'Are you sure that you want to delete the selected events?',
      confirmText: 'Delete',
    });
    expect(eventApi.batchDeleteScenarioEvents).toHaveBeenCalledWith(['se-1']);
  });

  /**
   * Verifies: the MSEL's Gallery source types and Gallery article statuses go to every data value in the list (Inject and other events) and to the event edit dialog.
   * Interacts with: DataValueStub inputs, the event action menu, MatDialog.open (stub).
   * Data: EditMsels; MSEL source types News and Social and statuses Green and Red; three events.
   */
  it("passes the MSEL's Gallery source types and statuses to the values and the edit dialog", async () => {
    const { fixture, open } = await renderEventList({
      permissions: [SystemPermission.EditMsels],
      mselExtra: { gallerySourceTypes: ['News', 'Social'], galleryItemStatuses: ['Green', 'Red'] },
    });

    expect(dataValues(fixture)).toHaveLength(3);
    for (const value of dataValues(fixture)) {
      expect(value.gallerySourceTypeOptions()).toEqual(['News', 'Social']);
      expect(value.galleryItemStatusOptions()).toEqual(['Green', 'Red']);
    }
    const user = await openEventMenu(1);
    await user.click(screen.getByTitle('Edit event 1'));

    expect(open.mock.calls[0][1].data).toEqual(
      expect.objectContaining({ gallerySourceTypes: ['News', 'Social'], galleryItemStatuses: ['Green', 'Red'] }),
    );
  });
});
