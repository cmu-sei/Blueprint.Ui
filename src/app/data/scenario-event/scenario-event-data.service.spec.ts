// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import {
  DataField,
  DataFieldType,
  DataValue,
  ScenarioEvent,
  ScenarioEventService,
} from 'src/app/generated/blueprint.api';
import {
  ScenarioEventDataService,
  ScenarioEventView,
  ScenarioEventViewIndexing,
} from './scenario-event-data.service';
import { ScenarioEventQuery } from './scenario-event.query';
import { ScenarioEventStore } from './scenario-event.store';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { recordEmissions } from 'src/app/test-utils/record-emissions';
import { captureUnhandledRxErrors, flush } from 'src/app/test-utils/unhandled-rx-errors';

function event(overrides: Partial<ScenarioEvent> = {}): ScenarioEvent {
  return {
    id: 'se-1',
    mselId: 'msel-1',
    deltaSeconds: 0,
    groupOrder: 0,
    isHidden: false,
    ...overrides,
  };
}

function setup() {
  const scenarioEventApi = {
    getScenarioEventsByMsel: vi.fn(() => of<ScenarioEvent[]>([])),
    getScenarioEvent: vi.fn(() => of<ScenarioEvent>({})),
    createScenarioEvent: vi.fn(() => of<ScenarioEvent[]>([])),
    createScenarioEventsFromInjects: vi.fn(() => of<ScenarioEvent[]>([])),
    updateScenarioEvent: vi.fn(() => of<ScenarioEvent[]>([])),
    deleteScenarioEvent: vi.fn(() => of<unknown>(null)),
    batchDeleteScenarioEvents: vi.fn(() => of<unknown>(null)),
    copyScenarioEventsToMsel: vi.fn(() => of<ScenarioEvent[]>([])),
  } satisfies ApiStub<ScenarioEventService>;
  TestBed.configureTestingModule({
    providers: [{ provide: ScenarioEventService, useValue: scenarioEventApi }],
  });
  return {
    service: TestBed.inject(ScenarioEventDataService),
    query: TestBed.inject(ScenarioEventQuery),
    scenarioEventApi,
  };
}

const ids = (events: ScenarioEvent[]) => events.map((e) => e.id);

describe('ScenarioEventDataService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  describe('store', () => {
    /**
     * Verifies: loadByMsel replaces the store with the MSEL's events and stops loading.
     * Interacts with: ScenarioEventService.getScenarioEventsByMsel (stub), real ScenarioEventStore/Query.
     * Data: two events for msel-1, replacing one left over from another MSEL.
     */
    it('loadByMsel replaces the events', () => {
      const { service, query, scenarioEventApi } = setup();
      service.updateStore(event({ id: 'stale', mselId: 'msel-0' }));
      scenarioEventApi.getScenarioEventsByMsel.mockReturnValue(
        of([event(), event({ id: 'se-2', deltaSeconds: 60 })]),
      );

      service.loadByMsel('msel-1');

      expect(scenarioEventApi.getScenarioEventsByMsel).toHaveBeenCalledWith(
        'msel-1',
      );
      expect(ids(query.getAll())).toEqual(['se-1', 'se-2']);
      expect(query.getValue().loading).toBe(false);
    });

    /**
     * Verifies: a failed loadByMsel empties the store and stops loading.
     * Interacts with: ScenarioEventService.getScenarioEventsByMsel (stub erroring), real ScenarioEventQuery.
     * Data: one stored event.
     */
    it('loadByMsel empties the store on failure', () => {
      const { service, query, scenarioEventApi } = setup();
      service.updateStore(event());
      scenarioEventApi.getScenarioEventsByMsel.mockReturnValue(
        throwError(() => new Error('boom')),
      );

      service.loadByMsel('msel-1');

      expect(query.getAll()).toEqual([]);
      expect(query.getValue().loading).toBe(false);
    });

    /**
     * Verifies: loadById upserts one event without dropping the others.
     * Interacts with: ScenarioEventService.getScenarioEvent (stub), real ScenarioEventQuery.
     * Data: se-1 stored; se-2 fetched.
     */
    it('loadById upserts the event', () => {
      const { service, query, scenarioEventApi } = setup();
      service.updateStore(event());
      scenarioEventApi.getScenarioEvent.mockReturnValue(
        of(event({ id: 'se-2', deltaSeconds: 30 })),
      );

      service.loadById('se-2');

      expect(ids(query.getAll())).toEqual(['se-1', 'se-2']);
    });

    /**
     * Verifies: add, addInjects, updateScenarioEvent and copyScenarioEventsToMsel each upsert every event the API returns, because one change can re-time its siblings.
     * Interacts with: the four ScenarioEventService endpoints (stubs), real ScenarioEventQuery.
     * Data: each call returns the changed event plus a sibling whose groupOrder moved.
     */
    it('create, update and copy upsert every returned event', () => {
      const { service, query, scenarioEventApi } = setup();
      service.updateStore(event({ id: 'se-1', groupOrder: 0 }));
      scenarioEventApi.createScenarioEvent.mockReturnValue(
        of([event({ id: 'se-new' }), event({ id: 'se-1', groupOrder: 1 })]),
      );
      scenarioEventApi.createScenarioEventsFromInjects.mockReturnValue(
        of([event({ id: 'se-inject', deltaSeconds: 600 })]),
      );
      scenarioEventApi.updateScenarioEvent.mockReturnValue(
        of([event({ id: 'se-new', deltaSeconds: 120 })]),
      );
      scenarioEventApi.copyScenarioEventsToMsel.mockReturnValue(
        of([event({ id: 'se-copy', deltaSeconds: 900 })]),
      );

      service.add(event({ id: undefined }));
      expect(query.getEntity('se-1').groupOrder).toBe(1);

      service.addInjects({ mselId: 'msel-1', injectIdList: ['inj-1'] });
      service.updateScenarioEvent(event({ id: 'se-new', deltaSeconds: 120 }));
      service.copyScenarioEventsToMsel('msel-1', ['se-1']);

      expect(scenarioEventApi.updateScenarioEvent).toHaveBeenCalledWith(
        'se-new',
        expect.objectContaining({ deltaSeconds: 120 }),
      );
      expect(scenarioEventApi.copyScenarioEventsToMsel).toHaveBeenCalledWith(
        'msel-1',
        ['se-1'],
      );
      expect(ids(query.getAll())).toEqual([
        'se-1',
        'se-new',
        'se-inject',
        'se-copy',
      ]);
      expect(query.getEntity('se-new').deltaSeconds).toBe(120);
      expect(query.getValue().loading).toBe(false);
    });

    /**
     * Verifies: delete and batchDelete call the API but leave the store alone; removal arrives through the ScenarioEventDeleted SignalR event.
     * Interacts with: ScenarioEventService.deleteScenarioEvent / batchDeleteScenarioEvents (stubs), real ScenarioEventQuery.
     * Data: two stored events.
     */
    it('delete and batchDelete leave removal to SignalR', () => {
      const { service, query, scenarioEventApi } = setup();
      service.updateStore(event());
      service.updateStore(event({ id: 'se-2' }));
      scenarioEventApi.deleteScenarioEvent.mockReturnValue(of(null));
      scenarioEventApi.batchDeleteScenarioEvents.mockReturnValue(of(null));

      service.delete('se-1');
      service.batchDelete(['se-1', 'se-2']);

      expect(scenarioEventApi.deleteScenarioEvent).toHaveBeenCalledWith('se-1');
      expect(scenarioEventApi.batchDeleteScenarioEvents).toHaveBeenCalledWith([
        'se-1',
        'se-2',
      ]);
      expect(ids(query.getAll())).toEqual(['se-1', 'se-2']);
    });

    /**
     * Verifies: updateStore/deleteFromStore (the SignalR targets) and unload drive the query output.
     * Interacts with: real ScenarioEventStore through the service, ScenarioEventQuery.selectAll.
     * Data: create se-1, move it to 300s, delete it, then unload a re-added event.
     */
    it('updateStore, deleteFromStore and unload drive the query output', () => {
      const { service, query } = setup();
      const emissions = recordEmissions(query.selectAll());

      service.updateStore(event());
      service.updateStore({ id: 'se-1', deltaSeconds: 300 });
      service.deleteFromStore('se-1');
      service.updateStore(event({ id: 'se-2' }));
      service.unload();

      expect(
        emissions.map((list) => list.map((e) => `${e.id}@${e.deltaSeconds}`)),
      ).toEqual([[], ['se-1@0'], ['se-1@300'], [], ['se-2@0'], []]);
    });
  });

  describe('view helpers', () => {
    const fields: DataField[] = [
      { id: 'f-title', name: 'Title', dataType: DataFieldType.String },
      { id: 'f-priority', name: 'Priority', dataType: DataFieldType.Integer },
      { id: 'f-card', name: 'Card', dataType: DataFieldType.Card },
      { id: 'f-owner', name: 'Owner', dataType: DataFieldType.User },
      { id: 'f-body', name: 'Body', dataType: DataFieldType.Html },
      { id: 'f-when', name: 'When', dataType: DataFieldType.DateTime },
      { id: 'f-teams', name: 'Teams', dataType: DataFieldType.TeamsMultiple },
    ];

    function value(
      scenarioEventId: string,
      dataFieldId: string,
      v: string,
    ): DataValue {
      return { id: `${scenarioEventId}-${dataFieldId}`, scenarioEventId, dataFieldId, value: v };
    }

    // ScenarioEventView declares getter-only members that the list component
    // backs with fields; a writable copy lets a test flip them between calls.
    type WritableView = {
      -readonly [K in keyof ScenarioEventView]: ScenarioEventView[K];
    };

    function view(overrides: Partial<WritableView> = {}): WritableView {
      return {
        mselScenarioEvents: [],
        displayedScenarioEvents: [],
        filterString: '',
        showHiddenEvents: false,
        sort: { active: '', direction: '' },
        dataFields: fields,
        dataValues: [],
        cardList: [{ id: 'card-1', name: 'Breach Card' }],
        userList: [{ id: 'user-1', name: 'Alice Analyst' }],
        viewIndex: new ScenarioEventViewIndexing(),
        ...overrides,
      };
    }

    // Builds every index the list component builds, in the same order.
    function index(service: ScenarioEventDataService, v: ScenarioEventView) {
      service.updateScenarioEventViewCards(v);
      service.updateScenarioEventViewUsers(v);
      service.updateScenarioEventViewDataFields(v);
      service.updateScenarioEventViewDataValues(v);
    }

    /**
     * Verifies: the value index keys each event's values by field name, resolving card and user ids to names and splitting multi-select values.
     * Interacts with: ScenarioEventDataService.updateScenarioEventView* helpers.
     * Data: se-1 with a Card, User, Html and TeamsMultiple value, plus a value for an unknown field.
     */
    it('indexes values by field name with resolved display values', () => {
      const { service } = setup();
      const v = view({
        dataValues: [
          value('se-1', 'f-card', 'card-1'),
          value('se-1', 'f-owner', 'user-1'),
          value('se-1', 'f-body', '<p>Hidden from search</p>'),
          value('se-1', 'f-teams', 'RED, BLUE'),
          value('se-1', 'f-unknown', 'ignored'),
        ],
      });

      index(service, v);

      const se1 = v.viewIndex.valueMap.get('se-1');
      expect([...se1.keys()]).toEqual(['Card', 'Owner', 'Body', 'Teams']);
      expect(se1.get('Card').sortAndFilterValue).toBe('Breach Card');
      expect(se1.get('Owner').sortAndFilterValue).toBe('Alice Analyst');
      expect(se1.get('Body').sortAndFilterValue).toBe('');
      expect(se1.get('Teams').valueArray).toEqual(['RED', 'BLUE']);
      expect(se1.get('Teams').fieldType).toBe(DataFieldType.TeamsMultiple);
    });

    /**
     * Verifies: refreshScenarioEventViewEvents copies the events, drops hidden ones unless showHiddenEvents is set, and records each kept event's original position.
     * Interacts with: ScenarioEventDataService.refreshScenarioEventViewEvents.
     * Data: three events, the middle one hidden.
     */
    it('refreshScenarioEventViewEvents hides hidden events unless asked', () => {
      const { service } = setup();
      const events = [
        event({ id: 'a' }),
        event({ id: 'b', isHidden: true }),
        event({ id: 'c' }),
      ];
      const v = view();

      service.refreshScenarioEventViewEvents(v, events);
      expect(ids(v.mselScenarioEvents)).toEqual(['a', 'c']);
      expect(v.mselScenarioEvents[0]).not.toBe(events[0]);
      expect([...v.viewIndex.mselScenarioEvtIndex]).toEqual([
        ['a', 0],
        ['c', 2],
      ]);

      v.showHiddenEvents = true;
      service.refreshScenarioEventViewEvents(v, events);
      expect(ids(v.mselScenarioEvents)).toEqual(['a', 'b', 'c']);
    });

    /**
     * Verifies: the displayed list keeps only events whose indexed values contain the filter text (case-insensitive), skips events with no values, and falls back to time then group order.
     * Interacts with: ScenarioEventDataService.updateScenarioEventViewDisplayedEvents.
     * Data: four events (one without values); filter "BREACH" matches a card name on two of them.
     */
    it('filters displayed events on their values and orders them by time', () => {
      const { service } = setup();
      const v = view({
        mselScenarioEvents: [
          event({ id: 'late', deltaSeconds: 600 }),
          event({ id: 'early-2', deltaSeconds: 60, groupOrder: 2 }),
          event({ id: 'early-1', deltaSeconds: 60, groupOrder: 1 }),
          event({ id: 'no-values', deltaSeconds: 0 }),
        ],
        dataValues: [
          value('late', 'f-card', 'card-1'),
          value('early-2', 'f-title', 'Phishing'),
          value('early-1', 'f-title', 'Breach notice'),
        ],
      });
      index(service, v);

      service.updateScenarioEventViewDisplayedEvents(v);
      expect(ids(v.displayedScenarioEvents)).toEqual([
        'early-1',
        'early-2',
        'late',
      ]);

      v.filterString = 'BREACH';
      service.updateScenarioEventViewDisplayedEvents(v);
      expect(ids(v.displayedScenarioEvents)).toEqual(['early-1', 'late']);
    });

    /**
     * Verifies: a column sort on a text field orders case-insensitively and can be reversed, with time as the tie-breaker.
     * Interacts with: ScenarioEventDataService.updateScenarioEventViewDisplayedEvents.
     * Data: titles "bravo", "Alpha", "charlie"; sort Title asc then desc.
     */
    it('sorts displayed events on a text column', () => {
      const { service } = setup();
      const v = view({
        mselScenarioEvents: [
          event({ id: 'b', deltaSeconds: 1 }),
          event({ id: 'a', deltaSeconds: 2 }),
          event({ id: 'c', deltaSeconds: 3 }),
        ],
        dataValues: [
          value('b', 'f-title', 'bravo'),
          value('a', 'f-title', 'Alpha'),
          value('c', 'f-title', 'charlie'),
        ],
        sort: { active: 'Title', direction: 'asc' },
      });
      index(service, v);

      service.updateScenarioEventViewDisplayedEvents(v);
      expect(ids(v.displayedScenarioEvents)).toEqual(['a', 'b', 'c']);

      v.sort = { active: 'Title', direction: 'desc' };
      service.updateScenarioEventViewDisplayedEvents(v);
      expect(ids(v.displayedScenarioEvents)).toEqual(['c', 'b', 'a']);
    });

    /**
     * Verifies: a numeric column sorts numerically, with an empty value lowest but a missing value sorting as zero.
     * Interacts with: ScenarioEventDataService.updateScenarioEventViewDisplayedEvents (sortAsNumbers / getNumOrDefault).
     * Data: Priority 10, -3, "" (empty) and missing (the event only has a Title); sort Priority asc.
     */
    it('sorts a numeric column numerically', () => {
      const { service } = setup();
      const v = view({
        mselScenarioEvents: [
          event({ id: 'ten' }),
          event({ id: 'minus-three' }),
          event({ id: 'empty' }),
          event({ id: 'missing' }),
        ],
        dataValues: [
          value('ten', 'f-priority', '10'),
          value('minus-three', 'f-priority', '-3'),
          value('empty', 'f-priority', ''),
          value('missing', 'f-title', 'No priority set'),
        ],
        sort: { active: 'Priority', direction: 'asc' },
      });
      index(service, v);

      service.updateScenarioEventViewDisplayedEvents(v);

      expect(ids(v.displayedScenarioEvents)).toEqual([
        'empty',
        'minus-three',
        'missing',
        'ten',
      ]);
    });

    /**
     * Verifies: getDataValueFromView synthesizes Integer values for the deltaSeconds and groupOrder pseudo-fields and returns a blank value for an unset field.
     * Interacts with: ScenarioEventDataService.getDataValueFromView.
     * Data: an event at 90s, group 3, with no indexed values.
     */
    it('getDataValueFromView handles the pseudo-fields and unset fields', () => {
      const { service } = setup();
      const v = view();
      index(service, v);
      const se = event({ deltaSeconds: 90, groupOrder: 3 });

      expect(service.getDataValueFromView(v, se, 'deltaSeconds')).toMatchObject({
        value: '90',
        sortAndFilterValue: 90,
        fieldType: DataFieldType.Integer,
        scenarioEventId: 'se-1',
      });
      expect(service.getDataValueFromView(v, se, 'groupOrder').value).toBe('3');
      expect(service.getDataValueFromView(v, se, 'Title')).toMatchObject({
        value: '',
        scenarioEventId: 'se-1',
      });
    });

    /**
     * Verifies: getDisplayValueFromView shows card/user names, formats DateTime values as "dd MMM yyyy HH:mm TZ", and blanks unparseable dates.
     * Interacts with: ScenarioEventDataService.getDisplayValueFromView.
     * Data: se-1 with a card, user, local date-time, plain text; se-2 with an invalid date.
     */
    it('getDisplayValueFromView formats values for display', () => {
      const { service } = setup();
      const v = view({
        dataValues: [
          value('se-1', 'f-card', 'card-1'),
          value('se-1', 'f-owner', 'user-1'),
          value('se-1', 'f-when', '2026-03-04T05:06:00'),
          value('se-1', 'f-title', 'Phishing'),
          value('se-2', 'f-when', 'not a date'),
        ],
      });
      index(service, v);
      const se1 = event();
      const se2 = event({ id: 'se-2' });

      expect(service.getDisplayValueFromView(v, se1, 'Card')).toBe('Breach Card');
      expect(service.getDisplayValueFromView(v, se1, 'Owner')).toBe(
        'Alice Analyst',
      );
      expect(service.getDisplayValueFromView(v, se1, 'When')).toMatch(
        /^04 Mar 2026 05:06 \S+$/,
      );
      expect(service.getDisplayValueFromView(v, se1, 'Title')).toBe('Phishing');
      expect(service.getDisplayValueFromView(v, se2, 'When')).toBe(' ');
      expect(service.getDisplayValueFromView(v, se2, 'Title')).toBe('');
    });

    /**
     * Verifies: getMoveAndGroupNumbers assigns each time-sorted event to the latest move that has started and numbers groups of simultaneous events within a move.
     * Interacts with: ScenarioEventDataService.getMoveAndGroupNumbers.
     * Data: moves 1 (0s) and 2 (300s); events at 0, 0, 60, 300 and 400 seconds.
     */
    it('getMoveAndGroupNumbers numbers moves and groups', () => {
      const { service } = setup();
      const events = [
        event({ id: 'e0a', deltaSeconds: 0 }),
        event({ id: 'e0b', deltaSeconds: 0 }),
        event({ id: 'e60', deltaSeconds: 60 }),
        event({ id: 'e300', deltaSeconds: 300 }),
        event({ id: 'e400', deltaSeconds: 400 }),
      ];
      const moves = [
        { id: 'm2', moveNumber: 2, deltaSeconds: 300 },
        { id: 'm1', moveNumber: 1, deltaSeconds: 0 },
      ];

      const numbers = service.getMoveAndGroupNumbers(events, moves);

      expect(numbers['e0a']).toEqual([1, 0]);
      expect(numbers['e0b']).toEqual([1, 0]);
      expect(numbers['e60']).toEqual([1, 1]);
      expect(numbers['e300']).toEqual([2, 0]);
      expect(numbers['e400']).toEqual([2, 1]);
    });

    /**
     * Verifies: without moves every event gets move -1, and an empty event list yields no numbers.
     * Interacts with: ScenarioEventDataService.getMoveAndGroupNumbers.
     * Data: two events and no moves; then no events.
     */
    it('getMoveAndGroupNumbers uses -1 when there are no moves', () => {
      const { service } = setup();
      const numbers = service.getMoveAndGroupNumbers(
        [event({ id: 'a', deltaSeconds: 0 }), event({ id: 'b', deltaSeconds: 5 })],
        [],
      );

      expect(numbers['a']).toEqual([-1, 0]);
      expect(numbers['b']).toEqual([-1, 1]);
      expect(service.getMoveAndGroupNumbers([], [])).toEqual([]);
    });
  });

  /**
   * Verifies: a failed request leaves loading set for every method that sets it first (current behavior), and the ones with no error callback let the error escape.
   * Interacts with: ScenarioEventService endpoints (stubs failing), real ScenarioEventStore and ScenarioEventQuery, captureUnhandledRxErrors.
   * Data: loading cleared first; each endpoint fails with "request failed".
   */
  it.each([
    { method: 'loadById', endpoint: 'getScenarioEvent', escapes: true, call: (s: ScenarioEventDataService) => s.loadById('x-1') },
    { method: 'add', endpoint: 'createScenarioEvent', escapes: true, call: (s: ScenarioEventDataService) => s.add({ id: 'x-1' }) },
    { method: 'addInjects', endpoint: 'createScenarioEventsFromInjects', escapes: true, call: (s: ScenarioEventDataService) => s.addInjects({ mselId: 'msel-1' }) },
    { method: 'updateScenarioEvent', endpoint: 'updateScenarioEvent', escapes: true, call: (s: ScenarioEventDataService) => s.updateScenarioEvent({ id: 'x-1' }) },
  ] as const)('$method leaves loading stuck when its request fails', async ({ endpoint, escapes, call }) => {
    const { service, scenarioEventApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    TestBed.inject(ScenarioEventStore).setLoading(false);
    scenarioEventApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    expect(TestBed.inject(ScenarioEventQuery).getValue().loading).toBe(true);
    // With no error callback the error escapes to ErrorService, the ErrorHandler
    // app.module.ts provides, which shows it.
    expect(errors).toEqual(escapes ? [failure] : []);
  });

  /**
   * Verifies: a failed request from delete, batchDelete, copyScenarioEventsToMsel escapes to the app's global ErrorHandler.
   * Interacts with: ScenarioEventService endpoints (stubs failing), captureUnhandledRxErrors.
   * Data: each endpoint fails with "request failed".
   */
  it.each([
    { method: 'delete', endpoint: 'deleteScenarioEvent', call: (s: ScenarioEventDataService) => s.delete('x-1') },
    { method: 'batchDelete', endpoint: 'batchDeleteScenarioEvents', call: (s: ScenarioEventDataService) => s.batchDelete(['x-1']) },
    { method: 'copyScenarioEventsToMsel', endpoint: 'copyScenarioEventsToMsel', call: (s: ScenarioEventDataService) => s.copyScenarioEventsToMsel('msel-1', ['x-1']) },
  ] as const)('$method lets a failed request reach the global ErrorHandler', async ({ endpoint, call }) => {
    const { service, scenarioEventApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    scenarioEventApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    // These methods subscribe with no error callback and set no loading flag,
    // so the error escapes to ErrorService, the ErrorHandler app.module.ts
    // provides, which shows it to the user. Not a defect on its own.
    expect(errors).toEqual([failure]);
  });
});

describe('ScenarioEventQuery', () => {
  /**
   * Verifies: selectAll orders events by deltaSeconds, then groupOrder, coercing string numbers.
   * Interacts with: real ScenarioEventStore and ScenarioEventQuery (querySort).
   * Data: events at 120s, 60s group 2, 60s group 1 and "30"s (a string).
   */
  it('orders events by time then group', async () => {
    const store = new ScenarioEventStore();
    const query = new ScenarioEventQuery(store);
    store.set([
      event({ id: 'late', deltaSeconds: 120 }),
      event({ id: 'mid-2', deltaSeconds: 60, groupOrder: 2 }),
      event({ id: 'mid-1', deltaSeconds: 60, groupOrder: 1 }),
      event({ id: 'first', deltaSeconds: '30' as unknown as number }),
    ]);

    expect(ids(await firstValueFrom(query.selectAll()))).toEqual([
      'first',
      'mid-1',
      'mid-2',
      'late',
    ]);
    expect((await firstValueFrom(query.selectById('mid-1'))).groupOrder).toBe(1);
  });
});
