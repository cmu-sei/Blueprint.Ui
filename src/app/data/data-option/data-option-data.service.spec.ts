// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { DataOption, DataOptionService } from 'src/app/generated/blueprint.api';
import { DataOptionStore } from './data-option.store';
import { DataOptionDataService } from './data-option-data.service';
import { DataOptionQuery } from './data-option.query';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { activatedRouteStub } from 'src/app/test-utils/activated-route';
import { recordEmissions } from 'src/app/test-utils/record-emissions';
import { captureUnhandledRxErrors, flush } from 'src/app/test-utils/unhandled-rx-errors';

function option(overrides: Partial<DataOption> = {}): DataOption {
  return {
    id: 'opt-1',
    dataFieldId: 'df-status',
    optionName: 'Open',
    optionValue: 'open',
    displayOrder: 1,
    ...overrides,
  };
}

function setup(queryParams: Record<string, string> = {}) {
  const dataOptionApi = {
    getDataOptionsByMsel: vi.fn(() => of<DataOption[]>([])),
    getByDataField: vi.fn(() => of<DataOption[]>([])),
    getDataOption: vi.fn(() => of<DataOption>({})),
    createDataOption: vi.fn(() => of<DataOption>({})),
    updateDataOption: vi.fn(() => of<DataOption>({})),
    deleteDataOption: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<DataOptionService>;
  const navigate = vi.fn();
  const route = activatedRouteStub(queryParams);
  TestBed.configureTestingModule({
    providers: [
      { provide: DataOptionService, useValue: dataOptionApi },
      { provide: Router, useValue: { navigate } satisfies Pick<Router, 'navigate'> },
      { provide: ActivatedRoute, useValue: route.route },
    ],
  });
  return {
    service: TestBed.inject(DataOptionDataService),
    query: TestBed.inject(DataOptionQuery),
    dataOptionApi,
    navigate,
    route,
  };
}

const optionNames = (list: DataOption[]) => list.map((o) => o.optionName);

describe('DataOptionDataService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: loadByMsel replaces the store with the MSEL's options, and loadByDataField merges one field's options in.
   * Interacts with: DataOptionService.getDataOptionsByMsel / getByDataField (stubs), real DataOptionStore and DataOptionQuery.
   * Data: two MSEL options (a stale one present), then one option for another field.
   */
  it('loadByMsel replaces, loadByDataField merges', () => {
    const { service, query, dataOptionApi } = setup();
    service.updateStore(option({ id: 'stale', optionName: 'Stale' }));
    dataOptionApi.getDataOptionsByMsel.mockReturnValue(
      of([option(), option({ id: 'opt-2', optionName: 'Closed' })]),
    );
    dataOptionApi.getByDataField.mockReturnValue(
      of([option({ id: 'opt-3', dataFieldId: 'df-sev', optionName: 'High' })]),
    );

    service.loadByMsel('msel-1');
    service.loadByDataField('df-sev');

    expect(dataOptionApi.getByDataField).toHaveBeenCalledWith('df-sev');
    expect(optionNames(query.getAll())).toEqual(['Open', 'Closed', 'High']);
    expect(query.getValue().loading).toBe(false);
  });

  /**
   * Verifies: a failed loadByMsel empties the store and clears loading.
   * Interacts with: DataOptionService.getDataOptionsByMsel (stub erroring), real DataOptionQuery.
   * Data: one stored option.
   */
  it('a failed loadByMsel empties the store', () => {
    const { service, query, dataOptionApi } = setup();
    service.updateStore(option());
    dataOptionApi.getDataOptionsByMsel.mockReturnValue(throwError(() => new Error('boom')));

    service.loadByMsel('msel-1');

    expect(query.getAll()).toEqual([]);
    expect(query.getValue().loading).toBe(false);
  });

  /**
   * Verifies: loadById, add and updateDataOption store the API result; delete removes after confirmation; unload clears.
   * Interacts with: DataOptionService getDataOption / create / update / delete (stubs), real DataOptionQuery.
   * Data: opt-2 fetched, opt-3 created, opt-2 renamed, opt-3 deleted.
   */
  it('single-option calls keep the store in step with the API', () => {
    const { service, query, dataOptionApi } = setup();
    dataOptionApi.getDataOption.mockReturnValue(of(option({ id: 'opt-2', optionName: 'Closed' })));
    dataOptionApi.createDataOption.mockReturnValue(of(option({ id: 'opt-3', optionName: 'Pending' })));
    dataOptionApi.updateDataOption.mockReturnValue(of(option({ id: 'opt-2', optionName: 'Resolved' })));
    dataOptionApi.deleteDataOption.mockReturnValue(of(null));

    service.loadById('opt-2');
    service.add(option({ id: undefined, optionName: 'Pending' }));
    service.updateDataOption(option({ id: 'opt-2', optionName: 'edited' }));
    expect(dataOptionApi.updateDataOption).toHaveBeenCalledWith(
      'opt-2',
      expect.objectContaining({ optionName: 'edited' }),
    );
    expect(optionNames(query.getAll())).toEqual(['Resolved', 'Pending']);

    service.delete('opt-3');
    expect(optionNames(query.getAll())).toEqual(['Resolved']);

    service.unload();
    expect(query.getAll()).toEqual([]);
  });

  /**
   * Verifies: updateStore and deleteFromStore (the DataOption SignalR targets) drive selectAll.
   * Interacts with: real DataOptionStore through the service, DataOptionQuery.selectAll.
   * Data: add two options, rename one, delete the other.
   */
  it('updateStore and deleteFromStore drive the query output', () => {
    const { service, query } = setup();
    const emissions = recordEmissions(query.selectAll());

    service.updateStore(option());
    service.updateStore(option({ id: 'opt-2', optionName: 'Closed' }));
    service.updateStore({ id: 'opt-2', optionName: 'Done' });
    service.deleteFromStore('opt-1');

    expect(emissions.map(optionNames)).toEqual([
      [],
      ['Open'],
      ['Open', 'Closed'],
      ['Open', 'Done'],
      ['Done'],
    ]);
  });

  /**
   * Verifies: DataOptionList filters on the dataOptionmask query param against the id.
   * Interacts with: ActivatedRoute.queryParamMap (stub), real DataOptionQuery.
   * Data: opt-1 and opt-2; mask "opt-2".
   */
  it('DataOptionList filters on the id', () => {
    const { service } = setup({ dataOptionmask: 'opt-2' });
    service.updateStore(option());
    service.updateStore(option({ id: 'opt-2', optionName: 'Closed' }));

    expect(optionNames(recordEmissions(service.DataOptionList).at(-1))).toEqual(['Closed']);
  });

  /**
   * Verifies: a failed request leaves loading set for every method that sets it first (current behavior), and the ones with no error callback let the error escape.
   * Interacts with: DataOptionService endpoints (stubs failing), real DataOptionStore and DataOptionQuery, captureUnhandledRxErrors.
   * Data: loading cleared first; each endpoint fails with "request failed".
   */
  it.each([
    { method: 'loadByDataField', endpoint: 'getByDataField', escapes: false, call: (s: DataOptionDataService) => s.loadByDataField('x-1') },
    { method: 'loadById', endpoint: 'getDataOption', escapes: true, call: (s: DataOptionDataService) => s.loadById('x-1') },
    { method: 'add', endpoint: 'createDataOption', escapes: true, call: (s: DataOptionDataService) => s.add({ id: 'x-1' }) },
    { method: 'updateDataOption', endpoint: 'updateDataOption', escapes: true, call: (s: DataOptionDataService) => s.updateDataOption({ id: 'x-1' }) },
  ] as const)('$method leaves loading stuck when its request fails', async ({ endpoint, escapes, call }) => {
    const { service, dataOptionApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    TestBed.inject(DataOptionStore).setLoading(false);
    dataOptionApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    expect(TestBed.inject(DataOptionQuery).getValue().loading).toBe(true);
    // An empty error callback swallows the error; with no callback it escapes to
    // ErrorService, the ErrorHandler app.module.ts provides, which shows it.
    expect(errors).toEqual(escapes ? [failure] : []);
  });

  /**
   * Verifies: a failed request from delete escapes to the app's global ErrorHandler.
   * Interacts with: DataOptionService endpoints (stubs failing), captureUnhandledRxErrors.
   * Data: each endpoint fails with "request failed".
   */
  it.each([
    { method: 'delete', endpoint: 'deleteDataOption', call: (s: DataOptionDataService) => s.delete('x-1') },
  ] as const)('$method lets a failed request reach the global ErrorHandler', async ({ endpoint, call }) => {
    const { service, dataOptionApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    dataOptionApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    // These methods subscribe with no error callback and set no loading flag,
    // so the error escapes to ErrorService, the ErrorHandler app.module.ts
    // provides, which shows it to the user. Not a defect on its own.
    expect(errors).toEqual([failure]);
  });
});
