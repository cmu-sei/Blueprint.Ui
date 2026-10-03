// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  HttpEvent,
  HttpEventType,
  HttpResponse,
  HttpUploadProgressEvent,
} from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { EMPTY, Observable, of, throwError } from 'rxjs';
import { CiteAction, CiteActionService } from 'src/app/generated/blueprint.api';
import { CiteActionStore } from './cite-action.store';
import { CiteActionDataService } from './cite-action-data.service';
import { CiteActionQuery } from './cite-action.query';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { activatedRouteStub } from 'src/app/test-utils/activated-route';
import { recordEmissions } from 'src/app/test-utils/record-emissions';
import { captureUnhandledRxErrors, flush } from 'src/app/test-utils/unhandled-rx-errors';

function action(overrides: Partial<CiteAction> = {}): CiteAction {
  return {
    id: 'act-1',
    mselId: 'msel-1',
    teamId: 'team-red',
    moveNumber: 1,
    injectNumber: 1,
    actionNumber: 1,
    description: 'Isolate the host',
    isTemplate: false,
    ...overrides,
  };
}

function setup(queryParams: Record<string, string> = {}) {
  const citeActionApi = {
    getCiteActionTemplates: vi.fn(() => of<CiteAction[]>([])),
    getActionsByMsel: vi.fn(() => of<CiteAction[]>([])),
    getCiteAction: vi.fn(() => of<CiteAction>({})),
    createCiteAction: vi.fn(() => of<CiteAction>({})),
    updateCiteAction: vi.fn(() => of<CiteAction>({})),
    deleteCiteAction: vi.fn(() => of<unknown>(null)),
    downloadJsonCiteActions: vi.fn(() => of(new Blob())),
    uploadJsonCiteActions: vi.fn((): Observable<HttpEvent<CiteAction[]>> => EMPTY),
  } satisfies ApiStub<CiteActionService>;
  const navigate = vi.fn();
  const route = activatedRouteStub(queryParams);
  TestBed.configureTestingModule({
    providers: [
      { provide: CiteActionService, useValue: citeActionApi },
      { provide: Router, useValue: { navigate } satisfies Pick<Router, 'navigate'> },
      { provide: ActivatedRoute, useValue: route.route },
    ],
  });
  return {
    service: TestBed.inject(CiteActionDataService),
    query: TestBed.inject(CiteActionQuery),
    citeActionApi,
    navigate,
    route,
  };
}

const descriptions = (list: CiteAction[]) => list.map((a) => a.description);

describe('CiteActionDataService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: loadTemplates merges template actions into the store and loadByMsel replaces the store with the MSEL's actions.
   * Interacts with: CiteActionService.getCiteActionTemplates / getActionsByMsel (stubs), real CiteActionStore and CiteActionQuery.
   * Data: one template action, then two MSEL actions.
   */
  it('loadTemplates merges, loadByMsel replaces', () => {
    const { service, query, citeActionApi } = setup();
    citeActionApi.getCiteActionTemplates.mockReturnValue(
      of([action({ id: 'tmpl-1', description: 'Template action', isTemplate: true })]),
    );
    citeActionApi.getActionsByMsel.mockReturnValue(
      of([action(), action({ id: 'act-2', description: 'Notify legal' })]),
    );
    service.updateStore(action({ id: 'act-0', description: 'Existing' }));

    service.loadTemplates();
    expect(descriptions(query.getAll())).toEqual(['Existing', 'Template action']);

    service.loadByMsel('msel-1');
    expect(citeActionApi.getActionsByMsel).toHaveBeenCalledWith('msel-1');
    expect(descriptions(query.getAll())).toEqual(['Isolate the host', 'Notify legal']);
    expect(query.getValue().loading).toBe(false);
  });

  /**
   * Verifies: a failed loadByMsel empties the store and clears loading.
   * Interacts with: CiteActionService.getActionsByMsel (stub erroring), real CiteActionQuery.
   * Data: one stored action.
   */
  it('a failed loadByMsel empties the store', () => {
    const { service, query, citeActionApi } = setup();
    citeActionApi.getActionsByMsel.mockReturnValue(throwError(() => new Error('boom')));
    service.updateStore(action());

    service.loadByMsel('msel-1');

    expect(query.getAll()).toEqual([]);
    expect(query.getValue().loading).toBe(false);
  });

  /**
   * Verifies: loadById, add and updateCiteAction store what the API returns; delete removes after confirmation; unload clears.
   * Interacts with: CiteActionService getCiteAction / create / update / delete (stubs), real CiteActionQuery.
   * Data: act-2 fetched, act-3 created, act-2 updated by the API, act-3 deleted.
   */
  it('single-action calls keep the store in step with the API', () => {
    const { service, query, citeActionApi } = setup();
    citeActionApi.getCiteAction.mockReturnValue(of(action({ id: 'act-2', description: 'Notify legal' })));
    citeActionApi.createCiteAction.mockReturnValue(of(action({ id: 'act-3', description: 'Brief press' })));
    citeActionApi.updateCiteAction.mockReturnValue(
      of(action({ id: 'act-2', description: 'Notify legal counsel' })),
    );
    citeActionApi.deleteCiteAction.mockReturnValue(of(null));

    service.loadById('act-2');
    service.add(action({ id: undefined, description: 'Brief press' }));
    service.updateCiteAction(action({ id: 'act-2', description: 'edited' }));
    expect(citeActionApi.updateCiteAction).toHaveBeenCalledWith(
      'act-2',
      expect.objectContaining({ description: 'edited' }),
    );
    expect(descriptions(query.getAll())).toEqual(['Notify legal counsel', 'Brief press']);

    service.delete('act-3');
    expect(descriptions(query.getAll())).toEqual(['Notify legal counsel']);

    service.unload();
    expect(query.getAll()).toEqual([]);
  });

  /**
   * Verifies: uploadJson reports progress and upserts the imported actions, and a failure resets progress; downloadJson requests the given ids.
   * Interacts with: CiteActionService.uploadJsonCiteActions / downloadJsonCiteActions (stubs), uploadProgress subject, real CiteActionQuery.
   * Data: progress 3/4 and a 200 with one action, then a failure.
   */
  it('uploadJson imports actions with progress', () => {
    const { service, query, citeActionApi } = setup();
    const progress = recordEmissions(service.uploadProgress);
    citeActionApi.uploadJsonCiteActions.mockReturnValueOnce(
      of(
        { type: HttpEventType.UploadProgress, loaded: 3, total: 4 } satisfies HttpUploadProgressEvent,
        new HttpResponse({ status: 200, body: [action()] }),
      ),
    );
    citeActionApi.uploadJsonCiteActions.mockReturnValueOnce(throwError(() => new Error('bad')));

    service.uploadJson(new File(['[]'], 'actions.json'), 'events', true);
    service.uploadJson(new File(['[]'], 'actions.json'), 'events', true);

    expect(descriptions(query.getAll())).toEqual(['Isolate the host']);
    expect(progress).toEqual([75, 0, 0]);
    expect(query.getValue().loading).toBe(false);
    service.downloadJson(['act-1']);
    expect(citeActionApi.downloadJsonCiteActions).toHaveBeenCalledWith(['act-1']);
  });

  /**
   * Verifies: updateStore and deleteFromStore (the CiteAction SignalR targets) drive selectAll in insertion order (the name sort has no name to sort on).
   * Interacts with: real CiteActionStore through the service, CiteActionQuery.selectAll.
   * Data: add two actions, edit one, delete the other.
   */
  it('updateStore and deleteFromStore drive the query output', () => {
    const { service, query } = setup();
    const emissions = recordEmissions(query.selectAll());

    service.updateStore(action({ id: 'act-z', description: 'Zeta' }));
    service.updateStore(action({ id: 'act-a', description: 'Alpha' }));
    service.updateStore({ id: 'act-z', description: 'Zeta (edited)' });
    service.deleteFromStore('act-a');

    expect(emissions.map(descriptions)).toEqual([
      [],
      ['Zeta'],
      ['Zeta', 'Alpha'],
      ['Zeta (edited)', 'Alpha'],
      ['Zeta (edited)'],
    ]);
  });

  /**
   * Verifies: CiteActionList filters on the citeActionmask query param against description or id.
   * Interacts with: ActivatedRoute.queryParamMap (stub), real CiteActionQuery.
   * Data: "Isolate the host" and "Notify legal"; masks "legal" and "act-1".
   */
  it('CiteActionList filters on the citeActionmask query param', () => {
    const { service, route } = setup({ citeActionmask: 'legal' });
    service.updateStore(action());
    service.updateStore(action({ id: 'act-2', description: 'Notify legal' }));
    const emissions = recordEmissions(service.CiteActionList);

    expect(descriptions(emissions.at(-1))).toEqual(['Notify legal']);

    route.setQueryParams({ citeActionmask: 'act-1' });
    expect(descriptions(emissions.at(-1))).toEqual(['Isolate the host']);
  });

  /**
   * Verifies: a failed request leaves loading set for every method that sets it first (current behavior), and the ones with no error callback let the error escape.
   * Interacts with: CiteActionService endpoints (stubs failing), real CiteActionStore and CiteActionQuery, captureUnhandledRxErrors.
   * Data: loading cleared first; each endpoint fails with "request failed".
   */
  it.each([
    { method: 'loadTemplates', endpoint: 'getCiteActionTemplates', escapes: false, call: (s: CiteActionDataService) => s.loadTemplates() },
    { method: 'loadById', endpoint: 'getCiteAction', escapes: true, call: (s: CiteActionDataService) => s.loadById('x-1') },
    { method: 'add', endpoint: 'createCiteAction', escapes: true, call: (s: CiteActionDataService) => s.add({ id: 'x-1' }) },
    { method: 'updateCiteAction', endpoint: 'updateCiteAction', escapes: true, call: (s: CiteActionDataService) => s.updateCiteAction({ id: 'x-1' }) },
  ] as const)('$method leaves loading stuck when its request fails', async ({ endpoint, escapes, call }) => {
    const { service, citeActionApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    TestBed.inject(CiteActionStore).setLoading(false);
    citeActionApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    expect(TestBed.inject(CiteActionQuery).getValue().loading).toBe(true);
    // An empty error callback swallows the error; with no callback it escapes to
    // ErrorService, the ErrorHandler app.module.ts provides, which shows it.
    expect(errors).toEqual(escapes ? [failure] : []);
  });

  /**
   * Verifies: a failed request from delete escapes to the app's global ErrorHandler.
   * Interacts with: CiteActionService endpoints (stubs failing), captureUnhandledRxErrors.
   * Data: each endpoint fails with "request failed".
   */
  it.each([
    { method: 'delete', endpoint: 'deleteCiteAction', call: (s: CiteActionDataService) => s.delete('x-1') },
  ] as const)('$method lets a failed request reach the global ErrorHandler', async ({ endpoint, call }) => {
    const { service, citeActionApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    citeActionApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    // These methods subscribe with no error callback and set no loading flag,
    // so the error escapes to ErrorService, the ErrorHandler app.module.ts
    // provides, which shows it to the user. Not a defect on its own.
    expect(errors).toEqual([failure]);
  });
});
