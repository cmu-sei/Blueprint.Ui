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
import { Unit, UnitService } from 'src/app/generated/blueprint.api';
import { UnitStore } from './unit.store';
import { UnitDataService } from './unit-data.service';
import { UnitQuery } from './unit.query';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { activatedRouteStub } from 'src/app/test-utils/activated-route';
import { recordEmissions } from 'src/app/test-utils/record-emissions';
import { captureUnhandledRxErrors, flush } from 'src/app/test-utils/unhandled-rx-errors';

function unit(overrides: Partial<Unit> = {}): Unit {
  return { id: 'id-red', name: 'Red Cell', shortName: 'RED', ...overrides };
}

function setup(queryParams: Record<string, string> = {}) {
  const unitApi = {
    getUnits: vi.fn(() => of<Unit[]>([])),
    getUnit: vi.fn(() => of(unit())),
    getUnitsByUser: vi.fn(() => of<Unit[]>([])),
    getMyUnits: vi.fn(() => of<Unit[]>([])),
    createUnit: vi.fn(() => of(unit())),
    updateUnit: vi.fn(() => of(unit())),
    deleteUnit: vi.fn(() => of<unknown>(null)),
    downloadJsonUnits: vi.fn(() => of(new Blob())),
    uploadJsonUnits: vi.fn((): Observable<HttpEvent<Unit[]>> => EMPTY),
  } satisfies ApiStub<UnitService>;
  const navigate = vi.fn();
  const route = activatedRouteStub(queryParams);
  TestBed.configureTestingModule({
    providers: [
      { provide: UnitService, useValue: unitApi },
      { provide: Router, useValue: { navigate } satisfies Pick<Router, 'navigate'> },
      { provide: ActivatedRoute, useValue: route.route },
    ],
  });
  return {
    service: TestBed.inject(UnitDataService),
    query: TestBed.inject(UnitQuery),
    unitApi,
    navigate,
    route,
  };
}

const names = (list: Unit[]) => list.map((u) => u.name);

describe('UnitDataService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: load, loadMine and loadByUserId each replace the store with their endpoint's units, and empty it on failure.
   * Interacts with: UnitService getUnits / getMyUnits / getUnitsByUser (stubs), real UnitStore and UnitQuery.
   * Data: a different unit from each endpoint, then a failure from each.
   */
  it('loaders replace the units, or empty them on failure', () => {
    const { service, query, unitApi } = setup();
    unitApi.getUnits.mockReturnValueOnce(of([unit(), unit({ id: 'id-blue', name: 'Blue Team' })]));
    unitApi.getMyUnits.mockReturnValueOnce(of([unit({ id: 'id-mine', name: 'My Unit' })]));
    unitApi.getUnitsByUser.mockReturnValueOnce(of([unit({ id: 'id-user', name: 'User Unit' })]));

    service.load();
    expect(names(query.getAll())).toEqual(['Blue Team', 'Red Cell']);
    service.loadMine();
    expect(names(query.getAll())).toEqual(['My Unit']);
    service.loadByUserId('user-1');
    expect(unitApi.getUnitsByUser).toHaveBeenCalledWith('user-1');
    expect(names(query.getAll())).toEqual(['User Unit']);

    const fail = () => throwError(() => new Error('boom'));
    unitApi.getUnits.mockImplementation(fail);
    unitApi.getMyUnits.mockImplementation(fail);
    unitApi.getUnitsByUser.mockImplementation(fail);
    for (const loader of [
      () => service.load(),
      () => service.loadMine(),
      () => service.loadByUserId('user-1'),
    ]) {
      service.updateStore(unit());
      loader();
      expect(query.getAll()).toEqual([]);
    }
    expect(query.getValue().loading).toBe(false);
  });

  /**
   * Verifies: loadById and add store the unit and make it active; updateUnit stores the API result; delete and unload clear the active unit.
   * Interacts with: UnitService getUnit / createUnit / updateUnit / deleteUnit (stubs), real UnitQuery.
   * Data: id-blue fetched, id-grn created, id-blue renamed, id-grn deleted.
   */
  it('single-unit calls keep the store and active unit in step', () => {
    const { service, query, unitApi } = setup();
    unitApi.getUnit.mockReturnValue(of(unit({ id: 'id-blue', name: 'Blue Team' })));
    unitApi.createUnit.mockReturnValue(of(unit({ id: 'id-grn', name: 'Green Team' })));
    unitApi.updateUnit.mockReturnValue(of(unit({ id: 'id-blue', name: 'Blue Cell' })));
    unitApi.deleteUnit.mockReturnValue(of(null));

    service.loadById('id-blue');
    expect(query.getActiveId()).toBe('id-blue');
    service.add(unit({ id: undefined, name: 'Green Team' }));
    expect(query.getActiveId()).toBe('id-grn');
    service.updateUnit(unit({ id: 'id-blue', name: 'edited' }));
    expect(unitApi.updateUnit).toHaveBeenCalledWith(
      'id-blue',
      expect.objectContaining({ name: 'edited' }),
    );
    expect(names(query.getAll())).toEqual(['Blue Cell', 'Green Team']);

    service.delete('id-grn');
    expect(names(query.getAll())).toEqual(['Blue Cell']);
    expect(query.getActiveId()).toBe('');

    service.setActive('id-blue');
    service.unload();
    expect(query.getAll()).toEqual([]);
    expect(query.getActiveId()).toBe('');
  });

  /**
   * Verifies: uploadJson imports units with progress and resets progress on failure; downloadJson requests the given ids.
   * Interacts with: UnitService.uploadJsonUnits / downloadJsonUnits (stubs), uploadProgress subject, real UnitQuery.
   * Data: progress 1/2 and a 200 with two units, then a failure.
   */
  it('uploadJson imports units with progress', () => {
    const { service, query, unitApi } = setup();
    const progress = recordEmissions(service.uploadProgress);
    unitApi.uploadJsonUnits.mockReturnValueOnce(
      of(
        { type: HttpEventType.UploadProgress, loaded: 1, total: 2 } satisfies HttpUploadProgressEvent,
        new HttpResponse({ status: 200, body: [unit(), unit({ id: 'id-blue', name: 'Blue Team' })] }),
      ),
    );
    unitApi.uploadJsonUnits.mockReturnValueOnce(throwError(() => new Error('bad')));

    service.uploadJson(new File(['[]'], 'units.json'), 'events', true);
    service.uploadJson(new File(['[]'], 'units.json'), 'events', true);

    expect(names(query.getAll())).toEqual(['Blue Team', 'Red Cell']);
    expect(progress).toEqual([50, 0, 0]);
    expect(query.getValue().loading).toBe(false);
    service.downloadJson(['id-red']);
    expect(unitApi.downloadJsonUnits).toHaveBeenCalledWith(['id-red']);
  });

  /**
   * Verifies: updateStore and deleteFromStore (the Unit SignalR targets) drive selectAll, sorted by name.
   * Interacts with: real UnitStore through the service, UnitQuery.selectAll.
   * Data: add two units, rename one, delete the other.
   */
  it('updateStore and deleteFromStore drive the query output', () => {
    const { service, query } = setup();
    const emissions = recordEmissions(query.selectAll());

    service.updateStore(unit());
    service.updateStore(unit({ id: 'id-blue', name: 'Blue Team' }));
    service.updateStore({ id: 'id-blue', name: 'Yankee' });
    service.deleteFromStore('id-red');

    expect(emissions.map(names)).toEqual([
      [],
      ['Red Cell'],
      ['Blue Team', 'Red Cell'],
      ['Red Cell', 'Yankee'],
      ['Yankee'],
    ]);
  });

  /**
   * Verifies: unitList filters on the filter query param across name, short name and id, and honours sorton/sortdir.
   * Interacts with: ActivatedRoute.queryParamMap (stub), real UnitQuery.
   * Data: Red Cell/RED, Blue Team/BLUE, Green Team/GRN.
   */
  it('unitList filters and sorts from the query params', () => {
    const { service, route } = setup();
    service.updateStore(unit());
    service.updateStore(unit({ id: 'id-blue', name: 'Blue Team', shortName: 'BLUE' }));
    service.updateStore(unit({ id: 'id-grn', name: 'Green Team', shortName: 'GRN' }));
    const emissions = recordEmissions(service.unitList);

    route.setQueryParams({ filter: 'team' });
    expect(names(emissions.at(-1))).toEqual(['Blue Team', 'Green Team']);
    route.setQueryParams({ filter: 'grn' });
    expect(names(emissions.at(-1))).toEqual(['Green Team']);
    route.setQueryParams({ filter: 'id-r' });
    expect(names(emissions.at(-1))).toEqual(['Red Cell']);
    route.setQueryParams({ sorton: 'shortName', sortdir: 'desc' });
    expect(names(emissions.at(-1))).toEqual(['Red Cell', 'Green Team', 'Blue Team']);
  });

  /**
   * Verifies: a failed request leaves loading set for every method that sets it first (current behavior), and the ones with no error callback let the error escape.
   * Interacts with: UnitService endpoints (stubs failing), real UnitStore and UnitQuery, captureUnhandledRxErrors.
   * Data: loading cleared first; each endpoint fails with "request failed".
   */
  it.each([
    { method: 'loadById', endpoint: 'getUnit', escapes: true, call: (s: UnitDataService) => s.loadById('x-1') },
    { method: 'add', endpoint: 'createUnit', escapes: true, call: (s: UnitDataService) => s.add({ id: 'x-1' }) },
    { method: 'updateUnit', endpoint: 'updateUnit', escapes: true, call: (s: UnitDataService) => s.updateUnit({ id: 'x-1' }) },
  ] as const)('$method leaves loading stuck when its request fails', async ({ endpoint, escapes, call }) => {
    const { service, unitApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    TestBed.inject(UnitStore).setLoading(false);
    unitApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    expect(TestBed.inject(UnitQuery).getValue().loading).toBe(true);
    // With no error callback the error escapes to ErrorService, the ErrorHandler
    // app.module.ts provides, which shows it.
    expect(errors).toEqual(escapes ? [failure] : []);
  });

  /**
   * Verifies: a failed request from delete escapes to the app's global ErrorHandler.
   * Interacts with: UnitService endpoints (stubs failing), captureUnhandledRxErrors.
   * Data: each endpoint fails with "request failed".
   */
  it.each([
    { method: 'delete', endpoint: 'deleteUnit', call: (s: UnitDataService) => s.delete('x-1') },
  ] as const)('$method lets a failed request reach the global ErrorHandler', async ({ endpoint, call }) => {
    const { service, unitApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    unitApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    // These methods subscribe with no error callback and set no loading flag,
    // so the error escapes to ErrorService, the ErrorHandler app.module.ts
    // provides, which shows it to the user. Not a defect on its own.
    expect(errors).toEqual([failure]);
  });
});
