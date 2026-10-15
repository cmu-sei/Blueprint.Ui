// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, firstValueFrom, of, throwError } from 'rxjs';
import { Injectm, InjectService } from 'src/app/generated/blueprint.api';
import { InjectmStore } from './injectm.store';
import { InjectmDataService } from './injectm-data.service';
import { InjectmQuery } from './injectm.query';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { activatedRouteStub } from 'src/app/test-utils/activated-route';
import { recordEmissions } from 'src/app/test-utils/record-emissions';
import { captureUnhandledRxErrors, flush } from 'src/app/test-utils/unhandled-rx-errors';

function inject(overrides: Partial<Injectm> = {}): Injectm {
  return {
    id: 'inj-1',
    name: 'Ransom note',
    description: 'A ransom note arrives',
    injectTypeId: 'it-email',
    dateCreated: '2026-01-01T00:00:00Z' as unknown as Date,
    dateModified: '2026-01-02T00:00:00Z' as unknown as Date,
    ...overrides,
  };
}

function setup(queryParams: Record<string, string> = {}) {
  const injectApi = {
    getInjectsByCatalog: vi.fn(() => of<Injectm[]>([])),
    getInjectsByInjectType: vi.fn(() => of<Injectm[]>([])),
    getInject: vi.fn(() => of<Injectm>({})),
    createInject: vi.fn(() => of<Injectm>({})),
    updateInject: vi.fn(() => of<Injectm>({})),
    deleteInject: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<InjectService>;
  const navigate = vi.fn();
  const route = activatedRouteStub(queryParams);
  TestBed.configureTestingModule({
    providers: [
      { provide: InjectService, useValue: injectApi },
      { provide: Router, useValue: { navigate } satisfies Pick<Router, 'navigate'> },
      { provide: ActivatedRoute, useValue: route.route },
    ],
  });
  return {
    service: TestBed.inject(InjectmDataService),
    query: TestBed.inject(InjectmQuery),
    injectApi,
    navigate,
    route,
  };
}

const names = (list: Injectm[]) => list.map((i) => i.name);

describe('InjectmDataService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: loadByCatalog and loadByInjectType each replace the store, parse the dates, and empty the store on failure.
   * Interacts with: InjectService.getInjectsByCatalog / getInjectsByInjectType (stubs), real InjectmStore and InjectmQuery.
   * Data: catalog injects, inject-type injects, then a failure from each.
   */
  it('loaders replace the injects and parse their dates', () => {
    const { service, query, injectApi } = setup();
    injectApi.getInjectsByCatalog.mockReturnValueOnce(
      of([inject(), inject({ id: 'inj-2', name: 'Bomb threat' })]),
    );
    injectApi.getInjectsByInjectType.mockReturnValueOnce(
      of([inject({ id: 'inj-3', name: 'Press call' })]),
    );
    injectApi.getInjectsByCatalog.mockReturnValueOnce(throwError(() => new Error('boom')));
    injectApi.getInjectsByInjectType.mockReturnValueOnce(throwError(() => new Error('boom')));

    service.loadByCatalog('cat-1');
    expect(injectApi.getInjectsByCatalog).toHaveBeenCalledWith('cat-1');
    expect(names(query.getAll())).toEqual(['Bomb threat', 'Ransom note']);
    expect(query.getEntity('inj-1').dateCreated).toEqual(new Date('2026-01-01T00:00:00Z'));

    service.loadByInjectType('it-email');
    expect(injectApi.getInjectsByInjectType).toHaveBeenCalledWith('it-email');
    expect(names(query.getAll())).toEqual(['Press call']);

    service.loadByCatalog('cat-1');
    expect(query.getAll()).toEqual([]);
    service.updateStore(inject());
    service.loadByInjectType('it-email');
    expect(query.getAll()).toEqual([]);
    expect(query.getValue().loading).toBe(false);
  });

  /**
   * Verifies: loadById, add (into a catalog) and update store the API result with parsed dates; delete removes after confirmation.
   * Interacts with: InjectService getInject / createInject / updateInject / deleteInject (stubs), real InjectmQuery.
   * Data: inj-2 fetched, inj-3 created in cat-1, inj-2 renamed, inj-3 deleted.
   */
  it('single-inject calls keep the store in step with the API', async () => {
    const { service, query, injectApi } = setup();
    injectApi.getInject.mockReturnValue(of(inject({ id: 'inj-2', name: 'Bomb threat' })));
    injectApi.createInject.mockReturnValue(of(inject({ id: 'inj-3', name: 'Press call' })));
    injectApi.updateInject.mockReturnValue(of(inject({ id: 'inj-2', name: 'Bomb threat (v2)' })));
    injectApi.deleteInject.mockReturnValue(of(null));

    service.loadById('inj-2');
    service.add('cat-1', inject({ id: undefined, name: 'Press call' }));
    expect(injectApi.createInject).toHaveBeenCalledWith(
      'cat-1',
      expect.objectContaining({ name: 'Press call' }),
    );
    service.update(inject({ id: 'inj-2', name: 'edited' }));
    expect(names(query.getAll())).toEqual(['Bomb threat (v2)', 'Press call']);
    expect(query.getEntity('inj-3').dateModified).toBeInstanceOf(Date);

    service.delete('inj-3');
    expect(names(query.getAll())).toEqual(['Bomb threat (v2)']);
    expect((await firstValueFrom(query.selectById('inj-2'))).id).toBe('inj-2');

    service.unload();
    expect(query.getAll()).toEqual([]);
  });

  /**
   * Verifies: updateStore/deleteFromStore (the Inject SignalR targets) and setActive drive the queries.
   * Interacts with: real InjectmStore through the service, InjectmQuery.selectAll and selectActive.
   * Data: add two injects, activate one, rename it, delete the other.
   */
  it('updateStore, deleteFromStore and setActive drive the queries', async () => {
    const { service, query } = setup();
    const emissions = recordEmissions(query.selectAll());

    service.updateStore(inject());
    service.updateStore(inject({ id: 'inj-2', name: 'Bomb threat' }));
    service.setActive('inj-1');
    service.updateStore({ id: 'inj-1', name: 'Ransom note (edited)' });
    service.deleteFromStore('inj-2');

    expect(emissions.at(-1).map((i) => i.name)).toEqual(['Ransom note (edited)']);
    const active$ = query.selectActive() as Observable<Injectm>;
    expect((await firstValueFrom(active$)).name).toBe('Ransom note (edited)');
  });

  /**
   * Verifies: InjectmList filters on the injectmmask query param against the id.
   * Interacts with: ActivatedRoute.queryParamMap (stub), real InjectmQuery.
   * Data: inj-1 and inj-2; mask "inj-2".
   */
  it('InjectmList filters on the id', () => {
    const { service } = setup({ injectmmask: 'inj-2' });
    service.updateStore(inject());
    service.updateStore(inject({ id: 'inj-2', name: 'Bomb threat' }));

    expect(names(recordEmissions(service.InjectmList).at(-1))).toEqual(['Bomb threat']);
  });

  /**
   * Verifies: a failed request leaves loading set for every method that sets it first (current behavior), and the ones with no error callback let the error escape.
   * Interacts with: InjectService endpoints (stubs failing), real InjectmStore and InjectmQuery, captureUnhandledRxErrors.
   * Data: loading cleared first; each endpoint fails with "request failed".
   */
  it.each([
    { method: 'loadById', endpoint: 'getInject', escapes: true, call: (s: InjectmDataService) => s.loadById('x-1') },
    { method: 'add', endpoint: 'createInject', escapes: true, call: (s: InjectmDataService) => s.add('cat-1', { id: 'x-1' }) },
    { method: 'update', endpoint: 'updateInject', escapes: true, call: (s: InjectmDataService) => s.update({ id: 'x-1' }) },
  ] as const)('$method leaves loading stuck when its request fails', async ({ endpoint, escapes, call }) => {
    const { service, injectApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    TestBed.inject(InjectmStore).setLoading(false);
    injectApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    expect(TestBed.inject(InjectmQuery).getValue().loading).toBe(true);
    // With no error callback the error escapes to ErrorService, the ErrorHandler
    // app.module.ts provides, which shows it.
    expect(errors).toEqual(escapes ? [failure] : []);
  });

  /**
   * Verifies: a failed request from delete escapes to the app's global ErrorHandler.
   * Interacts with: InjectService endpoints (stubs failing), captureUnhandledRxErrors.
   * Data: each endpoint fails with "request failed".
   */
  it.each([
    { method: 'delete', endpoint: 'deleteInject', call: (s: InjectmDataService) => s.delete('x-1') },
  ] as const)('$method lets a failed request reach the global ErrorHandler', async ({ endpoint, call }) => {
    const { service, injectApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    injectApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    // These methods subscribe with no error callback and set no loading flag,
    // so the error escapes to ErrorService, the ErrorHandler app.module.ts
    // provides, which shows it to the user. Not a defect on its own.
    expect(errors).toEqual([failure]);
  });
});
