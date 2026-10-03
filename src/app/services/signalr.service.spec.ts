// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ProviderToken } from '@angular/core';
import { Subject, of } from 'rxjs';
import * as signalR from '@microsoft/signalr';
import { ComnAuthService, ComnSettingsService } from '@cmusei/crucible-common';
import { MselUnit, MselUnitService } from 'src/app/generated/blueprint.api';
import { ApplicationArea, PresenceActor, SignalRService } from './signalr.service';
import { CardQuery } from '../data/card/card.query';
import { CatalogQuery } from '../data/catalog/catalog.query';
import { CiteActionQuery } from '../data/cite-action/cite-action.query';
import { CiteDutyQuery } from '../data/cite-duty/cite-duty.query';
import { DataFieldQuery } from '../data/data-field/data-field.query';
import { DataFieldTemplateQuery } from '../data/data-field/data-field-template.query';
import { DataOptionQuery } from '../data/data-option/data-option.query';
import { DataValueQuery } from '../data/data-value/data-value.query';
import { InjectmQuery } from '../data/injectm/injectm.query';
import { InjectTypeQuery } from '../data/inject-type/inject-type.query';
import { MoveQuery } from '../data/move/move.query';
import { MselQuery } from '../data/msel/msel.query';
import { MselUnitQuery } from '../data/msel-unit/msel-unit.query';
import { OrganizationQuery } from '../data/organization/organization.query';
import { PlayerApplicationQuery } from '../data/player-application/player-application.query';
import { ScenarioEventQuery } from '../data/scenario-event/scenario-event.query';
import { TeamQuery } from '../data/team/team.query';
import { TeamUserQuery } from '../data/team-user/team-user.query';
import { UnitQuery } from '../data/unit/unit.query';
import { UserQuery } from '../data/user/user.query';
import { UserMselRoleQuery } from '../data/user-msel-role/user-msel-role.query';
import { CardTeamDataService } from '../data/team/card-team-data.service';
import { PlayerApplicationTeamDataService } from '../data/team/player-application-team-data.service';
import { ApiStub } from '../test-utils/api-stub';
import { getDefaultProviders } from '../test-utils/default-test-providers';
import { recordEmissions } from '../test-utils/record-emissions';
import { mockHubConnectionBuilder, rejectInvokes } from '../test-utils/fake-hub-connection';
import { captureUnhandledRejections, flush } from '../test-utils/unhandled-rx-errors';

// Set in beforeEach: every HubConnectionBuilder.build() returns a FakeHubConnection.
let hubs: ReturnType<typeof mockHubConnectionBuilder>;
const builtUrls = () => hubs.withUrl.mock.calls.map(([url]) => url);

function setup() {
  const user$ = new Subject<unknown>();
  const mselUnitApi = {
    getMselUnits: vi.fn(() => of<MselUnit[]>([])),
  } satisfies ApiStub<MselUnitService>;
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      ...getDefaultProviders([
        // The defaults hold a placeholder for SignalRService; use the real one.
        SignalRService,
        {
          provide: ComnAuthService,
          useValue: {
            // The tests push bare { profile } objects, not full oidc Users.
            user$: user$ as unknown as ComnAuthService['user$'],
            getAuthorizationToken: () => 'tok-123',
          } satisfies Pick<ComnAuthService, 'user$' | 'getAuthorizationToken'>,
        },
        {
          provide: ComnSettingsService,
          useValue: { settings: { ApiUrl: 'https://blueprint.test' } } satisfies Pick<ComnSettingsService, 'settings'>,
        },
        { provide: MselUnitService, useValue: mselUnitApi },
      ]),
    ],
  });
  const service = TestBed.inject(SignalRService);
  return { service, user$, mselUnitApi };
}

async function connect(area = ApplicationArea.home) {
  const ctx = setup();
  await ctx.service.startConnection(area);
  await flush();
  const [hub] = hubs.connections;
  return { ...ctx, hub };
}

// The slice of an Akita QueryEntity these tests read; every entity query satisfies it.
interface EntityLookup {
  getEntity(id: string): unknown;
  hasEntity(id: string): boolean;
  getAll(): Array<{ id?: string }>;
}

function ids(token: ProviderToken<EntityLookup>) {
  return TestBed.inject(token).getAll().map((e) => e.id);
}

describe('SignalRService', () => {
  beforeEach(() => {
    hubs = mockHubConnectionBuilder();
    TestBed.resetTestingModule();
  });

  describe('connection lifecycle', () => {
    /**
     * Verifies: startConnection builds one hub connection to /hubs/main with the bearer token, starts it, and joins the home area.
     * Interacts with: mocked HubConnectionBuilder producing a FakeHubConnection, ComnAuthService.getAuthorizationToken (stub).
     * Data: ApiUrl https://blueprint.test, token tok-123.
     */
    it('connects with the bearer token and joins', async () => {
      const { hub } = await connect();

      expect(hubs.connections).toHaveLength(1);
      expect(builtUrls()).toEqual(['https://blueprint.test/hubs/main?bearer=tok-123']);
      expect(hub.start).toHaveBeenCalledTimes(1);
      expect(hub.invoke).toHaveBeenCalledWith('Join');
    });

    /**
     * Verifies: the admin area joins with JoinAdmin, and asking again for the same area reuses the existing connection.
     * Interacts with: SignalRService.startConnection, FakeHubConnection.invoke.
     * Data: ApplicationArea.admin requested twice.
     */
    it('joins the admin area once per connection', async () => {
      const { service, hub } = await connect(ApplicationArea.admin);

      const again = service.startConnection(ApplicationArea.admin);
      await again;

      expect(hubs.connections).toHaveLength(1);
      expect(hub.invoke).toHaveBeenCalledWith('JoinAdmin');
    });

    /**
     * Verifies: an automatic reconnect re-joins the area.
     * Interacts with: FakeHubConnection.reconnect() and invoke spy.
     * Data: the home area; invoke history cleared before the reconnect.
     */
    it('rejoins after an automatic reconnect', async () => {
      const { hub } = await connect();
      hub.invoke.mockClear();

      hub.reconnect();

      expect(hub.invoke).toHaveBeenCalledWith('Join');
    });

    /**
     * Verifies: a new signed-in user restarts the existing connection with a fresh token URL and re-joins.
     * Interacts with: ComnAuthService.user$ (stub subject), FakeHubConnection stop/start/baseUrl.
     * Data: a user$ emission after the connection is up.
     */
    it('reconnects with a fresh URL when the signed-in user changes', async () => {
      const { hub, user$ } = await connect();
      hub.invoke.mockClear();

      user$.next({ profile: { sub: 'user-2' } });
      await flush();

      expect(hub.stop).toHaveBeenCalledTimes(1);
      expect(hub.start).toHaveBeenCalledTimes(2);
      expect(hub.baseUrl).toBe('https://blueprint.test/hubs/main?bearer=tok-123');
      expect(hub.invoke).toHaveBeenCalledWith('Join');
    });

    /**
     * Verifies: leave invokes Leave for the joined area and clears presence.
     * Interacts with: FakeHubConnection.invoke, SignalRService.actors$.
     * Data: one actor present before leaving.
     */
    it('leave exits the area and clears presence', async () => {
      const { service, hub } = await connect();
      const actors = recordEmissions(service.actors$);
      hub.trigger('PresenceGreeted', { id: 'user-2', name: 'Bob' });

      service.leave();

      expect(hub.invoke).toHaveBeenCalledWith('Leave');
      expect(actors.at(-1)).toEqual([]);
    });
  });

  describe('failed start', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    const refused = new Error('connection refused');
    // Every connection built from here on fails to start.
    const failEveryStart = () => {
      hubs = mockHubConnectionBuilder({
        onBuild: (c) => c.start.mockRejectedValue(refused),
      });
    };

    /**
     * Verifies: when start() fails, startConnection rejects to the caller, never joins, and the internal join chain is an unhandled rejection.
     * Interacts with: mocked HubConnectionBuilder whose FakeHubConnection.start rejects, captureUnhandledRejections.
     * Data: start() rejects with "connection refused".
     */
    it('startConnection leaves a failed start unhandled', async () => {
      failEveryStart();
      const rejections = captureUnhandledRejections();
      const { service } = setup();

      await expect(service.startConnection(ApplicationArea.home)).rejects.toThrow('connection refused');
      await flush();

      expect(hubs.connections[0].invoke).not.toHaveBeenCalled();
      expect(rejections).toEqual([refused]);
    });

    /**
     * Verifies: after a failed start, asking for the same area again returns the cached rejected promise instead of building a new connection.
     * Interacts with: SignalRService.startConnection, mocked HubConnectionBuilder, captureUnhandledRejections.
     * Data: start() rejects; the home area requested twice.
     */
    it('never retries an area whose start failed', async () => {
      failEveryStart();
      const rejections = captureUnhandledRejections();
      const { service } = setup();
      await service.startConnection(ApplicationArea.home).catch(() => undefined);

      const again = service.startConnection(ApplicationArea.home);
      await expect(again).rejects.toThrow('connection refused');
      await flush();

      expect(hubs.connections).toHaveLength(1);
      expect(hubs.connections[0].start).toHaveBeenCalledTimes(1);
      // Only the first call's join chain is unhandled; the cached promise is not re-joined.
      expect(rejections).toEqual([refused]);
    });

    /**
     * Verifies: when the restart after a user change fails, the rejection is unhandled and no retry is scheduled.
     * Interacts with: ComnAuthService.user$ (stub subject), FakeHubConnection stop/start, Vitest fake timers, captureUnhandledRejections.
     * Data: a connected hub whose next start() rejects; timers advanced 2 s.
     */
    it('reconnect leaves a failed restart unhandled and does not retry', async () => {
      const { hub, user$ } = await connect();
      hub.start.mockRejectedValue(refused);
      const rejections = captureUnhandledRejections();
      vi.useFakeTimers();

      user$.next({ profile: { sub: 'user-2' } });
      await vi.advanceTimersByTimeAsync(2000);

      expect(rejections).toEqual([refused]);
      expect(hub.start).toHaveBeenCalledTimes(2);
    });
  });

  describe('hub calls', () => {
    const failure = new Error('hub call failed');

    /**
     * Verifies: a hub call the service fires without a .catch leaves an unhandled rejection when the hub rejects it (current behavior).
     * Interacts with: FakeHubConnection with rejectInvokes (only the named method rejects), SignalRService.join / leave and the PresenceArrived handler, captureUnhandledRejections.
     * Data: the hub rejects Join, Leave or Greet with "hub call failed"; every other invoke resolves.
     */
    it.each([
      {
        method: 'join',
        hubMethod: 'Join',
        act: async () => {
          let calls: Array<[string, ...unknown[]]> = [];
          hubs = mockHubConnectionBuilder({ onBuild: (c) => (calls = rejectInvokes(c, failure, ['Join'])) });
          await setup().service.startConnection(ApplicationArea.home);
          return calls;
        },
      },
      {
        method: 'leave',
        hubMethod: 'Leave',
        act: async () => {
          const { service, hub } = await connect();
          const calls = rejectInvokes(hub, failure, ['Leave']);
          service.leave();
          return calls;
        },
      },
      {
        method: 'the PresenceArrived handler',
        hubMethod: 'Greet',
        act: async () => {
          const { service, hub } = await connect();
          service.selectMsel('msel-1');
          await flush();
          const calls = rejectInvokes(hub, failure, ['Greet']);
          hub.trigger('PresenceArrived', { id: 'user-3', name: 'Carol' });
          return calls;
        },
      },
    ])('$method leaves a rejected $hubMethod unhandled', async ({ hubMethod, act }) => {
      const rejections = captureUnhandledRejections();

      const calls = await act();
      await flush();

      expect(calls.map(([m]) => m)).toContain(hubMethod);
      expect(rejections).toEqual([failure]);
    });
  });

  describe('entity events', () => {
    // Each Akita-backed entity: the event prefix, its query, and a payload.
    // Payloads follow blueprint.api's Infrastructure/EventHandlers/*Handler.cs:
    // Created and Updated send (entity, modifiedProperties), null for Created;
    // Deleted sends the bare id (TeamUser and UnitUser send the entity). The
    // API has no DataOption or MselUnit handler, so those two rows exercise UI
    // handlers that nothing triggers today (DataField events carry options).
    const cases: Array<[string, ProviderToken<EntityLookup>, Record<string, unknown>]> = [
      ['Card', CardQuery, { name: 'Breach Card', mselId: 'msel-1' }],
      ['Catalog', CatalogQuery, { name: 'Ransomware Catalog' }],
      ['CiteAction', CiteActionQuery, { description: 'Isolate the host' }],
      ['CiteDuty', CiteDutyQuery, { name: 'Incident Commander' }],
      ['DataOption', DataOptionQuery, { optionName: 'Open' }],
      ['DataValue', DataValueQuery, { value: 'RED' }],
      ['Inject', InjectmQuery, { name: 'Ransom note' }],
      ['InjectType', InjectTypeQuery, { name: 'Email' }],
      ['Move', MoveQuery, { description: 'Move 1' }],
      ['Msel', MselQuery, { name: 'Exercise Alpha' }],
      ['MselUnit', MselUnitQuery, { unitId: 'unit-red' }],
      ['Organization', OrganizationQuery, { name: 'City Hospital' }],
      ['PlayerApplication', PlayerApplicationQuery, { name: 'Gallery' }],
      ['ScenarioEvent', ScenarioEventQuery, { deltaSeconds: 60 }],
      ['Team', TeamQuery, { name: 'Red Cell' }],
      ['UserMselRole', UserMselRoleQuery, { role: 'Editor' }],
    ];

    /**
     * Verifies: for each entity, the Created event adds it to its store, Updated merges the change, and Deleted (carrying the id) removes it.
     * Interacts with: FakeHubConnection.trigger, the real data services, stores and queries.
     * Data: one entity per type with id "<prefix>-1"; the update adds an "edited" flag.
     */
    it.each(cases)('%sCreated/Updated/Deleted keep the store in step', async (prefix, token, payload) => {
      const { hub } = await connect();
      const query = TestBed.inject(token);
      const id = `${prefix}-1`;

      hub.trigger(`${prefix}Created`, { id, ...payload }, null);
      expect(query.getEntity(id)).toMatchObject(payload);

      hub.trigger(`${prefix}Updated`, { id, ...payload, edited: true }, ['edited']);
      expect(query.getEntity(id)).toMatchObject({ ...payload, edited: true });

      hub.trigger(`${prefix}Deleted`, id);
      expect(query.hasEntity(id)).toBe(false);
    });

    /**
     * Verifies: DataField events route templates and MSEL fields to their own stores, and DataFieldDeleted removes from both.
     * Interacts with: FakeHubConnection.trigger, DataFieldDataService, DataFieldQuery and DataFieldTemplateQuery.
     * Data: an MSEL field df-1 and a template tmpl-1.
     */
    it('DataField events split templates from MSEL fields', async () => {
      const { hub } = await connect();

      hub.trigger('DataFieldCreated', { id: 'df-1', name: 'Title', isTemplate: false }, null);
      hub.trigger('DataFieldUpdated', { id: 'tmpl-1', name: 'Template', isTemplate: true }, ['name', 'isTemplate']);
      expect(ids(DataFieldQuery)).toEqual(['df-1']);
      expect(ids(DataFieldTemplateQuery)).toEqual(['tmpl-1']);

      hub.trigger('DataFieldDeleted', 'df-1');
      hub.trigger('DataFieldDeleted', 'tmpl-1');
      expect(ids(DataFieldQuery)).toEqual([]);
      expect(ids(DataFieldTemplateQuery)).toEqual([]);
    });

    /**
     * Verifies: TeamUserDeleted carries the whole team user and removes it by its id.
     * Interacts with: FakeHubConnection.trigger, TeamUserDataService, TeamUserQuery.
     * Data: team user tu-1 created then deleted.
     */
    it('TeamUser events add and remove team users', async () => {
      const { hub } = await connect();

      hub.trigger('TeamUserCreated', { id: 'tu-1', teamId: 'team-red', userId: 'user-1' }, null);
      hub.trigger('TeamUserUpdated', { id: 'tu-2', teamId: 'team-red', userId: 'user-2' }, ['teamId']);
      expect(ids(TeamUserQuery)).toEqual(['tu-1', 'tu-2']);

      hub.trigger('TeamUserDeleted', { id: 'tu-1', teamId: 'team-red', userId: 'user-1' });
      expect(ids(TeamUserQuery)).toEqual(['tu-2']);
    });

    /**
     * Verifies: UserCreated adds a user and UserDeleted removes it, while UserUpdated for a stored user changes nothing.
     * Interacts with: FakeHubConnection.trigger, UserDataService, UserQuery.
     * Data: user-1 "Alice" created, updated to "Alice Admin", deleted.
     */
    it('User events add and remove users but ignore updates', async () => {
      const { hub } = await connect();
      const users = TestBed.inject(UserQuery);

      hub.trigger('UserCreated', { id: 'user-1', name: 'Alice' }, null);
      hub.trigger('UserUpdated', { id: 'user-1', name: 'Alice Admin' }, ['name']);
      // Current behaviour: updateStore uses add(), so the update is dropped (see
      // user-data.service.spec.ts, 'update does not replace a user that is already stored').
      expect(users.getEntity('user-1').name).toBe('Alice');

      hub.trigger('UserDeleted', 'user-1');
      expect(users.getAll()).toEqual([]);
    });

    /**
     * Verifies: CardTeam and PlayerApplicationTeam events update their list services.
     * Interacts with: FakeHubConnection.trigger, CardTeamDataService.cardTeams and PlayerApplicationTeamDataService.playerApplicationTeams.
     * Data: one card team and one application team, each created then deleted.
     */
    it('CardTeam and PlayerApplicationTeam events update their lists', async () => {
      const { hub } = await connect();
      const cardTeams = recordEmissions(TestBed.inject(CardTeamDataService).cardTeams);
      const appTeams = recordEmissions(
        TestBed.inject(PlayerApplicationTeamDataService).playerApplicationTeams,
      );

      hub.trigger('CardTeamCreated', { id: 'ct-1', cardId: 'card-1', teamId: 'team-red' }, null);
      hub.trigger('CardTeamUpdated', { id: 'ct-1', cardId: 'card-1', teamId: 'team-blue' }, ['teamId']);
      hub.trigger('PlayerApplicationTeamCreated', { id: 'pat-1', teamId: 'team-red' }, null);
      hub.trigger('PlayerApplicationTeamUpdated', { id: 'pat-1', teamId: 'team-blue' }, ['teamId']);
      expect(cardTeams.at(-1)).toEqual([{ id: 'ct-1', cardId: 'card-1', teamId: 'team-blue' }]);
      expect(appTeams.at(-1)).toEqual([{ id: 'pat-1', teamId: 'team-blue' }]);

      hub.trigger('CardTeamDeleted', 'ct-1');
      hub.trigger('PlayerApplicationTeamDeleted', 'pat-1');
      expect(cardTeams.at(-1)).toEqual([]);
      expect(appTeams.at(-1)).toEqual([]);
    });

    /**
     * Verifies: IntegrationStatusUpdated patches the MSEL's integration status text.
     * Interacts with: FakeHubConnection.trigger (two arguments), MselDataService, MselQuery.
     * Data: msel-1 stored; status "Pushing to CITE".
     */
    it('IntegrationStatusUpdated patches the MSEL status', async () => {
      const { hub } = await connect();
      hub.trigger('MselCreated', { id: 'msel-1', name: 'Exercise Alpha' }, null);

      hub.trigger('IntegrationStatusUpdated', 'msel-1', 'Pushing to CITE');

      expect(TestBed.inject(MselQuery).getEntity('msel-1')).toMatchObject({
        name: 'Exercise Alpha',
        integrationStatus: 'Pushing to CITE',
      });
    });

    /**
     * Verifies: Unit changes and unit-user changes reload the selected MSEL's units, and do nothing when no MSEL is selected.
     * Interacts with: FakeHubConnection.trigger, UnitDataService, MselUnitDataService → MselUnitService.getMselUnits (stub).
     * Data: unit-red created/updated/deleted and two unit-user events, first with no MSEL selected, then with msel-1 selected.
     */
    it('Unit and UnitUser events reload the selected MSEL units', async () => {
      const { service, hub, mselUnitApi } = await connect();

      hub.trigger('UnitCreated', { id: 'unit-red', name: 'Red Cell' }, null);
      hub.trigger('UnitUpdated', { id: 'unit-red', name: 'Red Team' }, ['name']);
      hub.trigger('UnitUserCreated', { unitId: 'unit-red', userId: 'user-1' }, null);
      expect(TestBed.inject(UnitQuery).getEntity('unit-red').name).toBe('Red Team');
      expect(mselUnitApi.getMselUnits).not.toHaveBeenCalled();

      service.selectMsel('msel-1');
      hub.trigger('UnitUpdated', { id: 'unit-red', name: 'Red Cell' }, ['name']);
      hub.trigger('UnitDeleted', 'unit-red');
      hub.trigger('UnitUserCreated', { unitId: 'unit-blue', userId: 'user-1' }, null);
      hub.trigger('UnitUserDeleted', { unitId: 'unit-blue', userId: 'user-1' });

      expect(TestBed.inject(UnitQuery).getAll()).toEqual([]);
      expect(mselUnitApi.getMselUnits.mock.calls).toEqual([
        ['msel-1'],
        ['msel-1'],
        ['msel-1'],
        ['msel-1'],
      ]);
    });
  });

  describe('presence', () => {
    const colorsOf = (list: PresenceActor[]) => list.map((a) => `${a.name}:${a.color}`);

    /**
     * Verifies: selecting an MSEL tells the hub, then seeds presence from GetPresence with colors assigned in arrival order.
     * Interacts with: FakeHubConnection.invoke ('selectMsel', 'GetPresence'), SignalRService.actors$.
     * Data: GetPresence returns Alice and Bob for msel-1.
     */
    it('selectMsel announces the MSEL and loads current presence', async () => {
      const { service, hub } = await connect();
      const presence = [
        { id: 'user-1', name: 'Alice' },
        { id: 'user-2', name: 'Bob' },
      ];
      hub.invoke.mockImplementation((method) =>
        Promise.resolve(method === 'GetPresence' ? presence : undefined),
      );
      const actors = recordEmissions(service.actors$);

      service.selectMsel('msel-1');
      await flush();

      expect(hub.invoke).toHaveBeenCalledWith('selectMsel', ['msel-1']);
      expect(hub.invoke).toHaveBeenCalledWith('GetPresence', 'msel-1');
      expect(colorsOf(actors.at(-1))).toEqual(['Alice:primary', 'Bob:accent']);
      expect(actors.at(-1).every((a) => a.online)).toBe(true);
    });

    /**
     * Verifies: a newcomer is added and greeted back, a greeting updates an existing actor in place, and a departure removes the actor.
     * Interacts with: FakeHubConnection.trigger (PresenceArrived/Greeted/Departed) and invoke ('Greet'), SignalRService.actors$.
     * Data: msel-1 selected; Carol arrives, Carol greets under a new display name, Dave greets, Carol departs.
     */
    it('tracks arrivals, greetings and departures', async () => {
      const { service, hub } = await connect();
      service.selectMsel('msel-1');
      await flush();
      const actors = recordEmissions(service.actors$);

      hub.trigger('PresenceArrived', { id: 'user-3', name: 'Carol' });
      expect(hub.invoke).toHaveBeenCalledWith('Greet', 'msel-1');

      hub.trigger('PresenceGreeted', { id: 'user-3', name: 'Carol D.' });
      hub.trigger('PresenceGreeted', { id: 'user-4', name: 'Dave' });
      expect(colorsOf(actors.at(-1))).toEqual(['Carol D.:primary', 'Dave:accent']);

      hub.trigger('PresenceDeparted', { id: 'user-3', name: 'Carol D.' });
      expect(colorsOf(actors.at(-1))).toEqual(['Dave:accent']);
    });

    /**
     * Verifies: the sixth actor wraps around the five-color palette.
     * Interacts with: FakeHubConnection.trigger (PresenceGreeted), SignalRService.actors$.
     * Data: six actors greeting in turn.
     */
    it('cycles presence colors', async () => {
      const { service, hub } = await connect();
      const actors = recordEmissions(service.actors$);

      for (let i = 1; i <= 6; i++) {
        hub.trigger('PresenceGreeted', { id: `user-${i}`, name: `U${i}` });
      }

      expect(actors.at(-1).map((a) => a.color)).toEqual([
        'primary',
        'accent',
        'green',
        'orange',
        'purple',
        'primary',
      ]);
    });

    /**
     * Verifies: clearPresence tells the hub the user left the MSEL and empties presence.
     * Interacts with: FakeHubConnection.invoke, SignalRService.clearPresence / selectMsel, actors$.
     * Data: msel-1 selected in the home area with Bob present, then cleared.
     */
    it('clearPresence leaves the MSEL and empties presence', async () => {
      const { service, hub } = await connect();
      service.selectMsel('msel-1');
      await flush();
      hub.trigger('PresenceGreeted', { id: 'user-2', name: 'Bob' });
      const actors = recordEmissions(service.actors$);

      service.clearPresence();

      expect(hub.invoke).toHaveBeenCalledWith('selectMsel', []);
      expect(actors.at(-1)).toEqual([]);
    });

    /**
     * Verifies: an admin-area connection never announces MSEL selection to the hub.
     * Interacts with: FakeHubConnection.invoke, SignalRService.selectMsel.
     * Data: an admin-area connection selecting msel-2.
     */
    it('the admin area does not announce MSEL selection', async () => {
      const { service, hub } = await connect(ApplicationArea.admin);

      service.selectMsel('msel-2');
      await flush();

      expect(hub.invoke).toHaveBeenCalledWith('JoinAdmin');
      expect(hub.invoke).not.toHaveBeenCalledWith('selectMsel', ['msel-2']);
      expect(hub.invoke).not.toHaveBeenCalledWith('GetPresence', 'msel-2');
    });
  });

  describe('timers', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    /**
     * Verifies: selectMsel before the hub is connected retries every 500 ms until it is.
     * Interacts with: SignalRService.selectMsel, FakeHubConnection.state, Vitest fake timers.
     * Data: a connection left in the Connecting state, then marked Connected.
     */
    it('selectMsel waits for the connection', async () => {
      const { service, hub } = await connect();
      vi.useFakeTimers();
      hub.state = signalR.HubConnectionState.Connecting;
      hub.invoke.mockClear();

      service.selectMsel('msel-1');
      vi.advanceTimersByTime(500);
      expect(hub.invoke).not.toHaveBeenCalled();

      hub.state = signalR.HubConnectionState.Connected;
      vi.advanceTimersByTime(500);
      expect(hub.invoke).toHaveBeenCalledWith('selectMsel', ['msel-1']);
    });

    /**
     * Verifies: re-joining after a reconnect re-selects the previously selected MSEL after 100 ms.
     * Interacts with: FakeHubConnection.reconnect(), SignalRService.join, Vitest fake timers.
     * Data: msel-1 selected, then a reconnect.
     */
    it('re-selects the MSEL after rejoining', async () => {
      const { service, hub } = await connect();
      service.selectMsel('msel-1');
      await flush();
      vi.useFakeTimers();
      hub.invoke.mockClear();

      hub.reconnect();
      expect(hub.invoke).toHaveBeenCalledWith('Join');
      expect(hub.invoke).not.toHaveBeenCalledWith('selectMsel', ['msel-1']);

      vi.advanceTimersByTime(100);
      expect(hub.invoke).toHaveBeenCalledWith('selectMsel', ['msel-1']);
    });
  });
});
