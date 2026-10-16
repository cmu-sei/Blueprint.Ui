// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { MselCompetency, MselCompetencyService } from 'src/app/generated/blueprint.api';
import { MselCompetencyStore } from './msel-competency.store';
import { MselCompetencyDataService } from './msel-competency-data.service';
import { MselCompetencyQuery } from './msel-competency.query';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { recordEmissions } from 'src/app/test-utils/record-emissions';
import { captureUnhandledRxErrors, flush } from 'src/app/test-utils/unhandled-rx-errors';

function mc(overrides: Partial<MselCompetency> = {}): MselCompetency {
  return { id: 'mc-1', mselId: 'msel-1', competencyId: 'comp-b', ...overrides };
}

function setup() {
  const mcApi = {
    getMselCompetencies: vi.fn(() => of<MselCompetency[]>([])),
    createMselCompetency: vi.fn(() => of<MselCompetency>({})),
    deleteMselCompetency: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<MselCompetencyService>;
  TestBed.configureTestingModule({
    providers: [{ provide: MselCompetencyService, useValue: mcApi }],
  });
  return {
    service: TestBed.inject(MselCompetencyDataService),
    query: TestBed.inject(MselCompetencyQuery),
    mcApi,
  };
}

const competencyIds = (list: MselCompetency[]) => list.map((m) => m.competencyId);

describe('MselCompetencyDataService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: loadByMsel replaces the store sorted by competency id and empties it on failure; MselCompetencyList mirrors the query.
   * Interacts with: MselCompetencyService.getMselCompetencies (stub), real MselCompetencyStore and Query.
   * Data: comp-b and comp-a, then a failure.
   */
  it('loadByMsel replaces the competencies, or empties them on failure', () => {
    const { service, query, mcApi } = setup();
    const list = recordEmissions(service.MselCompetencyList);
    mcApi.getMselCompetencies.mockReturnValueOnce(of([mc(), mc({ id: 'mc-2', competencyId: 'comp-a' })]));
    mcApi.getMselCompetencies.mockReturnValueOnce(throwError(() => new Error('boom')));

    service.loadByMsel('msel-1');
    expect(mcApi.getMselCompetencies).toHaveBeenCalledWith('msel-1');
    expect(competencyIds(list.at(-1))).toEqual(['comp-a', 'comp-b']);

    service.loadByMsel('msel-1');
    expect(query.getAll()).toEqual([]);
    expect(query.getValue().loading).toBe(false);
  });

  /**
   * Verifies: add and delete keep the store in step with the API, and updateStore/deleteFromStore apply SignalR events; unload clears.
   * Interacts with: MselCompetencyService.createMselCompetency / deleteMselCompetency (stubs), real MselCompetencyQuery.
   * Data: mc-1 created, mc-2 arrives by event, mc-1 deleted, mc-2 removed by event.
   */
  it('add, delete and SignalR events keep the store current', () => {
    const { service, query, mcApi } = setup();
    mcApi.createMselCompetency.mockReturnValue(of(mc()));
    mcApi.deleteMselCompetency.mockReturnValue(of(null));

    service.add(mc({ id: undefined }));
    service.updateStore(mc({ id: 'mc-2', competencyId: 'comp-a' }));
    expect(competencyIds(query.getAll())).toEqual(['comp-a', 'comp-b']);

    service.delete('mc-1');
    expect(competencyIds(query.getAll())).toEqual(['comp-a']);

    service.deleteFromStore('mc-2');
    expect(query.getAll()).toEqual([]);

    service.updateStore(mc());
    service.unload();
    expect(query.getAll()).toEqual([]);
  });

  /**
   * Verifies: a failed request leaves loading set for every method that sets it first (current behavior), and the ones with no error callback let the error escape.
   * Interacts with: MselCompetencyService endpoints (stubs failing), real MselCompetencyStore and MselCompetencyQuery, captureUnhandledRxErrors.
   * Data: loading cleared first; each endpoint fails with "request failed".
   */
  it.each([
    { method: 'add', endpoint: 'createMselCompetency', escapes: true, call: (s: MselCompetencyDataService) => s.add({ id: 'x-1' }) },
  ] as const)('$method leaves loading stuck when its request fails', async ({ endpoint, escapes, call }) => {
    const { service, mcApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    TestBed.inject(MselCompetencyStore).setLoading(false);
    mcApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    expect(TestBed.inject(MselCompetencyQuery).getValue().loading).toBe(true);
    // With no error callback the error escapes to ErrorService, the ErrorHandler
    // app.module.ts provides, which shows it.
    expect(errors).toEqual(escapes ? [failure] : []);
  });

  /**
   * Verifies: a failed request from delete escapes to the app's global ErrorHandler.
   * Interacts with: MselCompetencyService endpoints (stubs failing), captureUnhandledRxErrors.
   * Data: each endpoint fails with "request failed".
   */
  it.each([
    { method: 'delete', endpoint: 'deleteMselCompetency', call: (s: MselCompetencyDataService) => s.delete('x-1') },
  ] as const)('$method lets a failed request reach the global ErrorHandler', async ({ endpoint, call }) => {
    const { service, mcApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    mcApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    // These methods subscribe with no error callback and set no loading flag,
    // so the error escapes to ErrorService, the ErrorHandler app.module.ts
    // provides, which shows it to the user. Not a defect on its own.
    expect(errors).toEqual([failure]);
  });
});
