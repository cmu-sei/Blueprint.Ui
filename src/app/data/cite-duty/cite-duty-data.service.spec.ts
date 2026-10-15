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
import { CiteDuty, CiteDutyService } from 'src/app/generated/blueprint.api';
import { CiteDutyStore } from './cite-duty.store';
import { CiteDutyDataService } from './cite-duty-data.service';
import { CiteDutyQuery } from './cite-duty.query';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { activatedRouteStub } from 'src/app/test-utils/activated-route';
import { recordEmissions } from 'src/app/test-utils/record-emissions';
import { captureUnhandledRxErrors, flush } from 'src/app/test-utils/unhandled-rx-errors';

function duty(overrides: Partial<CiteDuty> = {}): CiteDuty {
  return {
    id: 'duty-1',
    mselId: 'msel-1',
    teamId: 'team-red',
    name: 'Incident Commander',
    isTemplate: false,
    ...overrides,
  };
}

function setup(queryParams: Record<string, string> = {}) {
  const citeDutyApi = {
    getCiteDutyTemplates: vi.fn(() => of<CiteDuty[]>([])),
    getDutiesByMsel: vi.fn(() => of<CiteDuty[]>([])),
    getCiteDuty: vi.fn(() => of<CiteDuty>({})),
    createCiteDuty: vi.fn(() => of<CiteDuty>({})),
    updateCiteDuty: vi.fn(() => of<CiteDuty>({})),
    deleteCiteDuty: vi.fn(() => of<unknown>(null)),
    downloadJsonCiteDuties: vi.fn(() => of(new Blob())),
    uploadJsonCiteDuties: vi.fn((): Observable<HttpEvent<CiteDuty[]>> => EMPTY),
  } satisfies ApiStub<CiteDutyService>;
  const navigate = vi.fn();
  const route = activatedRouteStub(queryParams);
  TestBed.configureTestingModule({
    providers: [
      { provide: CiteDutyService, useValue: citeDutyApi },
      { provide: Router, useValue: { navigate } satisfies Pick<Router, 'navigate'> },
      { provide: ActivatedRoute, useValue: route.route },
    ],
  });
  return {
    service: TestBed.inject(CiteDutyDataService),
    query: TestBed.inject(CiteDutyQuery),
    citeDutyApi,
    navigate,
    route,
  };
}

const names = (list: CiteDuty[]) => list.map((d) => d.name);

describe('CiteDutyDataService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: loadTemplates merges template duties and loadByMsel replaces the store with the MSEL's duties, sorted by name.
   * Interacts with: CiteDutyService.getCiteDutyTemplates / getDutiesByMsel (stubs), real CiteDutyStore and CiteDutyQuery.
   * Data: one template duty, then two MSEL duties.
   */
  it('loadTemplates merges, loadByMsel replaces', () => {
    const { service, query, citeDutyApi } = setup();
    citeDutyApi.getCiteDutyTemplates.mockReturnValue(
      of([duty({ id: 'tmpl-1', name: 'Template Duty', isTemplate: true })]),
    );
    citeDutyApi.getDutiesByMsel.mockReturnValue(
      of([duty(), duty({ id: 'duty-2', name: 'Analyst' })]),
    );
    service.updateStore(duty({ id: 'duty-0', name: 'Existing' }));

    service.loadTemplates();
    expect(names(query.getAll())).toEqual(['Existing', 'Template Duty']);

    service.loadByMsel('msel-1');
    expect(citeDutyApi.getDutiesByMsel).toHaveBeenCalledWith('msel-1');
    expect(names(query.getAll())).toEqual(['Analyst', 'Incident Commander']);
    expect(query.getValue().loading).toBe(false);
  });

  /**
   * Verifies: a failed loadByMsel empties the store and clears loading.
   * Interacts with: CiteDutyService.getDutiesByMsel (stub erroring), real CiteDutyQuery.
   * Data: one stored duty.
   */
  it('a failed loadByMsel empties the store', () => {
    const { service, query, citeDutyApi } = setup();
    citeDutyApi.getDutiesByMsel.mockReturnValue(throwError(() => new Error('boom')));
    service.updateStore(duty());

    service.loadByMsel('msel-1');

    expect(query.getAll()).toEqual([]);
    expect(query.getValue().loading).toBe(false);
  });

  /**
   * Verifies: loadById, add and updateCiteDuty store what the API returns; delete removes after confirmation; unload clears.
   * Interacts with: CiteDutyService getCiteDuty / create / update / delete (stubs), real CiteDutyQuery.
   * Data: duty-2 fetched, duty-3 created, duty-2 renamed by the API, duty-3 deleted.
   */
  it('single-duty calls keep the store in step with the API', () => {
    const { service, query, citeDutyApi } = setup();
    citeDutyApi.getCiteDuty.mockReturnValue(of(duty({ id: 'duty-2', name: 'Analyst' })));
    citeDutyApi.createCiteDuty.mockReturnValue(of(duty({ id: 'duty-3', name: 'Scribe' })));
    citeDutyApi.updateCiteDuty.mockReturnValue(of(duty({ id: 'duty-2', name: 'Lead Analyst' })));
    citeDutyApi.deleteCiteDuty.mockReturnValue(of(null));

    service.loadById('duty-2');
    service.add(duty({ id: undefined, name: 'Scribe' }));
    service.updateCiteDuty(duty({ id: 'duty-2', name: 'edited' }));
    expect(citeDutyApi.updateCiteDuty).toHaveBeenCalledWith(
      'duty-2',
      expect.objectContaining({ name: 'edited' }),
    );
    expect(names(query.getAll())).toEqual(['Lead Analyst', 'Scribe']);

    service.delete('duty-3');
    expect(names(query.getAll())).toEqual(['Lead Analyst']);

    service.unload();
    expect(query.getAll()).toEqual([]);
  });

  /**
   * Verifies: uploadJson reports progress and upserts the imported duties, and a failure resets progress; downloadJson requests the given ids.
   * Interacts with: CiteDutyService.uploadJsonCiteDuties / downloadJsonCiteDuties (stubs), uploadProgress subject, real CiteDutyQuery.
   * Data: progress 2/8 and a 200 with one duty, then a failure.
   */
  it('uploadJson imports duties with progress', () => {
    const { service, query, citeDutyApi } = setup();
    const progress = recordEmissions(service.uploadProgress);
    citeDutyApi.uploadJsonCiteDuties.mockReturnValueOnce(
      of(
        { type: HttpEventType.UploadProgress, loaded: 2, total: 8 } satisfies HttpUploadProgressEvent,
        new HttpResponse({ status: 200, body: [duty()] }),
      ),
    );
    citeDutyApi.uploadJsonCiteDuties.mockReturnValueOnce(throwError(() => new Error('bad')));

    service.uploadJson(new File(['[]'], 'duties.json'), 'events', true);
    service.uploadJson(new File(['[]'], 'duties.json'), 'events', true);

    expect(names(query.getAll())).toEqual(['Incident Commander']);
    expect(progress).toEqual([25, 0, 0]);
    expect(query.getValue().loading).toBe(false);
    service.downloadJson(['duty-1']);
    expect(citeDutyApi.downloadJsonCiteDuties).toHaveBeenCalledWith(['duty-1']);
  });

  /**
   * Verifies: updateStore and deleteFromStore (the CiteDuty SignalR targets) drive selectAll, sorted by name.
   * Interacts with: real CiteDutyStore through the service, CiteDutyQuery.selectAll.
   * Data: add two duties, rename one, delete the other.
   */
  it('updateStore and deleteFromStore drive the query output', () => {
    const { service, query } = setup();
    const emissions = recordEmissions(query.selectAll());

    service.updateStore(duty());
    service.updateStore(duty({ id: 'duty-2', name: 'Analyst' }));
    service.updateStore({ id: 'duty-2', name: 'Zone Lead' });
    service.deleteFromStore('duty-1');

    expect(emissions.map(names)).toEqual([
      [],
      ['Incident Commander'],
      ['Analyst', 'Incident Commander'],
      ['Incident Commander', 'Zone Lead'],
      ['Zone Lead'],
    ]);
  });

  /**
   * Verifies: CiteDutyList filters on the citeDutymask query param against the duty name or id.
   * Interacts with: ActivatedRoute.queryParamMap (stub), real CiteDutyQuery.
   * Data: "Incident Commander" and "Analyst"; masks "command" and "duty-2".
   */
  it('CiteDutyList filters on the citeDutymask query param', () => {
    const { service, route } = setup({ citeDutymask: 'command' });
    service.updateStore(duty());
    service.updateStore(duty({ id: 'duty-2', name: 'Analyst' }));
    const emissions = recordEmissions(service.CiteDutyList);

    expect(names(emissions.at(-1))).toEqual(['Incident Commander']);

    route.setQueryParams({ citeDutymask: 'duty-2' });
    expect(names(emissions.at(-1))).toEqual(['Analyst']);
  });

  /**
   * Verifies: a failed request leaves loading set for every method that sets it first (current behavior), and the ones with no error callback let the error escape.
   * Interacts with: CiteDutyService endpoints (stubs failing), real CiteDutyStore and CiteDutyQuery, captureUnhandledRxErrors.
   * Data: loading cleared first; each endpoint fails with "request failed".
   */
  it.each([
    { method: 'loadTemplates', endpoint: 'getCiteDutyTemplates', escapes: false, call: (s: CiteDutyDataService) => s.loadTemplates() },
    { method: 'loadById', endpoint: 'getCiteDuty', escapes: true, call: (s: CiteDutyDataService) => s.loadById('x-1') },
    { method: 'add', endpoint: 'createCiteDuty', escapes: true, call: (s: CiteDutyDataService) => s.add({ id: 'x-1' }) },
    { method: 'updateCiteDuty', endpoint: 'updateCiteDuty', escapes: true, call: (s: CiteDutyDataService) => s.updateCiteDuty({ id: 'x-1' }) },
  ] as const)('$method leaves loading stuck when its request fails', async ({ endpoint, escapes, call }) => {
    const { service, citeDutyApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    TestBed.inject(CiteDutyStore).setLoading(false);
    citeDutyApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    expect(TestBed.inject(CiteDutyQuery).getValue().loading).toBe(true);
    // An empty error callback swallows the error; with no callback it escapes to
    // ErrorService, the ErrorHandler app.module.ts provides, which shows it.
    expect(errors).toEqual(escapes ? [failure] : []);
  });

  /**
   * Verifies: a failed request from delete escapes to the app's global ErrorHandler.
   * Interacts with: CiteDutyService endpoints (stubs failing), captureUnhandledRxErrors.
   * Data: each endpoint fails with "request failed".
   */
  it.each([
    { method: 'delete', endpoint: 'deleteCiteDuty', call: (s: CiteDutyDataService) => s.delete('x-1') },
  ] as const)('$method lets a failed request reach the global ErrorHandler', async ({ endpoint, call }) => {
    const { service, citeDutyApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    citeDutyApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    // These methods subscribe with no error callback and set no loading flag,
    // so the error escapes to ErrorService, the ErrorHandler app.module.ts
    // provides, which shows it to the user. Not a defect on its own.
    expect(errors).toEqual([failure]);
  });
});
