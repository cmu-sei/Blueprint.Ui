// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, firstValueFrom, of, throwError } from 'rxjs';
import { CompetencyFramework, CompetencyFrameworkService } from 'src/app/generated/blueprint.api';
import { CompetencyFrameworkStore } from './competency-framework.store';
import { CompetencyFrameworkDataService } from './competency-framework-data.service';
import { CompetencyFrameworkQuery } from './competency-framework.query';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { activatedRouteStub } from 'src/app/test-utils/activated-route';
import { recordEmissions } from 'src/app/test-utils/record-emissions';
import { captureUnhandledRxErrors, flush } from 'src/app/test-utils/unhandled-rx-errors';

function framework(overrides: Partial<CompetencyFramework> = {}): CompetencyFramework {
  return {
    id: 'cf-1',
    name: 'NICE Framework',
    source: 'NIST',
    version: '2.0',
    ...overrides,
  };
}

function setup(queryParams: Record<string, string> = {}) {
  const cfApi = {
    getCompetencyFrameworks: vi.fn(() => of<CompetencyFramework[]>([])),
    getCompetencyFramework: vi.fn(() => of<CompetencyFramework>({})),
    createCompetencyFramework: vi.fn(() => of<CompetencyFramework>({})),
    updateCompetencyFramework: vi.fn(() => of<CompetencyFramework>({})),
    deleteCompetencyFramework: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<CompetencyFrameworkService>;
  const navigate = vi.fn();
  const route = activatedRouteStub(queryParams);
  TestBed.configureTestingModule({
    providers: [
      { provide: CompetencyFrameworkService, useValue: cfApi },
      { provide: Router, useValue: { navigate } satisfies Pick<Router, 'navigate'> },
      { provide: ActivatedRoute, useValue: route.route },
    ],
  });
  return {
    service: TestBed.inject(CompetencyFrameworkDataService),
    query: TestBed.inject(CompetencyFrameworkQuery),
    cfApi,
    navigate,
    route,
  };
}

const names = (list: CompetencyFramework[]) => list.map((f) => f.name);

describe('CompetencyFrameworkDataService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: load merges every framework into the store sorted by name.
   * Interacts with: CompetencyFrameworkService.getCompetencyFrameworks (stub), real CompetencyFrameworkStore and Query.
   * Data: NICE and DCWF.
   */
  it('load merges frameworks sorted by name', () => {
    const { service, query, cfApi } = setup();
    cfApi.getCompetencyFrameworks.mockReturnValue(
      of([framework(), framework({ id: 'cf-2', name: 'DCWF', source: 'DoD' })]),
    );

    service.load();
    expect(names(query.getAll())).toEqual(['DCWF', 'NICE Framework']);
    expect(query.getValue().loading).toBe(false);
  });

  /**
   * Verifies: loadById, add and update store the API result; delete removes after confirmation; unload clears.
   * Interacts with: CompetencyFrameworkService get / create / update / delete (stubs), real CompetencyFrameworkQuery.
   * Data: cf-2 fetched, cf-3 created, cf-2 re-versioned, cf-3 deleted.
   */
  it('single-framework calls keep the store in step with the API', () => {
    const { service, query, cfApi } = setup();
    cfApi.getCompetencyFramework.mockReturnValue(of(framework({ id: 'cf-2', name: 'DCWF' })));
    cfApi.createCompetencyFramework.mockReturnValue(of(framework({ id: 'cf-3', name: 'Custom' })));
    cfApi.updateCompetencyFramework.mockReturnValue(
      of(framework({ id: 'cf-2', name: 'DCWF', version: '5.0' })),
    );
    cfApi.deleteCompetencyFramework.mockReturnValue(of(null));

    service.loadById('cf-2');
    service.add(framework({ id: undefined, name: 'Custom' }));
    service.update(framework({ id: 'cf-2', name: 'DCWF', version: '5.0' }));
    expect(cfApi.updateCompetencyFramework).toHaveBeenCalledWith(
      'cf-2',
      expect.objectContaining({ version: '5.0' }),
    );
    expect(query.getEntity('cf-2').version).toBe('5.0');
    expect(names(query.getAll())).toEqual(['Custom', 'DCWF']);

    service.delete('cf-3');
    expect(names(query.getAll())).toEqual(['DCWF']);

    service.unload();
    expect(query.getAll()).toEqual([]);
  });

  /**
   * Verifies: CompetencyFrameworkList matches the mask against name, source or version, tolerating missing fields.
   * Interacts with: ActivatedRoute.queryParamMap (stub), real CompetencyFrameworkQuery.
   * Data: NICE/NIST/2.0, DCWF/DoD/5.0 and an unnamed framework with no source or version; masks "nist", "5.0", "dcwf".
   */
  it('CompetencyFrameworkList filters on name, source or version', () => {
    const { service, route } = setup({ competencyFrameworkmask: 'nist' });
    service.updateStore(framework());
    service.updateStore(framework({ id: 'cf-2', name: 'DCWF', source: 'DoD', version: '5.0' }));
    service.updateStore({ id: 'cf-3' });
    const list = recordEmissions(service.CompetencyFrameworkList);

    expect(names(list.at(-1))).toEqual(['NICE Framework']);
    route.setQueryParams({ competencyFrameworkmask: '5.0' });
    expect(names(list.at(-1))).toEqual(['DCWF']);
    route.setQueryParams({ competencyFrameworkmask: 'dcwf' });
    expect(names(list.at(-1))).toEqual(['DCWF']);
  });

  /**
   * Verifies: updateStore/deleteFromStore and setActive drive the queries, and filterControl writes the competencyFrameworkmask param.
   * Interacts with: real CompetencyFrameworkStore through the service, CompetencyFrameworkQuery.selectActive, Router.navigate (spy).
   * Data: two frameworks; one activated, the other deleted; filter "nice".
   */
  it('updateStore, deleteFromStore and setActive drive the queries', async () => {
    const { service, query, navigate } = setup();
    service.updateStore(framework());
    service.updateStore(framework({ id: 'cf-2', name: 'DCWF' }));
    service.setActive('cf-2');
    service.deleteFromStore('cf-1');

    const active$ = query.selectActive() as Observable<CompetencyFramework>;
    expect((await firstValueFrom(active$)).name).toBe('DCWF');
    expect(names(query.getAll())).toEqual(['DCWF']);

    service.filterControl.setValue('nice');
    expect(navigate).toHaveBeenCalledWith([], {
      queryParams: { competencyFrameworkmask: 'nice' },
      queryParamsHandling: 'merge',
    });
  });

  /**
   * Verifies: a failed request leaves loading set for every method that sets it first (current behavior), and the ones with no error callback let the error escape.
   * Interacts with: CompetencyFrameworkService endpoints (stubs failing), real CompetencyFrameworkStore and CompetencyFrameworkQuery, captureUnhandledRxErrors.
   * Data: loading cleared first; each endpoint fails with "request failed".
   */
  it.each([
    { method: 'load', endpoint: 'getCompetencyFrameworks', escapes: false, call: (s: CompetencyFrameworkDataService) => s.load() },
    { method: 'loadById', endpoint: 'getCompetencyFramework', escapes: true, call: (s: CompetencyFrameworkDataService) => s.loadById('x-1') },
    { method: 'add', endpoint: 'createCompetencyFramework', escapes: true, call: (s: CompetencyFrameworkDataService) => s.add({ id: 'x-1' }) },
    { method: 'update', endpoint: 'updateCompetencyFramework', escapes: true, call: (s: CompetencyFrameworkDataService) => s.update({ id: 'x-1' }) },
  ] as const)('$method leaves loading stuck when its request fails', async ({ endpoint, escapes, call }) => {
    const { service, cfApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    TestBed.inject(CompetencyFrameworkStore).setLoading(false);
    cfApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    expect(TestBed.inject(CompetencyFrameworkQuery).getValue().loading).toBe(true);
    // An empty error callback swallows the error; with no callback it escapes to
    // ErrorService, the ErrorHandler app.module.ts provides, which shows it.
    expect(errors).toEqual(escapes ? [failure] : []);
  });

  /**
   * Verifies: a failed request from delete escapes to the app's global ErrorHandler.
   * Interacts with: CompetencyFrameworkService endpoints (stubs failing), captureUnhandledRxErrors.
   * Data: each endpoint fails with "request failed".
   */
  it.each([
    { method: 'delete', endpoint: 'deleteCompetencyFramework', call: (s: CompetencyFrameworkDataService) => s.delete('x-1') },
  ] as const)('$method lets a failed request reach the global ErrorHandler', async ({ endpoint, call }) => {
    const { service, cfApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    cfApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    // These methods subscribe with no error callback and set no loading flag,
    // so the error escapes to ErrorService, the ErrorHandler app.module.ts
    // provides, which shows it to the user. Not a defect on its own.
    expect(errors).toEqual([failure]);
  });
});
