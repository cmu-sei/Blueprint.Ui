// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, firstValueFrom, of, throwError } from 'rxjs';
import { CatalogUnit, CatalogUnitService, Unit } from 'src/app/generated/blueprint.api';
import { CatalogUnitStore } from './catalog-unit.store';
import { CatalogUnitDataService } from './catalog-unit-data.service';
import { CatalogUnitQuery } from './catalog-unit.query';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { activatedRouteStub } from 'src/app/test-utils/activated-route';
import { recordEmissions } from 'src/app/test-utils/record-emissions';
import { captureUnhandledRxErrors, flush } from 'src/app/test-utils/unhandled-rx-errors';

function link(overrides: Partial<CatalogUnit> = {}): CatalogUnit {
  return { id: 'cu-1', catalogId: 'cat-1', unitId: 'unit-red', ...overrides };
}

function setup(queryParams: Record<string, string> = {}) {
  const catalogUnitApi = {
    getCatalogUnits: vi.fn(() => of<CatalogUnit[]>([])),
    getCatalogUnit: vi.fn(() => of<CatalogUnit>({})),
    createCatalogUnit: vi.fn(() => of<CatalogUnit>({})),
    updateCatalogUnit: vi.fn(() => of<Unit>({})),
    deleteCatalogUnit: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<CatalogUnitService>;
  const route = activatedRouteStub(queryParams);
  TestBed.configureTestingModule({
    providers: [
      { provide: CatalogUnitService, useValue: catalogUnitApi },
      { provide: Router, useValue: { navigate: vi.fn() } satisfies Pick<Router, 'navigate'> },
      { provide: ActivatedRoute, useValue: route.route },
    ],
  });
  return {
    service: TestBed.inject(CatalogUnitDataService),
    query: TestBed.inject(CatalogUnitQuery),
    catalogUnitApi,
  };
}

const unitIds = (list: CatalogUnit[]) => list.map((cu) => cu.unitId);

describe('CatalogUnitDataService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: loadByCatalog replaces the store with the catalog's unit links, and empties it on failure.
   * Interacts with: CatalogUnitService.getCatalogUnits (stub), real CatalogUnitStore and CatalogUnitQuery.
   * Data: two links for cat-1, then a failure.
   */
  it('loadByCatalog replaces the links, or empties them on failure', () => {
    const { service, query, catalogUnitApi } = setup();
    catalogUnitApi.getCatalogUnits.mockReturnValueOnce(
      of([link(), link({ id: 'cu-2', unitId: 'unit-blue' })]),
    );
    catalogUnitApi.getCatalogUnits.mockReturnValueOnce(throwError(() => new Error('boom')));

    service.loadByCatalog('cat-1');
    expect(catalogUnitApi.getCatalogUnits).toHaveBeenCalledWith('cat-1');
    expect(unitIds(query.getAll())).toEqual(['unit-red', 'unit-blue']);

    service.loadByCatalog('cat-1');
    expect(query.getAll()).toEqual([]);
    expect(query.getValue().loading).toBe(false);
  });

  /**
   * Verifies: loadById, add and updateCatalogUnit store the API result; delete removes after confirmation; unload clears.
   * Interacts with: CatalogUnitService get / create / update / delete (stubs), real CatalogUnitQuery.
   * Data: cu-2 fetched, cu-3 created, cu-2 repointed, cu-3 deleted.
   */
  it('single-link calls keep the store in step with the API', () => {
    const { service, query, catalogUnitApi } = setup();
    catalogUnitApi.getCatalogUnit.mockReturnValue(of(link({ id: 'cu-2', unitId: 'unit-blue' })));
    catalogUnitApi.createCatalogUnit.mockReturnValue(of(link({ id: 'cu-3', unitId: 'unit-grn' })));
    catalogUnitApi.updateCatalogUnit.mockReturnValue(of(link({ id: 'cu-2', unitId: 'unit-gold' })));
    catalogUnitApi.deleteCatalogUnit.mockReturnValue(of(null));

    service.loadById('cu-2');
    service.add(link({ id: undefined, unitId: 'unit-grn' }));
    service.updateCatalogUnit(link({ id: 'cu-2', unitId: 'unit-gold' }));
    expect(catalogUnitApi.updateCatalogUnit).toHaveBeenCalledWith(
      'cu-2',
      expect.objectContaining({ unitId: 'unit-gold' }),
    );
    expect(unitIds(query.getAll())).toEqual(['unit-gold', 'unit-grn']);

    service.delete('cu-3');
    expect(unitIds(query.getAll())).toEqual(['unit-gold']);

    service.unload();
    expect(query.getAll()).toEqual([]);
  });

  /**
   * Verifies: updateStore/deleteFromStore and setActive drive the queries.
   * Interacts with: real CatalogUnitStore through the service, CatalogUnitQuery.selectAll / selectActive.
   * Data: two links; one activated, the other deleted.
   */
  it('updateStore, deleteFromStore and setActive drive the queries', async () => {
    const { service, query } = setup();
    const emissions = recordEmissions(query.selectAll());

    service.updateStore(link());
    service.updateStore(link({ id: 'cu-2', unitId: 'unit-blue' }));
    service.setActive('cu-2');
    service.deleteFromStore('cu-1');

    expect(emissions.map(unitIds)).toEqual([
      [],
      ['unit-red'],
      ['unit-red', 'unit-blue'],
      ['unit-blue'],
    ]);
    const active$ = query.selectActive() as Observable<CatalogUnit>;
    expect((await firstValueFrom(active$)).id).toBe('cu-2');
  });

  /**
   * Verifies: CatalogUnitList filters on the catalogUnitmask query param against the id.
   * Interacts with: ActivatedRoute.queryParamMap (stub), real CatalogUnitQuery.
   * Data: cu-1 and cu-2; mask "cu-2".
   */
  it('CatalogUnitList filters on the id', () => {
    const { service } = setup({ catalogUnitmask: 'cu-2' });
    service.updateStore(link());
    service.updateStore(link({ id: 'cu-2', unitId: 'unit-blue' }));

    expect(unitIds(recordEmissions(service.CatalogUnitList).at(-1))).toEqual(['unit-blue']);
  });

  /**
   * Verifies: a failed request leaves loading set for every method that sets it first (current behavior), and the ones with no error callback let the error escape.
   * Interacts with: CatalogUnitService endpoints (stubs failing), real CatalogUnitStore and CatalogUnitQuery, captureUnhandledRxErrors.
   * Data: loading cleared first; each endpoint fails with "request failed".
   */
  it.each([
    { method: 'loadById', endpoint: 'getCatalogUnit', escapes: true, call: (s: CatalogUnitDataService) => s.loadById('x-1') },
    { method: 'add', endpoint: 'createCatalogUnit', escapes: true, call: (s: CatalogUnitDataService) => s.add({ id: 'x-1' }) },
    { method: 'updateCatalogUnit', endpoint: 'updateCatalogUnit', escapes: true, call: (s: CatalogUnitDataService) => s.updateCatalogUnit({ id: 'x-1' }) },
  ] as const)('$method leaves loading stuck when its request fails', async ({ endpoint, escapes, call }) => {
    const { service, catalogUnitApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    TestBed.inject(CatalogUnitStore).setLoading(false);
    catalogUnitApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    expect(TestBed.inject(CatalogUnitQuery).getValue().loading).toBe(true);
    // With no error callback the error escapes to ErrorService, the ErrorHandler
    // app.module.ts provides, which shows it.
    expect(errors).toEqual(escapes ? [failure] : []);
  });

  /**
   * Verifies: a failed request from delete escapes to the app's global ErrorHandler.
   * Interacts with: CatalogUnitService endpoints (stubs failing), captureUnhandledRxErrors.
   * Data: each endpoint fails with "request failed".
   */
  it.each([
    { method: 'delete', endpoint: 'deleteCatalogUnit', call: (s: CatalogUnitDataService) => s.delete('x-1') },
  ] as const)('$method lets a failed request reach the global ErrorHandler', async ({ endpoint, call }) => {
    const { service, catalogUnitApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    catalogUnitApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    // These methods subscribe with no error callback and set no loading flag,
    // so the error escapes to ErrorService, the ErrorHandler app.module.ts
    // provides, which shows it to the user. Not a defect on its own.
    expect(errors).toEqual([failure]);
  });
});
