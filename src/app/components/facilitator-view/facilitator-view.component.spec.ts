// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Component, input, output } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { Observable, Subject, of } from 'rxjs';
import {
  AutomationPausedForm,
  AutomationRun,
  AutomationRunKind,
  AutomationStatus,
  AutomationTask,
  AutomationTrigger,
  DataField,
  DataFieldType,
  EventType,
  Move,
  Msel,
  MselExecution,
  MselExecutionService,
  MselItemStatus,
  ScenarioEvent,
} from 'src/app/generated/blueprint.api';
import { AutomationRunStore } from 'src/app/data/automation-run/automation-run.store';
import { AutomationTaskStore } from 'src/app/data/automation-task/automation-task.store';
import { DataFieldStore } from 'src/app/data/data-field/data-field.store';
import { DataValueStore } from 'src/app/data/data-value/data-value.store';
import { MoveStore } from 'src/app/data/move/move.store';
import { MselExecutionDataService } from 'src/app/data/msel-execution/msel-execution-data.service';
import { MselStore } from 'src/app/data/msel/msel.store';
import { ScenarioEventStore } from 'src/app/data/scenario-event/scenario-event.store';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { DataValueComponent } from '../data-value/data-value.component';
import {
  MselAdvanceDialogComponent,
  MselAdvanceDialogData,
} from '../msel-advance-dialog/msel-advance-dialog.component';
import { DurationViewComponent } from '../shared/duration-view/duration-view.component';
import { FacilitatorViewComponent } from './facilitator-view.component';

@Component({ selector: 'app-duration-view', template: '' })
class DurationViewStub {
  readonly startTime = input<Date>(undefined);
  readonly durationSeconds = input<number>(undefined);
  readonly showRealTime = input<boolean>(undefined);
}
@Component({ selector: 'app-data-value', template: '{{ value() }}' })
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

const MSEL: Msel = {
  id: 'msel-1',
  name: 'Exercise Alpha',
  status: MselItemStatus.Deployed,
  deploymentId: 'dep-1',
  startTime: new Date('2026-01-01T10:00:00Z'),
  currentMoveNumber: 1,
  currentGroupNumber: 0,
  useGallery: true,
  galleryExhibitId: 'ex-1',
  showMoveOnFacilitatorView: true,
  showGroupOnFacilitatorView: true,
  showTimeOnFacilitatorView: true,
  showIntegrationTargetOnFacilitatorView: false,
};
// the API sends its numbers as strings
const n = (value: number) => `${value}` as unknown as number;
const MOVES: Move[] = [
  {
    id: 'm-0',
    mselId: 'msel-1',
    moveNumber: n(0),
    deltaSeconds: n(0),
    description: 'Setup',
  },
  {
    id: 'm-1',
    mselId: 'msel-1',
    moveNumber: n(1),
    deltaSeconds: n(900),
    description: 'Initial Access',
  },
  {
    id: 'm-2',
    mselId: 'msel-1',
    moveNumber: n(2),
    deltaSeconds: n(3600),
    description: 'Defacement',
  },
];
const EVENTS: ScenarioEvent[] = [
  {
    id: 'se-1',
    mselId: 'msel-1',
    scenarioEventType: EventType.Inject,
    deltaSeconds: 900,
    groupOrder: 1,
  },
  {
    id: 'se-2',
    mselId: 'msel-1',
    scenarioEventType: EventType.Inject,
    deltaSeconds: 900,
    groupOrder: 2,
  },
  {
    id: 'se-3',
    mselId: 'msel-1',
    scenarioEventType: EventType.Inject,
    deltaSeconds: 3600,
    groupOrder: 1,
  },
];
const TITLE: DataField = {
  id: 'df-title',
  mselId: 'msel-1',
  name: 'Title',
  dataType: DataFieldType.String,
  displayOrder: 1,
  onFacilitatorView: true,
};
// t-2's points come as a string, as the API sends them
const TASKS: AutomationTask[] = [
  {
    id: 't-1',
    mselId: 'msel-1',
    scenarioEventId: 'se-1',
    displayOrder: 0,
    name: 'Snapshot web-01',
    enabled: true,
    triggerCondition: AutomationTrigger.AtEventTime,
  },
  {
    id: 't-2',
    mselId: 'msel-1',
    scenarioEventId: 'se-3',
    displayOrder: 0,
    name: 'Notify Blue',
    enabled: true,
    triggerCondition: AutomationTrigger.Manual,
  },
  {
    id: 't-3',
    mselId: 'msel-1',
    scenarioEventId: 'se-3',
    displayOrder: 1,
    name: 'Deface',
    enabled: true,
    triggerCondition: AutomationTrigger.Manual,
  },
];
const RUNS: AutomationRun[] = [
  {
    id: 'r-1',
    mselId: 'msel-1',
    automationTaskId: 't-1',
    kind: AutomationRunKind.Exercise,
    deploymentId: 'dep-1',
    status: AutomationStatus.Failed,
    dateCreated: new Date('2026-01-01T10:15:00Z'),
    results: [],
  },
];
// the server's numbering, which differs from the client's on purpose: se-2 is in group 1
const EXECUTION: MselExecution = {
  mselId: 'msel-1',
  currentMoveNumber: n(1),
  currentGroupNumber: n(0),
  automationPaused: false,
  positions: [
    { scenarioEventId: 'se-1', moveNumber: n(1), groupNumber: n(0) },
    { scenarioEventId: 'se-2', moveNumber: n(1), groupNumber: n(1) },
    { scenarioEventId: 'se-3', moveNumber: n(2), groupNumber: n(0) },
  ],
};

function seeded<S extends { set(entities: unknown[]): void }>(
  Store: new () => S,
  entities: unknown[],
  active?: string,
) {
  return {
    provide: Store,
    useFactory: () => {
      const store = new Store();
      store.set(structuredClone(entities));
      if (active)
        (store as unknown as { setActive(id: string): void }).setActive(active);
      return store;
    },
  };
}

async function renderView(
  options: {
    canFacilitate?: boolean;
    msel?: Partial<Msel>;
    fields?: DataField[];
    tasks?: AutomationTask[];
    /** The MSEL becomes active only after the view renders, as the page's loadById answers after its tasks. */
    mselLater?: boolean;
  } = {},
) {
  const {
    canFacilitate = true,
    msel = {},
    fields = [TITLE],
    tasks = TASKS,
    mselLater = false,
  } = options;
  const executionApi = {
    getMselExecution: vi.fn(() => of(structuredClone(EXECUTION))),
    setMselAutomationPaused: vi.fn<
      (id: string, form?: AutomationPausedForm) => Observable<MselExecution>
    >(() => of({ ...structuredClone(EXECUTION), automationPaused: true })),
  } satisfies ApiStub<MselExecutionService>;
  const open = vi.fn();
  const rendered = await renderComponent(FacilitatorViewComponent, {
    childStubs: [
      { replace: DurationViewComponent, with: DurationViewStub },
      { replace: DataValueComponent, with: DataValueStub },
    ],
    providers: [
      { provide: MselExecutionService, useValue: executionApi },
      {
        provide: MatDialog,
        useValue: { open } satisfies Pick<MatDialog, 'open'>,
      },
      {
        provide: MselStore,
        useFactory: () => {
          const store = new MselStore();
          store.set([{ ...structuredClone(MSEL), ...msel }]);
          if (!mselLater) store.setActive('msel-1');
          return store;
        },
      },
      seeded(MoveStore, MOVES),
      seeded(ScenarioEventStore, EVENTS),
      seeded(DataFieldStore, fields),
      seeded(DataValueStore, [
        {
          id: 'dv-1',
          scenarioEventId: 'se-1',
          dataFieldId: 'df-title',
          value: 'Phishing wave',
        },
        {
          id: 'dv-2',
          scenarioEventId: 'se-2',
          dataFieldId: 'df-title',
          value: 'Quiet hour',
        },
        {
          id: 'dv-3',
          scenarioEventId: 'se-3',
          dataFieldId: 'df-title',
          value: 'Portal defaced',
        },
      ]),
      seeded(AutomationTaskStore, tasks),
      seeded(AutomationRunStore, RUNS),
    ],
    inputs: { canFacilitate, loggedInUserId: 'user-me' },
  });
  // the server's positions arrive after the first render
  TestBed.inject(MselExecutionDataService).load('msel-1');
  rendered.fixture.detectChanges();
  return { ...rendered, executionApi, open };
}

const expandAll = () =>
  userEvent.setup().click(screen.getByRole('button', { name: 'Expand All' }));

describe('FacilitatorViewComponent', () => {
  beforeEach(() => localStorage.clear());

  /**
   * Verifies: the summary says where the exercise is, how its tasks stand, and which move is next.
   * Interacts with: runCounts, nextMove, the execution store.
   * Data: the MSEL at move 1 group 0; t-1's run failed; move 2 at +01:00:00.
   */
  it('summarizes the exercise', async () => {
    await renderView();

    expect(screen.getByText(/Now: Move 1 · Group 0/)).toBeInTheDocument();
    expect(screen.getByText('1 failed')).toBeInTheDocument();
    expect(screen.getByText(/Next: Move 2 at \+01:00:00/)).toBeInTheDocument();
  });

  /**
   * Verifies: the summary shows the exercise's score once a task offers points, earned as the newest runs went.
   * Interacts with: scoreTasks, the task and run stores.
   * Data: t-1 offers 10 and failed; t-2 offers 5, as the string "5", and has not run.
   */
  it('shows the exercise score', async () => {
    const tasks = structuredClone(TASKS);
    tasks[0].score = 10;
    tasks[1].score = '5' as unknown as number;
    await renderView({ tasks });

    expect(screen.getByText('Score 0/15')).toBeInTheDocument();
  });

  /**
   * Verifies: every move has a header, the one with no events too, with where it stands; with the toggle on an event without tasks is hidden, and turning it off shows it, in the group the server put it in.
   * Interacts with: displayRows, the server positions, the Only events with tasks toggle, Expand All.
   * Data: moves 0 (no events), 1 (current) and 2; se-2 has no tasks and is in move 1 group 1.
   */
  it('lists every move and only the events with tasks', async () => {
    await renderView();
    await expandAll();

    expect(screen.getByText('Move 0')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    // move 1 and its group 0
    expect(screen.getAllByText(/^Current/)).toHaveLength(2);
    expect(screen.getByText(/^Scheduled \+01:00:00/)).toBeInTheDocument();
    expect(screen.getByText('Phishing wave')).toBeInTheDocument();
    expect(screen.queryByText('Quiet hour')).not.toBeInTheDocument();

    await userEvent
      .setup()
      .click(screen.getByRole('switch', { name: 'Only events with tasks' }));
    await expandAll();
    const quiet = screen.getByText('Quiet hour').closest('tr') as HTMLElement;
    // # , Move, Group: the server's group 1
    expect(within(quiet).getAllByRole('cell')[3]).toHaveTextContent('1');
    expect(localStorage.getItem('uiState')).toContain(
      '"facilitatorOnlyEventsWithTasks":false',
    );
  });

  /**
   * Verifies: the columns are the ones the MSEL's Facilitator View flags and the Facilitate data fields choose, with the event's automation status.
   * Interacts with: msel.show*OnFacilitatorView, DataField.onFacilitatorView.
   * Data: Move, Group and Time on, Integration Target off; Title marked Facilitate.
   */
  it('shows the columns the MSEL chose', async () => {
    await renderView();
    await expandAll();

    const headers = within(screen.getAllByRole('rowgroup')[0])
      .getAllByRole('columnheader')
      .map((h) => h.textContent.trim());
    expect(headers).toEqual([
      'Expand',
      '#',
      'Move',
      'Group',
      'Time',
      'Automation',
      'Title',
    ]);
    const phishing = screen
      .getByText('Phishing wave')
      .closest('tr') as HTMLElement;
    expect(within(phishing).getByText('1 of 1 failed')).toBeInTheDocument();
  });

  /**
   * Verifies: without a Facilitate field the view still lists the events, and says how to add fields.
   * Interacts with: facilitatorDataFields.
   * Data: no data field marked Facilitate.
   */
  it('works without Facilitate fields', async () => {
    await renderView({ fields: [{ ...TITLE, onFacilitatorView: false }] });

    expect(
      screen.getByText(/No data field is marked "Facilitate"/),
    ).toBeInTheDocument();
    expect(screen.getByText('Move 1')).toBeInTheDocument();
  });

  /**
   * Verifies: Start Move offers the move's enabled manual tasks, labelled by event and order, with the integrations it moves.
   * Interacts with: startMove, manualTasksOf, MatDialog.open (stub).
   * Data: move 2, whose event se-3 has two manual tasks; the MSEL uses Gallery.
   */
  it('starts a move with its manual tasks', async () => {
    const { open } = await renderView();

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Start Move 2' }));

    const [component, config] = open.mock.calls[0] as [
      unknown,
      { data: MselAdvanceDialogData },
    ];
    expect(component).toBe(MselAdvanceDialogComponent);
    expect(config.data).toEqual(
      expect.objectContaining({
        mselId: 'msel-1',
        moveNumber: 2,
        hasGallery: true,
        hasCite: false,
      }),
    );
    expect(config.data.tasks.map((t) => t.label)).toEqual([
      'Event 3 › 1. Notify Blue',
      'Event 3 › 2. Deface',
    ]);
  });

  /**
   * Verifies: Start Move marks a task whose run is still going, which the start would leave out, rather than offering to run it.
   * Interacts with: openAdvance, the advance dialog data.
   * Data: move 2's Notify Blue (t-2) has a run that is still pending.
   */
  it('marks a task that is already running when starting a move', async () => {
    const { open } = await renderView();
    TestBed.inject(AutomationRunStore).add({
      id: 'r-2',
      mselId: 'msel-1',
      automationTaskId: 't-2',
      kind: AutomationRunKind.Exercise,
      deploymentId: 'dep-1',
      status: AutomationStatus.Pending,
      dateCreated: new Date('2026-01-01T11:00:00Z'),
      results: [],
    });

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Start Move 2' }));

    const [, config] = open.mock.calls[0] as [
      unknown,
      { data: MselAdvanceDialogData },
    ];
    expect(config.data.tasks.map((t) => t.cannotRun)).toEqual([
      'it is already running',
      undefined,
    ]);
  });

  /**
   * Verifies: Pause Automation pauses it, and the view says so and offers Resume.
   * Interacts with: MselExecutionService.setMselAutomationPaused (stub).
   * Data: unpaused, then paused.
   */
  it('pauses the automation', async () => {
    const { executionApi, fixture } = await renderView();

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Pause Automation' }));
    fixture.detectChanges();

    expect(executionApi.setMselAutomationPaused).toHaveBeenCalledWith(
      'msel-1',
      { paused: true },
    );
    expect(screen.getByText('Automation is paused')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Resume Automation' }),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: an Editor or Approver follows the exercise but has no Start or Pause, and nor does anyone on a MSEL that is not deployed.
   * Interacts with: canFacilitate, canAct.
   * Data: canFacilitate false; then a facilitator on an approved MSEL.
   */
  it.each([
    {
      label: 'read-only',
      options: { canFacilitate: false },
      note: /You can follow the exercise here/,
    },
    {
      label: 'not deployed',
      options: { msel: { status: MselItemStatus.Approved } },
      note: /This MSEL is not deployed/,
    },
  ])('offers no actions when $label', async ({ options, note }) => {
    await renderView(options);

    expect(screen.getByText(note)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^Start / }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Pause Automation' }),
    ).not.toBeInTheDocument();
  });

  /**
   * Verifies: an event opens to its automation panel, and a task's history opens in the drawer named by event and task.
   * Interacts with: toggleEvent, the automation panel's history output, the results drawer.
   * Data: se-1 with t-1, whose run failed.
   */
  /**
   * Verifies: another facilitator's pause and start, which reach this view as the MSEL's update, win over the execution read before them.
   * Interacts with: the MSEL store's update (as SignalR's MselUpdated makes it), isPaused, currentMove.
   * Data: unpaused at move 1; the MSEL then paused at move 2.
   */
  it('follows another facilitator through the MSEL', async () => {
    const { executionApi, fixture } = await renderView();
    // the read the update asks for answers the server's state after it
    executionApi.getMselExecution.mockReturnValue(
      of({
        ...structuredClone(EXECUTION),
        automationPaused: true,
        currentMoveNumber: n(2),
      }),
    );

    TestBed.inject(MselStore).update('msel-1', {
      automationPaused: true,
      currentMoveNumber: 2,
      currentGroupNumber: 0,
    });
    fixture.detectChanges();

    expect(screen.getByText('Automation is paused')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Resume Automation' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Now: Move 2 · Group 0/)).toBeInTheDocument();
  });

  /**
   * Verifies: a read of the execution that was asked for before another facilitator's start, and answers after it, does not put the earlier move back.
   * Interacts with: MselExecutionDataService.load (one read in flight), the MSEL's update, the read that update asks for.
   * Data: an older read answering move 1 late; the MSEL updated to move 2, whose read answers move 2.
   */
  it('keeps a live start over an older read of the execution', async () => {
    const { executionApi, fixture } = await renderView();
    const older = new Subject<MselExecution>();
    executionApi.getMselExecution
      .mockReturnValueOnce(older)
      .mockReturnValue(
        of({ ...structuredClone(EXECUTION), currentMoveNumber: n(2) }),
      );

    TestBed.inject(MselExecutionDataService).load('msel-1');
    TestBed.inject(MselStore).update('msel-1', {
      currentMoveNumber: 2,
      currentGroupNumber: 0,
    });
    older.next(structuredClone(EXECUTION));
    fixture.detectChanges();

    expect(screen.getByText(/Now: Move 2 · Group 0/)).toBeInTheDocument();
  });

  /**
   * Verifies: tasks read before the MSEL arrived are shown once it does, rather than left out for belonging to no MSEL yet.
   * Interacts with: the task store's first emission before the active MSEL, the MSEL subscription.
   * Data: the tasks seeded; the MSEL made active after the view renders.
   */
  it('shows the tasks that arrived before the MSEL', async () => {
    const { fixture } = await renderView({ mselLater: true });

    TestBed.inject(MselStore).setActive('msel-1');
    fixture.detectChanges();
    await expandAll();

    expect(
      within(
        screen.getByText('Phishing wave').closest('tr') as HTMLElement,
      ).getByText('1 of 1 failed'),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: a row's number is the event's place in the MSEL, as the labels in the Start dialog and the history are, so hiding rows does not renumber the others.
   * Interacts with: eventNumber, the Only events with tasks toggle (on).
   * Data: se-2 hidden for having no tasks; se-3 is the MSEL's third event.
   */
  it('numbers each row by its place in the MSEL', async () => {
    await renderView();
    await expandAll();

    const defaced = screen
      .getByText('Portal defaced')
      .closest('tr') as HTMLElement;
    expect(within(defaced).getAllByRole('cell')[1]).toHaveTextContent('3');
    expect(
      within(defaced).getByRole('button', { name: 'Event 3 automation' }),
    ).toBeInTheDocument();
  });

  it('opens a task history', async () => {
    const { fixture } = await renderView();
    const user = userEvent.setup();
    await expandAll();

    await user.click(
      screen.getByRole('button', { name: 'History of Snapshot web-01' }),
    );
    fixture.detectChanges();

    expect(
      await screen.findByRole('heading', {
        name: 'Event 1 › 1. Snapshot web-01',
      }),
    ).toBeInTheDocument();
  });
});
