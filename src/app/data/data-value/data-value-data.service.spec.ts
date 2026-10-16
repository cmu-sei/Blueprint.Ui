// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { DataValue, DataValueService } from 'src/app/generated/blueprint.api';
import { MselDataService } from '../msel/msel-data.service';
import { DataValueStore } from './data-value.store';
import { DataValueDataService } from './data-value-data.service';
import { DataValueQuery } from './data-value.query';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { unstubbed } from 'src/app/test-utils/unstubbed';
import { getDefaultProviders } from 'src/app/test-utils/default-test-providers';
import { recordEmissions } from 'src/app/test-utils/record-emissions';
import { captureUnhandledRxErrors, flush } from 'src/app/test-utils/unhandled-rx-errors';

function value(overrides: Partial<DataValue> = {}): DataValue {
  return {
    id: 'dv-1',
    scenarioEventId: 'se-1',
    dataFieldId: 'df-title',
    value: 'Phishing email',
    ...overrides,
  };
}

function setup() {
  const dataValueApi = {
    getDataValuesByMsel: vi.fn(() => of<DataValue[]>([])),
    getDataValue: vi.fn(() => of<DataValue>({})),
    createDataValue: vi.fn(() => of<DataValue>({})),
    updateDataValue: vi.fn(() => of<DataValue>({})),
    deleteDataValue: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<DataValueService>;
  TestBed.configureTestingModule({
    providers: getDefaultProviders([
      { provide: DataValueService, useValue: dataValueApi },
      // Injected but never used by DataValueDataService.
      unstubbed(MselDataService),
    ]),
  });
  return {
    service: TestBed.inject(DataValueDataService),
    query: TestBed.inject(DataValueQuery),
    dataValueApi,
  };
}

const values = (list: DataValue[]) => list.map((dv) => dv.value);

describe('DataValueDataService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: loadByMsel replaces the store with the MSEL's values, and empties it when the API fails.
   * Interacts with: DataValueService.getDataValuesByMsel (stub), real DataValueStore and DataValueQuery.
   * Data: two values, then an API error.
   */
  it('loadByMsel replaces the values, or empties them on failure', () => {
    const { service, query, dataValueApi } = setup();
    dataValueApi.getDataValuesByMsel.mockReturnValueOnce(
      of([value(), value({ id: 'dv-2', value: 'RED' })]),
    );
    dataValueApi.getDataValuesByMsel.mockReturnValueOnce(throwError(() => new Error('boom')));

    service.loadByMsel('msel-1');
    expect(dataValueApi.getDataValuesByMsel).toHaveBeenCalledWith('msel-1');
    expect(values(query.getAll())).toEqual(['Phishing email', 'RED']);

    service.loadByMsel('msel-1');
    expect(query.getAll()).toEqual([]);
    expect(query.getValue().loading).toBe(false);
  });

  /**
   * Verifies: loadById, add and updateDataValue upsert what the API returns; delete removes after confirmation; unload clears.
   * Interacts with: DataValueService getDataValue / create / update / delete (stubs), real DataValueQuery.
   * Data: dv-2 fetched, dv-3 created, dv-2 edited by the API, dv-3 deleted.
   */
  it('single-value calls keep the store in step with the API', async () => {
    const { service, query, dataValueApi } = setup();
    dataValueApi.getDataValue.mockReturnValue(of(value({ id: 'dv-2', value: 'RED' })));
    dataValueApi.createDataValue.mockReturnValue(of(value({ id: 'dv-3', value: 'High' })));
    dataValueApi.updateDataValue.mockReturnValue(of(value({ id: 'dv-2', value: 'BLUE' })));
    dataValueApi.deleteDataValue.mockReturnValue(of(null));

    service.loadById('dv-2');
    service.add(value({ id: undefined, value: 'High' }));
    service.updateDataValue(value({ id: 'dv-2', value: 'edited' }));
    expect(dataValueApi.updateDataValue).toHaveBeenCalledWith(
      'dv-2',
      expect.objectContaining({ value: 'edited' }),
    );
    expect(values(query.getAll())).toEqual(['BLUE', 'High']);
    expect((await firstValueFrom(query.selectById('dv-2'))).value).toBe('BLUE');

    service.delete('dv-3');
    expect(values(query.getAll())).toEqual(['BLUE']);

    service.unload();
    expect(query.getAll()).toEqual([]);
  });

  /**
   * Verifies: updateStore and deleteFromStore (the DataValue SignalR targets) drive selectAll.
   * Interacts with: real DataValueStore through the service, DataValueQuery.selectAll.
   * Data: add a value, edit it, delete it.
   */
  it('updateStore and deleteFromStore drive the query output', () => {
    const { service, query } = setup();
    const emissions = recordEmissions(query.selectAll());

    service.updateStore(value());
    service.updateStore({ id: 'dv-1', value: 'Spear phishing' });
    service.deleteFromStore('dv-1');

    expect(emissions.map(values)).toEqual([
      [],
      ['Phishing email'],
      ['Spear phishing'],
      [],
    ]);
    expect(emissions[2][0].dataFieldId).toBe('df-title');
  });

  /**
   * Verifies: a failed request leaves loading set for every method that sets it first (current behavior), and the ones with no error callback let the error escape.
   * Interacts with: DataValueService endpoints (stubs failing), real DataValueStore and DataValueQuery, captureUnhandledRxErrors.
   * Data: loading cleared first; each endpoint fails with "request failed".
   */
  it.each([
    { method: 'loadById', endpoint: 'getDataValue', escapes: true, call: (s: DataValueDataService) => s.loadById('x-1') },
    { method: 'add', endpoint: 'createDataValue', escapes: true, call: (s: DataValueDataService) => s.add({ id: 'x-1' }) },
    { method: 'updateDataValue', endpoint: 'updateDataValue', escapes: true, call: (s: DataValueDataService) => s.updateDataValue({ id: 'x-1' }) },
  ] as const)('$method leaves loading stuck when its request fails', async ({ endpoint, escapes, call }) => {
    const { service, dataValueApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    TestBed.inject(DataValueStore).setLoading(false);
    dataValueApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    expect(TestBed.inject(DataValueQuery).getValue().loading).toBe(true);
    // With no error callback the error escapes to ErrorService, the ErrorHandler
    // app.module.ts provides, which shows it.
    expect(errors).toEqual(escapes ? [failure] : []);
  });

  /**
   * Verifies: a failed request from delete escapes to the app's global ErrorHandler.
   * Interacts with: DataValueService endpoints (stubs failing), captureUnhandledRxErrors.
   * Data: each endpoint fails with "request failed".
   */
  it.each([
    { method: 'delete', endpoint: 'deleteDataValue', call: (s: DataValueDataService) => s.delete('x-1') },
  ] as const)('$method lets a failed request reach the global ErrorHandler', async ({ endpoint, call }) => {
    const { service, dataValueApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    dataValueApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    // These methods subscribe with no error callback and set no loading flag,
    // so the error escapes to ErrorService, the ErrorHandler app.module.ts
    // provides, which shows it to the user. Not a defect on its own.
    expect(errors).toEqual([failure]);
  });
});
