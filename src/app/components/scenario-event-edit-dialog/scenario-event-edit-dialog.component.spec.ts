// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, input, output } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { screen } from '@testing-library/angular';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import {
  AutomationAction,
  AutomationActionDefinition,
  AutomationRun,
  AutomationService,
  AutomationTrigger,
  DataField,
  DataFieldType,
  EventType,
  ScenarioEvent,
} from 'src/app/generated/blueprint.api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import {
  AutomationTaskDraft,
  newDraft,
} from 'src/app/utilities/automation-tasks';
import {
  AutomationTaskListComponent,
  AutomationTriggerOption,
} from '../automation-task-list/automation-task-list.component';
import {
  AutomationTestDialogComponent,
  AutomationTestDialogData,
} from '../automation-test-dialog/automation-test-dialog.component';
import {
  ScenarioEventEditDialogComponent,
  ScenarioEventEditDialogData,
} from './scenario-event-edit-dialog.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { DataValueComponent } from '../data-value/data-value.component';
import { DurationEditComponent } from '../shared/duration-edit/duration-edit.component';

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
  readonly techniques = input<string>(undefined);
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

@Component({ selector: 'app-automation-task-list', template: '' })
class AutomationTaskListStub {
  readonly drafts = input<AutomationTaskDraft[]>([]);
  readonly canEdit = input(false);
  readonly canTest = input(false);
  readonly triggerOptions = input<AutomationTriggerOption[]>([]);
  readonly latestTests = input<Map<string, AutomationRun>>(new Map());
  readonly changed = output<void>();
  readonly test = output<AutomationTaskDraft>();
}

const CATALOG: AutomationActionDefinition[] = [
  {
    action: AutomationAction.PlayerNotification,
    category: 'Blueprint',
    display: 'Send a Player notification',
    parameters: [{ key: 'Text', display: 'Text', required: true }],
  },
];

/** A notification task, valid unless a test takes something away. */
function notify(id: string, name = 'Notify Blue'): AutomationTaskDraft {
  return {
    ...newDraft(CATALOG[0]),
    id,
    name,
    actionParameters: { Text: 'Move 2 begins' },
  };
}

const TITLE: DataField = {
  id: 'df-title',
  name: 'Title',
  dataType: DataFieldType.String,
  displayOrder: 1,
  onScenarioEventList: true,
};

interface Roles {
  isEditor?: boolean;
  isApprover?: boolean;
  isOwner?: boolean;
  isEditingRestricted?: boolean;
  // the event's type, Inject unless a test says otherwise
  type?: EventType;
  tasks?: AutomationTaskDraft[];
  isNew?: boolean;
  initialTab?: string;
  canTest?: boolean;
  // A When (DateTime) field holding this value, shown on the All tab only while Title is on the Default tab.
  when?: string;
  titleOnDefaultTab?: boolean;
  // An Attack Technique field holding this value, beside a Defensive Technique field, so the latter can suggest countermeasures.
  techniques?: string;
}

const WHEN: DataField = {
  id: 'df-when',
  name: 'When',
  dataType: DataFieldType.DateTime,
  displayOrder: 2,
  onScenarioEventList: true,
};
const TECHNIQUES: DataField = {
  id: 'df-attack',
  name: 'Techniques',
  dataType: DataFieldType.AttackTechnique,
  displayOrder: 3,
  onScenarioEventList: true,
};
const COUNTERMEASURES: DataField = {
  id: 'df-defend',
  name: 'Countermeasures',
  dataType: DataFieldType.DefensiveTechnique,
  displayOrder: 4,
  onScenarioEventList: true,
};

function dialogData(roles: Roles = {}) {
  const {
    isEditor = false,
    isApprover = false,
    isOwner = false,
    isEditingRestricted = false,
    type = EventType.Inject,
    tasks = [],
    isNew = false,
    initialTab = '',
    canTest = false,
    when,
    titleOnDefaultTab = false,
    techniques,
  } = roles;
  return {
    scenarioEvent: {
      id: 'se-1',
      mselId: 'msel-1',
      scenarioEventType: type,
      deltaSeconds: 600,
      rowMetadata: '',
      dataValues: [
        {
          id: 'dv-1',
          scenarioEventId: 'se-1',
          dataFieldId: 'df-title',
          value: 'Phishing wave',
        },
        ...(when === undefined
          ? []
          : [
              {
                id: 'dv-2',
                scenarioEventId: 'se-1',
                dataFieldId: 'df-when',
                value: when,
              },
            ]),
        ...(techniques === undefined
          ? []
          : [
              {
                id: 'dv-3',
                scenarioEventId: 'se-1',
                dataFieldId: 'df-attack',
                value: techniques,
              },
              {
                id: 'dv-4',
                scenarioEventId: 'se-1',
                dataFieldId: 'df-defend',
                value: '',
              },
            ]),
      ],
    } as ScenarioEvent,
    integrationTargetOptions: [],
    dataFields: [
      { ...TITLE, isShownOnDefaultTab: titleOnDefaultTab },
      ...(when === undefined ? [] : [WHEN]),
      ...(techniques === undefined ? [] : [TECHNIQUES, COUNTERMEASURES]),
    ],
    organizationList: [],
    teamList: [],
    unitList: [],
    moveList: [],
    cardList: [],
    gallerySourceTypes: ['News', 'Social'],
    galleryItemStatuses: ['Green', 'Red'],
    isNew,
    isOwner,
    isApprover,
    isEditor,
    isEditingRestricted,
    showScenarioEventType: !isEditingRestricted,
    useCite: false,
    useGallery: false,
    userList: [],
    mselStartTime: new Date('2026-01-01T12:00:00Z'),
    mselId: 'msel-1',
    automationTasks: tasks,
    savedTaskIds: isNew ? [] : tasks.map((t) => t.id),
    triggerOptions: [{ id: 'other-1', label: 'Event 2 › 1. Power on' }],
    otherTriggers: new Map<string, string | null>([['other-1', null]]),
    latestTests: new Map<string, AutomationRun>(),
    canTest,
    eventLabel: 'Event 1',
    testPlayerViewId: 'view-1',
    deployedPlayerViewId: null,
    initialTab,
  };
}

async function renderEventEdit(roles: Roles = {}) {
  const data = dialogData(roles);
  const dialogOpen = vi.fn();
  const rendered = await renderComponent(ScenarioEventEditDialogComponent, {
    imports: [
      ...CRUCIBLE_DIALOG_IMPORTS,
      MatFormFieldModule,
      MatInputModule,
      MatSelectModule,
      MatTabsModule,
    ],
    childStubs: [
      { replace: DataValueComponent, with: DataValueStub },
      { replace: DurationEditComponent, with: DurationEditStub },
      { replace: AutomationTaskListComponent, with: AutomationTaskListStub },
    ],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      {
        provide: AutomationService,
        useValue: {
          getAutomationActions: vi.fn(() => of(structuredClone(CATALOG))),
        } satisfies ApiStub<AutomationService>,
      },
      {
        provide: MatDialog,
        useValue: { open: dialogOpen } satisfies Pick<MatDialog, 'open'>,
      },
    ],
  });
  // ngModel applies [disabled] in a microtask.
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();
  const results: {
    saveChanges: boolean;
    scenarioEvent?: ScenarioEventEditDialogData['scenarioEvent'];
  }[] = [];
  rendered.fixture.componentInstance.editComplete.subscribe((r) =>
    results.push(r),
  );
  return { ...rendered, data, results, dialogOpen };
}

function child<T>(
  fixture: ComponentFixture<unknown>,
  stub: new (...args: never[]) => T,
): T {
  return fixture.debugElement.query(By.directive(stub)).componentInstance;
}

describe('ScenarioEventEditDialogComponent', () => {
  /**
   * Verifies: an editor can save, edit the values, start time and metadata; the values are approvable only for an approver.
   * Interacts with: crucible-dialog submit state, DataValueStub and DurationEditStub inputs.
   * Data: isEditor true (isApprover false); an Inject with a Title value.
   */
  it('lets an editor edit the event', async () => {
    const { fixture } = await renderEventEdit({ isEditor: true });

    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    expect(child(fixture, DataValueStub).canEdit()).toBe(true);
    expect(child(fixture, DataValueStub).canApprove()).toBe(false);
    expect(child(fixture, DurationEditStub).canEdit()).toBe(true);
    expect(screen.getByRole('textbox', { name: 'Row Metadata' })).toBeEnabled();
  });

  /**
   * Verifies: without the editor role Save is disabled and the values, start time and metadata are read-only, even for an approver who owns the event.
   * Interacts with: crucible-dialog submit state, DataValueStub and DurationEditStub inputs.
   * Data: isEditor false; isApprover and isOwner true (near miss); an Inject.
   */
  it('makes the event read-only without the editor role', async () => {
    const { fixture } = await renderEventEdit({
      isEditor: false,
      isApprover: true,
      isOwner: true,
    });

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(child(fixture, DataValueStub).canEdit()).toBe(false);
    expect(child(fixture, DurationEditStub).canEdit()).toBe(false);
    expect(
      screen.getByRole('textbox', { name: 'Row Metadata' }),
    ).toBeDisabled();
  });

  /**
   * Verifies: the data values get canApprove and isOwner from the approver and owner roles.
   * Interacts with: DataValueStub inputs.
   * Data: isEditor true; approver and owner true, then false.
   */
  it.each([true, false])(
    'passes canApprove and isOwner %s to the data values',
    async (granted) => {
      const { fixture } = await renderEventEdit({
        isEditor: true,
        isApprover: granted,
        isOwner: granted,
      });

      expect(child(fixture, DataValueStub).canApprove()).toBe(granted);
      expect(child(fixture, DataValueStub).isOwner()).toBe(granted);
    },
  );

  /**
   * Verifies: every data value is told the event's Attack Technique values, so a Defensive Technique field can
   * suggest their countermeasures first.
   * Interacts with: techniqueValues, DataValueStub.techniques.
   * Data: an Attack Technique field holding "T1059, T1566" beside a Defensive Technique field.
   */
  it("passes the event's attack techniques to the data values", async () => {
    const { fixture } = await renderEventEdit({
      isEditor: true,
      techniques: 'T1059, T1566',
    });

    const stubs = fixture.debugElement
      .queryAll(By.directive(DataValueStub))
      .map((d) => d.componentInstance as DataValueStub);
    expect(stubs.map((s) => s.dataField().name)).toEqual([
      'Title',
      'Techniques',
      'Countermeasures',
    ]);
    expect(stubs.map((s) => s.techniques())).toEqual([
      'T1059, T1566',
      'T1059, T1566',
      'T1059, T1566',
    ]);
  });

  /**
   * Verifies: with no Attack Technique field on the event there are no attack techniques to tell.
   * Interacts with: techniqueValues, DataValueStub.techniques.
   * Data: a Title field only.
   */
  it('passes no attack techniques when the event has no Attack Technique field', async () => {
    const { fixture } = await renderEventEdit({ isEditor: true });

    expect(child(fixture, DataValueStub).techniques()).toBe('');
  });

  /**
   * Verifies: on a starter MSEL an editor cannot change an inject's values, and the event type is not offered.
   * Interacts with: isEditingRestricted, DataValueStub input.
   * Data: isEditor true; isEditingRestricted true; an Inject.
   */
  it('restricts inject values on a starter MSEL', async () => {
    const { fixture } = await renderEventEdit({
      isEditor: true,
      isEditingRestricted: true,
    });

    expect(child(fixture, DataValueStub).canEdit()).toBe(false);
    expect(
      screen.queryByRole('combobox', { name: 'Scenario Event Type' }),
    ).not.toBeInTheDocument();
  });

  /**
   * Verifies: the event type can be changed only by the owner.
   * Interacts with: mat-select [disabled].
   * Data: isOwner true, then isOwner false with isEditor and isApprover true.
   */
  it.each([
    { roles: { isOwner: true, isEditor: true }, disabled: 'false' },
    {
      roles: { isOwner: false, isEditor: true, isApprover: true },
      disabled: 'true',
    },
  ])(
    'sets the event type select aria-disabled $disabled',
    async ({ roles, disabled }) => {
      await renderEventEdit(roles);

      expect(
        screen.getByRole('combobox', { name: 'Scenario Event Type' }),
      ).toHaveAttribute('aria-disabled', disabled);
    },
  );

  /**
   * Verifies: a DateTime value that is not a date disables Save only when it is on screen and can be edited, so Save never waits on a value that can't be fixed; a value of only spaces is empty.
   * Interacts with: hasBadData, canEditDataValues, sortedDataFields, crucible-dialog submitDisabled.
   * Data: isEditor; When (DateTime) = "Team 2" editable, on a starter MSEL (isEditingRestricted), or hidden from the Default tab (Title on it); When = "  ".
   */
  it.each([
    { label: 'that can be edited', roles: { when: 'Team 2' }, disabled: true },
    {
      label: 'on a starter MSEL, where inject values are read-only',
      roles: { when: 'Team 2', isEditingRestricted: true },
      disabled: false,
    },
    {
      label: 'hidden from the Default tab',
      roles: { when: 'Team 2', titleOnDefaultTab: true },
      disabled: false,
    },
    { label: 'that is only spaces', roles: { when: '  ' }, disabled: false },
  ])(
    'sets Save disabled $disabled for a DateTime value $label',
    async ({ roles, disabled }) => {
      await renderEventEdit({ isEditor: true, ...roles });

      expect(
        screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled'),
      ).toBe(disabled);
    },
  );

  /**
   * Verifies: the event's data values get the MSEL's Gallery source types and Gallery article statuses the list passed in.
   * Interacts with: DataValueStub inputs, MAT_DIALOG_DATA.
   * Data: gallerySourceTypes News and Social; galleryItemStatuses Green and Red; isEditor.
   */
  it("passes the MSEL's Gallery source types and statuses to the data values", async () => {
    const { fixture } = await renderEventEdit({ isEditor: true });

    expect(child(fixture, DataValueStub).gallerySourceTypeOptions()).toEqual([
      'News',
      'Social',
    ]);
    expect(child(fixture, DataValueStub).galleryItemStatusOptions()).toEqual([
      'Green',
      'Red',
    ]);
  });

  describe('Automation tab', () => {
    const tab = () => screen.getByRole('tab', { name: /^Automation/ });
    const list = (fixture: ComponentFixture<unknown>) =>
      child(fixture, AutomationTaskListStub);

    /**
     * Verifies: the Automation tab counts the event's tasks and hands the list the drafts, the other events' tasks to trigger on, and what the user may do.
     * Interacts with: the Automation tab, AutomationTaskListStub inputs.
     * Data: isEditor and canTest; two tasks; one task on another event.
     */
    it('hands the event tasks to the task list', async () => {
      const tasks = [notify('t-1'), notify('t-2', 'Snapshot')];
      const { fixture } = await renderEventEdit({
        isEditor: true,
        canTest: true,
        tasks,
      });
      const user = userEvent.setup();

      expect(tab()).toHaveTextContent('Automation (2)');
      await user.click(tab());

      expect(list(fixture).drafts()).toBe(tasks);
      expect(list(fixture).canEdit()).toBe(true);
      expect(list(fixture).canTest()).toBe(true);
      expect(
        list(fixture)
          .triggerOptions()
          .map((o) => o.id),
      ).toEqual(['other-1']);
    });

    /**
     * Verifies: the tasks are read-only for a user who cannot edit the event, and on a starter MSEL.
     * Interacts with: AutomationTaskListStub canEdit input.
     * Data: isEditor false; then isEditor on a starter MSEL.
     */
    it.each([
      { roles: { isEditor: false } },
      { roles: { isEditor: true, isEditingRestricted: true } },
    ])('makes the tasks read-only for $roles', async ({ roles }) => {
      const { fixture } = await renderEventEdit({
        ...roles,
        tasks: [notify('t-1')],
        initialTab: 'Automation',
      });

      expect(list(fixture).canEdit()).toBe(false);
    });

    /**
     * Verifies: saving without touching the tasks sends none, so the API leaves them as they are.
     * Interacts with: crucible-dialog submit, handleEditComplete.
     * Data: isEditor; one task, unchanged.
     */
    it('sends no tasks when they did not change', async () => {
      const { results } = await renderEventEdit({
        isEditor: true,
        tasks: [notify('t-1')],
      });

      await userEvent
        .setup()
        .click(screen.getByRole('button', { name: 'Save' }));

      expect(results[0].scenarioEvent).not.toHaveProperty('automationTasks');
    });

    /**
     * Verifies: once the list says the tasks changed, saving sends every task as fields, with the secrets this edit set or cleared and no record of the stored ones.
     * Interacts with: AutomationTaskListStub changed output, handleEditComplete, toFields.
     * Data: isEditor; one task that holds a stored Password, its Headers set and its Password cleared in this edit.
     */
    it('sends the tasks once they changed', async () => {
      const task = {
        ...notify('t-1'),
        storedSecretKeys: ['Password'],
        secretChanges: { Password: '' },
      };
      const { fixture, results } = await renderEventEdit({
        isEditor: true,
        tasks: [task],
        initialTab: 'Automation',
      });

      list(fixture).changed.emit();
      fixture.detectChanges();
      await userEvent
        .setup()
        .click(screen.getByRole('button', { name: 'Save' }));

      const [sent] = results[0].scenarioEvent.automationTasks;
      expect(sent).toEqual(
        expect.objectContaining({
          id: 't-1',
          name: 'Notify Blue',
          actionParameters: { Text: 'Move 2 begins' },
          secretParameters: { Password: '' },
        }),
      );
      expect(sent).not.toHaveProperty('storedSecretKeys');
    });

    /**
     * Verifies: a changed task the API would refuse keeps Save disabled, since the dialog closes on Save and the work would be lost: a missing required parameter, and a trigger loop through another event.
     * Interacts with: automationErrors, hasBadData, crucible-dialog submitDisabled.
     * Data: isEditor; a notification without its Text; then a task triggered by other-1, which other events say is triggered by it.
     */
    it('keeps Save disabled while a changed task is invalid', async () => {
      const noText = { ...notify('t-1'), actionParameters: {} };
      const { fixture } = await renderEventEdit({
        isEditor: true,
        tasks: [noText],
        initialTab: 'Automation',
      });
      const save = () => screen.getByRole('button', { name: 'Save' });

      expect(save()).toBeEnabled();
      list(fixture).changed.emit();
      fixture.detectChanges();
      expect(save()).toBeDisabled();

      noText.actionParameters = { Text: 'Move 2' };
      noText.triggerCondition = AutomationTrigger.OnSuccess;
      noText.triggerTaskId = 'other-1';
      const instance = fixture.componentInstance;
      instance.data.otherTriggers.set('other-1', 't-1');
      fixture.detectChanges();
      expect(save()).toBeDisabled();
      expect(instance.automationErrors()).toEqual([
        'Notify Blue: its triggers lead back to it.',
      ]);
    });

    /**
     * Verifies: a copied event's tasks are sent with the new event even if left as they are.
     * Interacts with: ngOnInit, handleEditComplete.
     * Data: isNew and isEditor; one task.
     */
    it('sends the tasks of a new event', async () => {
      const { results } = await renderEventEdit({
        isEditor: true,
        isNew: true,
        tasks: [notify('t-new')],
      });

      await userEvent
        .setup()
        .click(screen.getByRole('button', { name: 'Save' }));

      expect(results[0].scenarioEvent.automationTasks.map((t) => t.id)).toEqual(
        ['t-new'],
      );
    });

    /**
     * Verifies: an event that is not an inject has a Details and an Automation tab, and opening on the Automation tab hides the event's details.
     * Interacts with: tabLabels, initialTab, selectedTabName.
     * Data: an Information event opened on Automation.
     */
    it('gives a non-inject event its details and its automation', async () => {
      await renderEventEdit({
        isEditor: true,
        type: EventType.Information,
        initialTab: 'Automation',
      });

      expect(
        screen.getAllByRole('tab').map((t) => t.textContent.trim()),
      ).toEqual(['Details', 'Automation (0)']);
      expect(tab()).toHaveAttribute('aria-selected', 'true');
      expect(
        screen.queryByRole('textbox', { name: 'Row Metadata' }),
      ).not.toBeInTheDocument();
    });

    /**
     * Verifies: Test Task from the list opens the test dialog on that task, with the event's tasks and which of them are saved.
     * Interacts with: AutomationTaskListStub test output, openTest, MatDialog.open (stub).
     * Data: isEditor and canTest; two saved tasks; Test Task on the second.
     */
    it('opens the test dialog on a task', async () => {
      const tasks = [notify('t-1'), notify('t-2', 'Snapshot')];
      const { fixture, dialogOpen } = await renderEventEdit({
        isEditor: true,
        canTest: true,
        tasks,
        initialTab: 'Automation',
      });

      list(fixture).test.emit(tasks[1]);

      const [component, config] = dialogOpen.mock.calls[0] as [
        unknown,
        { data: AutomationTestDialogData },
      ];
      expect(component).toBe(AutomationTestDialogComponent);
      expect(config.data).toEqual(
        expect.objectContaining({
          mselId: 'msel-1',
          scenarioEventId: 'se-1',
          taskId: 't-2',
          tasks,
          savedTaskIds: ['t-1', 't-2'],
          playerViewId: 'view-1',
        }),
      );
    });
  });
});
