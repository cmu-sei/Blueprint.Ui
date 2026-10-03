// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, firstValueFrom, of, throwError } from 'rxjs';
import { MselUnit, MselUnitService, Unit } from 'src/app/generated/blueprint.api';
import { MselUnitStore } from './msel-unit.store';
import { MselUnitDataService } from './msel-unit-data.service';
import { MselUnitQuery } from './msel-unit.query';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { activatedRouteStub } from 'src/app/test-utils/activated-route';
import { recordEmissions } from 'src/app/test-utils/record-emissions';
import { captureUnhandledRxErrors, flush } from 'src/app/test-utils/unhandled-rx-errors';

function mselUnit(overrides: Partial<MselUnit> = {}): MselUnit {
  return { id: 'mu-1', mselId: 'msel-1', unitId: 'unit-red', ...overrides };
}

function setup(queryParams: Record<string, string> = {}) {
  const mselUnitApi = {
    getMselUnits: vi.fn(() => of<MselUnit[]>([])),
    getMselUnit: vi.fn(() => of(mselUnit())),
    createMselUnit: vi.fn(() => of(mselUnit())),
    updateMselUnit: vi.fn(() => of<Unit>({})),
    deleteMselUnit: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<MselUnitService>;
  const navigate = vi.fn();
  const route = activatedRouteStub(queryParams);
  TestBed.configureTestingModule({
    providers: [
      { provide: MselUnitService, useValue: mselUnitApi },
      { provide: Router, useValue: { navigate } satisfies Pick<Router, 'navigate'> },
      { provide: ActivatedRoute, useValue: route.route },
    ],
  });
  return {
    service: TestBed.inject(MselUnitDataService),
    query: TestBed.inject(MselUnitQuery),
    mselUnitApi,
  };
}

const unitIds = (list: MselUnit[]) => list.map((mu) => mu.unitId);

describe('MselUnitDataService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: loadByMsel replaces the store with the MSEL's unit links, and empties it on failure.
   * Interacts with: MselUnitService.getMselUnits (stub), real MselUnitStore and MselUnitQuery.
   * Data: two links, then a failure.
   */
  it('loadByMsel replaces the links, or empties them on failure', () => {
    const { service, query, mselUnitApi } = setup();
    mselUnitApi.getMselUnits.mockReturnValueOnce(
      of([mselUnit(), mselUnit({ id: 'mu-2', unitId: 'unit-blue' })]),
    );
    mselUnitApi.getMselUnits.mockReturnValueOnce(throwError(() => new Error('boom')));

    service.loadByMsel('msel-1');
    expect(mselUnitApi.getMselUnits).toHaveBeenCalledWith('msel-1');
    expect(unitIds(query.getAll())).toEqual(['unit-red', 'unit-blue']);

    service.loadByMsel('msel-1');
    expect(query.getAll()).toEqual([]);
    expect(query.getValue().loading).toBe(false);
  });

  /**
   * Verifies: loadById, add and updateMselUnit store the API result; delete removes after confirmation; unload clears.
   * Interacts with: MselUnitService get / create / update / delete (stubs), real MselUnitQuery.
   * Data: mu-2 fetched, mu-3 created, mu-2 repointed, mu-3 deleted.
   */
  it('single-link calls keep the store in step with the API', () => {
    const { service, query, mselUnitApi } = setup();
    mselUnitApi.getMselUnit.mockReturnValue(of(mselUnit({ id: 'mu-2', unitId: 'unit-blue' })));
    mselUnitApi.createMselUnit.mockReturnValue(of(mselUnit({ id: 'mu-3', unitId: 'unit-grn' })));
    mselUnitApi.updateMselUnit.mockReturnValue(of(mselUnit({ id: 'mu-2', unitId: 'unit-gold' })));
    mselUnitApi.deleteMselUnit.mockReturnValue(of(null));

    service.loadById('mu-2');
    service.add(mselUnit({ id: undefined, unitId: 'unit-grn' }));
    service.updateMselUnit(mselUnit({ id: 'mu-2', unitId: 'unit-gold' }));
    expect(mselUnitApi.updateMselUnit).toHaveBeenCalledWith(
      'mu-2',
      expect.objectContaining({ unitId: 'unit-gold' }),
    );
    expect(unitIds(query.getAll())).toEqual(['unit-gold', 'unit-grn']);

    service.delete('mu-3');
    expect(unitIds(query.getAll())).toEqual(['unit-gold']);

    service.unload();
    expect(query.getAll()).toEqual([]);
  });

  /**
   * Verifies: updateStore/deleteFromStore (the MselUnit SignalR targets) and setActive drive the queries.
   * Interacts with: real MselUnitStore through the service, MselUnitQuery.selectAll / selectActive.
   * Data: add two links, activate one, delete the other.
   */
  it('updateStore, deleteFromStore and setActive drive the queries', async () => {
    const { service, query } = setup();
    const emissions = recordEmissions(query.selectAll());

    service.updateStore(mselUnit());
    service.updateStore(mselUnit({ id: 'mu-2', unitId: 'unit-blue' }));
    service.setActive('mu-2');
    service.deleteFromStore('mu-1');

    expect(emissions.map(unitIds)).toEqual([
      [],
      ['unit-red'],
      ['unit-red', 'unit-blue'],
      ['unit-blue'],
    ]);
    const active$ = query.selectActive() as Observable<MselUnit>;
    expect((await firstValueFrom(active$)).id).toBe('mu-2');
  });

  /**
   * Verifies: MselUnitList filters on the mselUnitmask query param against the id.
   * Interacts with: ActivatedRoute.queryParamMap (stub), real MselUnitQuery.
   * Data: mu-1 and mu-2; mask "mu-2".
   */
  it('MselUnitList filters on the id', () => {
    const { service } = setup({ mselUnitmask: 'mu-2' });
    service.updateStore(mselUnit());
    service.updateStore(mselUnit({ id: 'mu-2', unitId: 'unit-blue' }));

    expect(unitIds(recordEmissions(service.MselUnitList).at(-1))).toEqual(['unit-blue']);
  });

  /**
   * Verifies: a failed request leaves loading set for every method that sets it first (current behavior), and the ones with no error callback let the error escape.
   * Interacts with: MselUnitService endpoints (stubs failing), real MselUnitStore and MselUnitQuery, captureUnhandledRxErrors.
   * Data: loading cleared first; each endpoint fails with "request failed".
   */
  it.each([
    { method: 'loadById', endpoint: 'getMselUnit', escapes: true, call: (s: MselUnitDataService) => s.loadById('x-1') },
    { method: 'add', endpoint: 'createMselUnit', escapes: true, call: (s: MselUnitDataService) => s.add({ id: 'x-1' }) },
    { method: 'updateMselUnit', endpoint: 'updateMselUnit', escapes: true, call: (s: MselUnitDataService) => s.updateMselUnit({ id: 'x-1' }) },
  ] as const)('$method leaves loading stuck when its request fails', async ({ endpoint, escapes, call }) => {
    const { service, mselUnitApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    TestBed.inject(MselUnitStore).setLoading(false);
    mselUnitApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    expect(TestBed.inject(MselUnitQuery).getValue().loading).toBe(true);
    // With no error callback the error escapes to ErrorService, the ErrorHandler
    // app.module.ts provides, which shows it.
    expect(errors).toEqual(escapes ? [failure] : []);
  });

  /**
   * Verifies: a failed request from delete escapes to the app's global ErrorHandler.
   * Interacts with: MselUnitService endpoints (stubs failing), captureUnhandledRxErrors.
   * Data: each endpoint fails with "request failed".
   */
  it.each([
    { method: 'delete', endpoint: 'deleteMselUnit', call: (s: MselUnitDataService) => s.delete('x-1') },
  ] as const)('$method lets a failed request reach the global ErrorHandler', async ({ endpoint, call }) => {
    const { service, mselUnitApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    mselUnitApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    // These methods subscribe with no error callback and set no loading flag,
    // so the error escapes to ErrorService, the ErrorHandler app.module.ts
    // provides, which shows it to the user. Not a defect on its own.
    expect(errors).toEqual([failure]);
  });
});
