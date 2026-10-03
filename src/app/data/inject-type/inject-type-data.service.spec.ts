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
import { EMPTY, Observable, firstValueFrom, of, throwError } from 'rxjs';
import { InjectType, InjectTypeService } from 'src/app/generated/blueprint.api';
import { InjectTypeStore } from './inject-type.store';
import { InjectTypeDataService } from './inject-type-data.service';
import { InjectTypeQuery } from './inject-type.query';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { activatedRouteStub } from 'src/app/test-utils/activated-route';
import { recordEmissions } from 'src/app/test-utils/record-emissions';
import { captureUnhandledRxErrors, flush } from 'src/app/test-utils/unhandled-rx-errors';

function injectType(overrides: Partial<InjectType> = {}): InjectType {
  return { id: 'it-email', name: 'Email', description: 'Email inject', ...overrides };
}

function setup(queryParams: Record<string, string> = {}) {
  const injectTypeApi = {
    getInjectTypes: vi.fn(() => of<InjectType[]>([])),
    getInjectType: vi.fn(() => of(injectType())),
    createInjectType: vi.fn(() => of(injectType())),
    updateInjectType: vi.fn(() => of(injectType())),
    deleteInjectType: vi.fn(() => of<unknown>(null)),
    downloadJsonInjectTypes: vi.fn(() => of(new Blob())),
    uploadJsonInjectTypes: vi.fn((): Observable<HttpEvent<InjectType[]>> => EMPTY),
  } satisfies ApiStub<InjectTypeService>;
  const navigate = vi.fn();
  const route = activatedRouteStub(queryParams);
  TestBed.configureTestingModule({
    providers: [
      { provide: InjectTypeService, useValue: injectTypeApi },
      { provide: Router, useValue: { navigate } satisfies Pick<Router, 'navigate'> },
      { provide: ActivatedRoute, useValue: route.route },
    ],
  });
  return {
    service: TestBed.inject(InjectTypeDataService),
    query: TestBed.inject(InjectTypeQuery),
    injectTypeApi,
    navigate,
    route,
  };
}

const names = (list: InjectType[]) => list.map((t) => t.name);

describe('InjectTypeDataService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: load merges every inject type into the store sorted by name.
   * Interacts with: InjectTypeService.getInjectTypes (stub), real InjectTypeStore and InjectTypeQuery.
   * Data: two inject types (one already stored).
   */
  it('load merges inject types sorted by name', () => {
    const { service, query, injectTypeApi } = setup();
    service.updateStore(injectType({ id: 'it-sms', name: 'SMS' }));
    injectTypeApi.getInjectTypes.mockReturnValue(
      of([injectType(), injectType({ id: 'it-call', name: 'Phone Call' })]),
    );

    service.load();
    expect(names(query.getAll())).toEqual(['Email', 'Phone Call', 'SMS']);
    expect(query.getValue().loading).toBe(false);
  });

  /**
   * Verifies: loadById, add and update store the API result; delete removes after confirmation; unload clears.
   * Interacts with: InjectTypeService get / create / update / delete (stubs), real InjectTypeQuery.
   * Data: it-call fetched, it-sms created, it-call renamed, it-sms deleted.
   */
  it('single-type calls keep the store in step with the API', () => {
    const { service, query, injectTypeApi } = setup();
    injectTypeApi.getInjectType.mockReturnValue(of(injectType({ id: 'it-call', name: 'Phone Call' })));
    injectTypeApi.createInjectType.mockReturnValue(of(injectType({ id: 'it-sms', name: 'SMS' })));
    injectTypeApi.updateInjectType.mockReturnValue(of(injectType({ id: 'it-call', name: 'Voice Call' })));
    injectTypeApi.deleteInjectType.mockReturnValue(of(null));

    service.loadById('it-call');
    service.add(injectType({ id: undefined, name: 'SMS' }));
    service.update(injectType({ id: 'it-call', name: 'edited' }));
    expect(injectTypeApi.updateInjectType).toHaveBeenCalledWith(
      'it-call',
      expect.objectContaining({ name: 'edited' }),
    );
    expect(names(query.getAll())).toEqual(['SMS', 'Voice Call']);

    service.delete('it-sms');
    expect(names(query.getAll())).toEqual(['Voice Call']);

    service.unload();
    expect(query.getAll()).toEqual([]);
  });

  /**
   * Verifies: uploadJson imports inject types with progress and resets progress on failure; downloadJson requests the given ids.
   * Interacts with: InjectTypeService.uploadJsonInjectTypes / downloadJsonInjectTypes (stubs), uploadProgress subject, real InjectTypeQuery.
   * Data: progress 9/10 and a 200 with one type, then a failure.
   */
  it('uploadJson imports inject types with progress', () => {
    const { service, query, injectTypeApi } = setup();
    const progress = recordEmissions(service.uploadProgress);
    injectTypeApi.uploadJsonInjectTypes.mockReturnValueOnce(
      of(
        { type: HttpEventType.UploadProgress, loaded: 9, total: 10 } satisfies HttpUploadProgressEvent,
        new HttpResponse({ status: 200, body: [injectType()] }),
      ),
    );
    injectTypeApi.uploadJsonInjectTypes.mockReturnValueOnce(throwError(() => new Error('bad')));

    service.uploadJson(new File(['[]'], 'types.json'), 'events', true);
    service.uploadJson(new File(['[]'], 'types.json'), 'events', true);

    expect(names(query.getAll())).toEqual(['Email']);
    expect(progress).toEqual([90, 0, 0]);
    expect(query.getValue().loading).toBe(false);
    service.downloadJson(['it-email']);
    expect(injectTypeApi.downloadJsonInjectTypes).toHaveBeenCalledWith(['it-email']);
  });

  /**
   * Verifies: updateStore/deleteFromStore (the InjectType SignalR targets) and setActive drive the queries.
   * Interacts with: real InjectTypeStore through the service, InjectTypeQuery.selectAll and selectActive.
   * Data: add two types, activate one, rename it, delete the other.
   */
  it('updateStore, deleteFromStore and setActive drive the queries', async () => {
    const { service, query } = setup();
    const emissions = recordEmissions(query.selectAll());

    service.updateStore(injectType());
    service.updateStore(injectType({ id: 'it-sms', name: 'SMS' }));
    service.setActive('it-sms');
    service.updateStore({ id: 'it-sms', name: 'Text Message' });
    service.deleteFromStore('it-email');

    expect(emissions.map(names)).toEqual([
      [],
      ['Email'],
      ['Email', 'SMS'],
      ['Email', 'Text Message'],
      ['Text Message'],
    ]);
    const active$ = query.selectActive() as Observable<InjectType>;
    expect((await firstValueFrom(active$)).name).toBe('Text Message');
  });

  /**
   * Verifies: InjectTypeList filters on the injectTypemask query param against the id.
   * Interacts with: ActivatedRoute.queryParamMap (stub), real InjectTypeQuery.
   * Data: it-email and it-sms; mask "sms".
   */
  it('InjectTypeList filters on the id', () => {
    const { service } = setup({ injectTypemask: 'sms' });
    service.updateStore(injectType());
    service.updateStore(injectType({ id: 'it-sms', name: 'SMS' }));

    expect(names(recordEmissions(service.InjectTypeList).at(-1))).toEqual(['SMS']);
  });

  /**
   * Verifies: a failed request leaves loading set for every method that sets it first (current behavior), and the ones with no error callback let the error escape.
   * Interacts with: InjectTypeService endpoints (stubs failing), real InjectTypeStore and InjectTypeQuery, captureUnhandledRxErrors.
   * Data: loading cleared first; each endpoint fails with "request failed".
   */
  it.each([
    { method: 'load', endpoint: 'getInjectTypes', escapes: false, call: (s: InjectTypeDataService) => s.load() },
    { method: 'loadById', endpoint: 'getInjectType', escapes: true, call: (s: InjectTypeDataService) => s.loadById('x-1') },
    { method: 'add', endpoint: 'createInjectType', escapes: true, call: (s: InjectTypeDataService) => s.add({ id: 'x-1' }) },
    { method: 'update', endpoint: 'updateInjectType', escapes: true, call: (s: InjectTypeDataService) => s.update({ id: 'x-1' }) },
  ] as const)('$method leaves loading stuck when its request fails', async ({ endpoint, escapes, call }) => {
    const { service, injectTypeApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    TestBed.inject(InjectTypeStore).setLoading(false);
    injectTypeApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    expect(TestBed.inject(InjectTypeQuery).getValue().loading).toBe(true);
    // An empty error callback swallows the error; with no callback it escapes to
    // ErrorService, the ErrorHandler app.module.ts provides, which shows it.
    expect(errors).toEqual(escapes ? [failure] : []);
  });

  /**
   * Verifies: a failed request from delete escapes to the app's global ErrorHandler.
   * Interacts with: InjectTypeService endpoints (stubs failing), captureUnhandledRxErrors.
   * Data: each endpoint fails with "request failed".
   */
  it.each([
    { method: 'delete', endpoint: 'deleteInjectType', call: (s: InjectTypeDataService) => s.delete('x-1') },
  ] as const)('$method lets a failed request reach the global ErrorHandler', async ({ endpoint, call }) => {
    const { service, injectTypeApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    injectTypeApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    // These methods subscribe with no error callback and set no loading flag,
    // so the error escapes to ErrorService, the ErrorHandler app.module.ts
    // provides, which shows it to the user. Not a defect on its own.
    expect(errors).toEqual([failure]);
  });
});
