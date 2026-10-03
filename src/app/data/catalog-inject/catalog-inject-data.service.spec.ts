// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, firstValueFrom, of, throwError } from 'rxjs';
import { CatalogInject, CatalogInjectService } from 'src/app/generated/blueprint.api';
import { CatalogDataService } from '../catalog/catalog-data.service';
import { CatalogInjectStore } from './catalog-inject.store';
import { CatalogInjectDataService } from './catalog-inject-data.service';
import { CatalogInjectQuery } from './catalog-inject.query';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { unstubbed } from 'src/app/test-utils/unstubbed';
import { activatedRouteStub } from 'src/app/test-utils/activated-route';
import { recordEmissions } from 'src/app/test-utils/record-emissions';
import { captureUnhandledRxErrors, flush } from 'src/app/test-utils/unhandled-rx-errors';

function link(overrides: Partial<CatalogInject> = {}): CatalogInject {
  return {
    id: 'ci-1',
    catalogId: 'cat-1',
    injectId: 'inj-1',
    isNew: false,
    displayOrder: 1,
    ...overrides,
  };
}

function setup(queryParams: Record<string, string> = {}) {
  const catalogInjectApi = {
    getCatalogInjects: vi.fn(() => of<CatalogInject[]>([])),
    getCatalogInject: vi.fn(() => of<CatalogInject>({})),
    createCatalogInject: vi.fn(() => of<CatalogInject>({})),
    createMultipleCatalogInjects: vi.fn(() => of<CatalogInject[]>([])),
    deleteCatalogInject: vi.fn(() => of<unknown>(null)),
    deleteCatalogInjectByIds: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<CatalogInjectService>;
  const route = activatedRouteStub(queryParams);
  TestBed.configureTestingModule({
    providers: [
      { provide: CatalogInjectService, useValue: catalogInjectApi },
      // Injected but never used by CatalogInjectDataService.
      unstubbed(CatalogDataService),
      { provide: Router, useValue: { navigate: vi.fn() } satisfies Pick<Router, 'navigate'> },
      { provide: ActivatedRoute, useValue: route.route },
    ],
  });
  return {
    service: TestBed.inject(CatalogInjectDataService),
    query: TestBed.inject(CatalogInjectQuery),
    catalogInjectApi,
  };
}

const injectIds = (list: CatalogInject[]) => list.map((ci) => ci.injectId);

describe('CatalogInjectDataService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: loadByCatalog replaces the store with the catalog's links, and empties it on failure.
   * Interacts with: CatalogInjectService.getCatalogInjects (stub), real CatalogInjectStore and CatalogInjectQuery.
   * Data: two links for cat-1, then a failure.
   */
  it('loadByCatalog replaces the links, or empties them on failure', () => {
    const { service, query, catalogInjectApi } = setup();
    catalogInjectApi.getCatalogInjects.mockReturnValueOnce(
      of([link(), link({ id: 'ci-2', injectId: 'inj-2' })]),
    );
    catalogInjectApi.getCatalogInjects.mockReturnValueOnce(throwError(() => new Error('boom')));

    service.loadByCatalog('cat-1');
    expect(catalogInjectApi.getCatalogInjects).toHaveBeenCalledWith('cat-1');
    expect(injectIds(query.getAll())).toEqual(['inj-1', 'inj-2']);

    service.loadByCatalog('cat-1');
    expect(query.getAll()).toEqual([]);
    expect(query.getValue().loading).toBe(false);
  });

  /**
   * Verifies: loadById, add and addMultiple store what the API returns.
   * Interacts with: CatalogInjectService getCatalogInject / createCatalogInject / createMultipleCatalogInjects (stubs), real CatalogInjectQuery.
   * Data: ci-2 fetched, ci-3 created, ci-4 and ci-5 created together.
   */
  it('loadById, add and addMultiple store the links', () => {
    const { service, query, catalogInjectApi } = setup();
    catalogInjectApi.getCatalogInject.mockReturnValue(of(link({ id: 'ci-2', injectId: 'inj-2' })));
    catalogInjectApi.createCatalogInject.mockReturnValue(of(link({ id: 'ci-3', injectId: 'inj-3' })));
    catalogInjectApi.createMultipleCatalogInjects.mockReturnValue(
      of([link({ id: 'ci-4', injectId: 'inj-4' }), link({ id: 'ci-5', injectId: 'inj-5' })]),
    );

    service.loadById('ci-2');
    service.add(link({ id: undefined, injectId: 'inj-3' }));
    service.addMultiple([link({ injectId: 'inj-4' }), link({ injectId: 'inj-5' })]);

    expect(injectIds(query.getAll())).toEqual(['inj-2', 'inj-3', 'inj-4', 'inj-5']);
    expect(query.getValue().loading).toBe(false);
  });

  /**
   * Verifies: delete and deleteByIds remove whatever id the API response carries, so the API's empty 204 body empties the whole store (current behavior).
   * Interacts with: CatalogInjectService.deleteCatalogInject / deleteCatalogInjectByIds (stubs), real CatalogInjectQuery.
   * Data: three links; the API answers the delete with no body (null), as its NoContent result does.
   */
  it.each([
    { method: 'delete', endpoint: 'deleteCatalogInject', args: ['ci-2'], call: (s: CatalogInjectDataService) => s.delete('ci-2') },
    { method: 'deleteByIds', endpoint: 'deleteCatalogInjectByIds', args: ['cat-1', 'inj-2'], call: (s: CatalogInjectDataService) => s.deleteByIds('cat-1', 'inj-2') },
  ] as const)('$method answered with no body empties the store', ({ endpoint, args, call }) => {
    const { service, query, catalogInjectApi } = setup();
    service.updateStore(link());
    service.updateStore(link({ id: 'ci-2', injectId: 'inj-2' }));
    service.updateStore(link({ id: 'ci-3', injectId: 'inj-3' }));
    catalogInjectApi[endpoint].mockReturnValue(of(null));

    call(service);

    expect(catalogInjectApi[endpoint]).toHaveBeenCalledWith(...args);
    expect(query.getAll()).toEqual([]);
  });

  /**
   * Verifies: a delete whose response carries the id removes only that link.
   * Interacts with: CatalogInjectService.deleteCatalogInject (stub), real CatalogInjectQuery.
   * Data: two links; the stub answers with "ci-1".
   */
  it('a delete answered with the id removes only that link', () => {
    const { service, query, catalogInjectApi } = setup();
    service.updateStore(link());
    service.updateStore(link({ id: 'ci-2', injectId: 'inj-2' }));
    catalogInjectApi.deleteCatalogInject.mockReturnValue(of('ci-1'));

    service.delete('ci-1');

    expect(injectIds(query.getAll())).toEqual(['inj-2']);
  });

  /**
   * Verifies: updateStore/deleteFromStore and setActive drive the queries; unload clears; CatalogInjectList filters on the id.
   * Interacts with: real CatalogInjectStore through the service, CatalogInjectQuery.selectAll / selectActive.
   * Data: two links, one activated and reordered, the other deleted.
   */
  it('updateStore, deleteFromStore and setActive drive the queries', async () => {
    const { service, query } = setup();
    const emissions = recordEmissions(query.selectAll());

    service.updateStore(link());
    service.updateStore(link({ id: 'ci-2', injectId: 'inj-2' }));
    service.setActive('ci-2');
    service.updateStore({ id: 'ci-2', displayOrder: 9 });
    service.deleteFromStore('ci-1');

    expect(emissions.at(-1).map((ci) => `${ci.injectId}#${ci.displayOrder}`)).toEqual([
      'inj-2#9',
    ]);
    const active$ = query.selectActive() as Observable<CatalogInject>;
    expect((await firstValueFrom(active$)).id).toBe('ci-2');

    service.unload();
    expect(query.getAll()).toEqual([]);
  });

  /**
   * Verifies: CatalogInjectList filters on the catalogInjectmask query param against the id.
   * Interacts with: ActivatedRoute.queryParamMap (stub), real CatalogInjectQuery.
   * Data: ci-1 and ci-2; mask "ci-2".
   */
  it('CatalogInjectList filters on the id', () => {
    const { service } = setup({ catalogInjectmask: 'ci-2' });
    service.updateStore(link());
    service.updateStore(link({ id: 'ci-2', injectId: 'inj-2' }));

    expect(injectIds(recordEmissions(service.CatalogInjectList).at(-1))).toEqual(['inj-2']);
  });

  /**
   * Verifies: a failed request leaves loading set for every method that sets it first (current behavior), and the ones with no error callback let the error escape.
   * Interacts with: CatalogInjectService endpoints (stubs failing), real CatalogInjectStore and CatalogInjectQuery, captureUnhandledRxErrors.
   * Data: loading cleared first; each endpoint fails with "request failed".
   */
  it.each([
    { method: 'loadById', endpoint: 'getCatalogInject', escapes: true, call: (s: CatalogInjectDataService) => s.loadById('x-1') },
    { method: 'add', endpoint: 'createCatalogInject', escapes: true, call: (s: CatalogInjectDataService) => s.add({ id: 'x-1' }) },
    { method: 'addMultiple', endpoint: 'createMultipleCatalogInjects', escapes: true, call: (s: CatalogInjectDataService) => s.addMultiple([{ id: 'x-1' }]) },
  ] as const)('$method leaves loading stuck when its request fails', async ({ endpoint, escapes, call }) => {
    const { service, catalogInjectApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    TestBed.inject(CatalogInjectStore).setLoading(false);
    catalogInjectApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    expect(TestBed.inject(CatalogInjectQuery).getValue().loading).toBe(true);
    // With no error callback the error escapes to ErrorService, the ErrorHandler
    // app.module.ts provides, which shows it.
    expect(errors).toEqual(escapes ? [failure] : []);
  });

  /**
   * Verifies: a failed request from delete, deleteByIds escapes to the app's global ErrorHandler.
   * Interacts with: CatalogInjectService endpoints (stubs failing), captureUnhandledRxErrors.
   * Data: each endpoint fails with "request failed".
   */
  it.each([
    { method: 'delete', endpoint: 'deleteCatalogInject', call: (s: CatalogInjectDataService) => s.delete('x-1') },
    { method: 'deleteByIds', endpoint: 'deleteCatalogInjectByIds', call: (s: CatalogInjectDataService) => s.deleteByIds('cat-1', 'inj-1') },
  ] as const)('$method lets a failed request reach the global ErrorHandler', async ({ endpoint, call }) => {
    const { service, catalogInjectApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    catalogInjectApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    // These methods subscribe with no error callback and set no loading flag,
    // so the error escapes to ErrorService, the ErrorHandler app.module.ts
    // provides, which shows it to the user. Not a defect on its own.
    expect(errors).toEqual([failure]);
  });
});
