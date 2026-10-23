// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, firstValueFrom, of, throwError } from 'rxjs';
import { MselPage, MselPageService } from 'src/app/generated/blueprint.api';
import { MselPageStore } from './msel-page.store';
import { MselPageDataService } from './msel-page-data.service';
import { MselPageQuery } from './msel-page.query';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { activatedRouteStub } from 'src/app/test-utils/activated-route';
import { recordEmissions } from 'src/app/test-utils/record-emissions';
import { captureUnhandledRxErrors, flush } from 'src/app/test-utils/unhandled-rx-errors';

function page(overrides: Partial<MselPage> = {}): MselPage {
  return {
    id: 'page-1',
    mselId: 'msel-1',
    name: 'Briefing',
    content: '<p>Welcome</p>',
    allCanView: true,
    includeInPlaybook: false,
    ...overrides,
  };
}

function setup(queryParams: Record<string, string> = {}) {
  const pageApi = {
    getMselPages: vi.fn(() => of<MselPage[]>([])),
    getMselPage: vi.fn(() => of<MselPage>({})),
    createMselPage: vi.fn(() => of<MselPage>({})),
    updateMselPage: vi.fn(() => of<MselPage>({})),
    deleteMselPage: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<MselPageService>;
  const navigate = vi.fn();
  const route = activatedRouteStub(queryParams);
  TestBed.configureTestingModule({
    providers: [
      { provide: MselPageService, useValue: pageApi },
      { provide: Router, useValue: { navigate } satisfies Pick<Router, 'navigate'> },
      { provide: ActivatedRoute, useValue: route.route },
    ],
  });
  return {
    service: TestBed.inject(MselPageDataService),
    query: TestBed.inject(MselPageQuery),
    pageApi,
    navigate,
  };
}

const names = (list: MselPage[]) => list.map((p) => p.name);

describe('MselPageDataService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: loadByMsel replaces the store with the MSEL's pages sorted by name, and empties it on failure.
   * Interacts with: MselPageService.getMselPages (stub), real MselPageStore and MselPageQuery.
   * Data: pages "Briefing" and "Annex", then a failure.
   */
  it('loadByMsel replaces the pages, or empties them on failure', () => {
    const { service, query, pageApi } = setup();
    pageApi.getMselPages.mockReturnValueOnce(of([page(), page({ id: 'page-2', name: 'Annex' })]));
    pageApi.getMselPages.mockReturnValueOnce(throwError(() => new Error('boom')));

    service.loadByMsel('msel-1');
    expect(pageApi.getMselPages).toHaveBeenCalledWith('msel-1');
    expect(names(query.getAll())).toEqual(['Annex', 'Briefing']);

    service.loadByMsel('msel-1');
    expect(query.getAll()).toEqual([]);
    expect(query.getValue().loading).toBe(false);
  });

  /**
   * Verifies: loadById, add and update store the API result; delete removes after confirmation; unload clears.
   * Interacts with: MselPageService get / create / update / delete (stubs), real MselPageQuery.
   * Data: page-2 fetched, page-3 created, page-2 renamed by the API, page-3 deleted.
   */
  it('single-page calls keep the store in step with the API', () => {
    const { service, query, pageApi } = setup();
    pageApi.getMselPage.mockReturnValue(of(page({ id: 'page-2', name: 'Annex' })));
    pageApi.createMselPage.mockReturnValue(of(page({ id: 'page-3', name: 'Contacts' })));
    pageApi.updateMselPage.mockReturnValue(of(page({ id: 'page-2', name: 'Annex A' })));
    pageApi.deleteMselPage.mockReturnValue(of(null));

    service.loadById('page-2');
    service.add(page({ id: undefined, name: 'Contacts' }));
    service.update(page({ id: 'page-2', name: 'edited' }));
    expect(pageApi.updateMselPage).toHaveBeenCalledWith(
      'page-2',
      expect.objectContaining({ name: 'edited' }),
    );
    expect(names(query.getAll())).toEqual(['Annex A', 'Contacts']);

    service.delete('page-3');
    expect(names(query.getAll())).toEqual(['Annex A']);

    service.unload();
    expect(query.getAll()).toEqual([]);
  });

  /**
   * Verifies: updateStore/deleteFromStore and setActive drive the queries; MselPageList filters on the id; filterControl writes mselPagemask.
   * Interacts with: real MselPageStore through the service, MselPageQuery, ActivatedRoute (stub), Router.navigate (spy).
   * Data: two pages; one activated, the other deleted; mask "page-2".
   */
  it('updateStore, deleteFromStore and setActive drive the queries', async () => {
    const { service, query, navigate } = setup({ mselPagemask: 'page-2' });
    service.updateStore(page());
    service.updateStore(page({ id: 'page-2', name: 'Annex' }));
    expect(names(recordEmissions(service.MselPageList).at(-1))).toEqual(['Annex']);

    service.setActive('page-2');
    service.updateStore({ id: 'page-2', includeInPlaybook: true });
    service.deleteFromStore('page-1');

    const active$ = query.selectActive() as Observable<MselPage>;
    const active = await firstValueFrom(active$);
    expect(active.name).toBe('Annex');
    expect(active.includeInPlaybook).toBe(true);
    expect(names(query.getAll())).toEqual(['Annex']);

    service.filterControl.setValue('ann');
    expect(navigate).toHaveBeenCalledWith([], {
      queryParams: { mselPagemask: 'ann' },
      queryParamsHandling: 'merge',
    });
  });

  /**
   * Verifies: a failed request leaves loading set for every method that sets it first (current behavior), and the ones with no error callback let the error escape.
   * Interacts with: MselPageService endpoints (stubs failing), real MselPageStore and MselPageQuery, captureUnhandledRxErrors.
   * Data: loading cleared first; each endpoint fails with "request failed".
   */
  it.each([
    { method: 'loadById', endpoint: 'getMselPage', escapes: true, call: (s: MselPageDataService) => s.loadById('x-1') },
    { method: 'add', endpoint: 'createMselPage', escapes: true, call: (s: MselPageDataService) => s.add({ id: 'x-1' }) },
    { method: 'update', endpoint: 'updateMselPage', escapes: true, call: (s: MselPageDataService) => s.update({ id: 'x-1' }) },
  ] as const)('$method leaves loading stuck when its request fails', async ({ endpoint, escapes, call }) => {
    const { service, pageApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    TestBed.inject(MselPageStore).setLoading(false);
    pageApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    expect(TestBed.inject(MselPageQuery).getValue().loading).toBe(true);
    // With no error callback the error escapes to ErrorService, the ErrorHandler
    // app.module.ts provides, which shows it.
    expect(errors).toEqual(escapes ? [failure] : []);
  });

  /**
   * Verifies: a failed request from delete escapes to the app's global ErrorHandler.
   * Interacts with: MselPageService endpoints (stubs failing), captureUnhandledRxErrors.
   * Data: each endpoint fails with "request failed".
   */
  it.each([
    { method: 'delete', endpoint: 'deleteMselPage', call: (s: MselPageDataService) => s.delete('x-1') },
  ] as const)('$method lets a failed request reach the global ErrorHandler', async ({ endpoint, call }) => {
    const { service, pageApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    pageApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    // These methods subscribe with no error callback and set no loading flag,
    // so the error escapes to ErrorService, the ErrorHandler app.module.ts
    // provides, which shows it to the user. Not a defect on its own.
    expect(errors).toEqual([failure]);
  });
});
