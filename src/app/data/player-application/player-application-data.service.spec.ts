// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { PlayerApplication, PlayerApplicationService } from 'src/app/generated/blueprint.api';
import { PlayerApplicationStore } from './player-application.store';
import { PlayerApplicationDataService } from './player-application-data.service';
import { PlayerApplicationQuery } from './player-application.query';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { activatedRouteStub } from 'src/app/test-utils/activated-route';
import { recordEmissions } from 'src/app/test-utils/record-emissions';
import { captureUnhandledRxErrors, flush } from 'src/app/test-utils/unhandled-rx-errors';

function app(overrides: Partial<PlayerApplication> = {}): PlayerApplication {
  return {
    id: 'app-1',
    mselId: 'msel-1',
    name: 'Gallery',
    url: 'https://gallery.test',
    embeddable: true,
    loadInBackground: false,
    ...overrides,
  };
}

function setup(queryParams: Record<string, string> = {}) {
  const appApi = {
    getApplicationsByMsel: vi.fn(() => of<PlayerApplication[]>([])),
    getPlayerApplication: vi.fn(() => of<PlayerApplication>({})),
    createPlayerApplication: vi.fn(() => of<PlayerApplication>({})),
    createAndPushPlayerApplication: vi.fn(() => of<PlayerApplication>({})),
    updatePlayerApplication: vi.fn(() => of<PlayerApplication>({})),
    deletePlayerApplication: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<PlayerApplicationService>;
  const route = activatedRouteStub(queryParams);
  TestBed.configureTestingModule({
    providers: [
      { provide: PlayerApplicationService, useValue: appApi },
      { provide: Router, useValue: { navigate: vi.fn() } satisfies Pick<Router, 'navigate'> },
      { provide: ActivatedRoute, useValue: route.route },
    ],
  });
  return {
    service: TestBed.inject(PlayerApplicationDataService),
    query: TestBed.inject(PlayerApplicationQuery),
    appApi,
    route,
  };
}

const names = (list: PlayerApplication[]) => list.map((a) => a.name);

describe('PlayerApplicationDataService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: loadByMsel replaces the store with the MSEL's applications sorted by name, and empties it on failure.
   * Interacts with: PlayerApplicationService.getApplicationsByMsel (stub), real PlayerApplicationStore and Query.
   * Data: Gallery and CITE, then a failure.
   */
  it('loadByMsel replaces the applications, or empties them on failure', () => {
    const { service, query, appApi } = setup();
    appApi.getApplicationsByMsel.mockReturnValueOnce(of([app(), app({ id: 'app-2', name: 'CITE' })]));
    appApi.getApplicationsByMsel.mockReturnValueOnce(throwError(() => new Error('boom')));

    service.loadByMsel('msel-1');
    expect(appApi.getApplicationsByMsel).toHaveBeenCalledWith('msel-1');
    expect(names(query.getAll())).toEqual(['CITE', 'Gallery']);

    service.loadByMsel('msel-1');
    expect(query.getAll()).toEqual([]);
    expect(query.getValue().loading).toBe(false);
  });

  /**
   * Verifies: loadById, add and updatePlayerApplication store the API result; addAndPush returns the API observable without storing; delete removes after confirmation.
   * Interacts with: PlayerApplicationService endpoints (stubs), real PlayerApplicationQuery.
   * Data: app-2 fetched, app-3 created, app-2 renamed, a pushed app, app-3 deleted.
   */
  it('single-application calls keep the store in step with the API', () => {
    const { service, query, appApi } = setup();
    appApi.getPlayerApplication.mockReturnValue(of(app({ id: 'app-2', name: 'CITE' })));
    appApi.createPlayerApplication.mockReturnValue(of(app({ id: 'app-3', name: 'Steamfitter' })));
    appApi.updatePlayerApplication.mockReturnValue(of(app({ id: 'app-2', name: 'CITE Scoring' })));
    appApi.deletePlayerApplication.mockReturnValue(of(null));
    const pushed$ = of(app({ id: 'app-pushed' }));
    appApi.createAndPushPlayerApplication.mockReturnValue(pushed$);

    service.loadById('app-2');
    service.add(app({ id: undefined, name: 'Steamfitter' }));
    service.updatePlayerApplication(app({ id: 'app-2', name: 'edited' }));
    expect(names(query.getAll())).toEqual(['CITE Scoring', 'Steamfitter']);

    expect(service.addAndPush(app({ id: undefined }))).toBe(pushed$);
    expect(query.getAll()).toHaveLength(2);

    service.delete('app-3');
    expect(names(query.getAll())).toEqual(['CITE Scoring']);

    service.unload();
    expect(query.getAll()).toEqual([]);
  });

  /**
   * Verifies: updateStore and deleteFromStore (the PlayerApplication SignalR targets) drive selectAll; PlayerApplicationList filters on name or id.
   * Interacts with: real PlayerApplicationStore through the service, PlayerApplicationQuery.selectAll, ActivatedRoute (stub).
   * Data: Gallery and CITE; mask "cite", then "app-1"; then Gallery deleted.
   */
  it('updateStore, deleteFromStore and the list stream follow the store', () => {
    const { service, query, route } = setup({ playerApplicationmask: 'cite' });
    service.updateStore(app());
    service.updateStore(app({ id: 'app-2', name: 'CITE' }));
    const list = recordEmissions(service.PlayerApplicationList);

    expect(names(list.at(-1))).toEqual(['CITE']);
    route.setQueryParams({ playerApplicationmask: 'app-1' });
    expect(names(list.at(-1))).toEqual(['Gallery']);

    service.deleteFromStore('app-1');
    expect(names(query.getAll())).toEqual(['CITE']);
  });

  /**
   * Verifies: a failed request leaves loading set for every method that sets it first (current behavior), and the ones with no error callback let the error escape.
   * Interacts with: PlayerApplicationService endpoints (stubs failing), real PlayerApplicationStore and PlayerApplicationQuery, captureUnhandledRxErrors.
   * Data: loading cleared first; each endpoint fails with "request failed".
   */
  it.each([
    { method: 'loadById', endpoint: 'getPlayerApplication', escapes: true, call: (s: PlayerApplicationDataService) => s.loadById('x-1') },
    { method: 'add', endpoint: 'createPlayerApplication', escapes: true, call: (s: PlayerApplicationDataService) => s.add({ id: 'x-1' }) },
    { method: 'updatePlayerApplication', endpoint: 'updatePlayerApplication', escapes: true, call: (s: PlayerApplicationDataService) => s.updatePlayerApplication({ id: 'x-1' }) },
  ] as const)('$method leaves loading stuck when its request fails', async ({ endpoint, escapes, call }) => {
    const { service, appApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    TestBed.inject(PlayerApplicationStore).setLoading(false);
    appApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    expect(TestBed.inject(PlayerApplicationQuery).getValue().loading).toBe(true);
    // With no error callback the error escapes to ErrorService, the ErrorHandler
    // app.module.ts provides, which shows it.
    expect(errors).toEqual(escapes ? [failure] : []);
  });

  /**
   * Verifies: a failed request from delete escapes to the app's global ErrorHandler.
   * Interacts with: PlayerApplicationService endpoints (stubs failing), captureUnhandledRxErrors.
   * Data: each endpoint fails with "request failed".
   */
  it.each([
    { method: 'delete', endpoint: 'deletePlayerApplication', call: (s: PlayerApplicationDataService) => s.delete('x-1') },
  ] as const)('$method lets a failed request reach the global ErrorHandler', async ({ endpoint, call }) => {
    const { service, appApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    appApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    // These methods subscribe with no error callback and set no loading flag,
    // so the error escapes to ErrorService, the ErrorHandler app.module.ts
    // provides, which shows it to the user. Not a defect on its own.
    expect(errors).toEqual([failure]);
  });
});
