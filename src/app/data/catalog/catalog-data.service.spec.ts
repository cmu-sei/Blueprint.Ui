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
import {
  Catalog,
  CatalogInject,
  CatalogInjectService,
  CatalogService,
} from 'src/app/generated/blueprint.api';
import { InjectmDataService } from '../injectm/injectm-data.service';
import { CatalogStore } from './catalog.store';
import { CatalogDataService } from './catalog-data.service';
import { CatalogQuery } from './catalog.query';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { unstubbed } from 'src/app/test-utils/unstubbed';
import { activatedRouteStub } from 'src/app/test-utils/activated-route';
import { recordEmissions } from 'src/app/test-utils/record-emissions';
import { captureUnhandledRxErrors, flush } from 'src/app/test-utils/unhandled-rx-errors';

function catalog(overrides: Partial<Catalog> = {}): Catalog {
  return {
    id: 'cat-1',
    name: 'Ransomware Catalog',
    description: 'Ransomware injects',
    injectTypeId: 'it-email',
    isPublic: false,
    ...overrides,
  };
}

function setup(queryParams: Record<string, string> = {}) {
  const catalogApi = {
    getCatalogs: vi.fn(() => of<Catalog[]>([])),
    getMyCatalogs: vi.fn(() => of<Catalog[]>([])),
    getCatalog: vi.fn(() => of(catalog())),
    createCatalog: vi.fn(() => of(catalog())),
    copyCatalog: vi.fn(() => of(catalog())),
    updateCatalog: vi.fn(() => of(catalog())),
    deleteCatalog: vi.fn(() => of<unknown>(null)),
    downloadJsonCatalog: vi.fn(() => of(new Blob())),
    uploadJsonCatalog: vi.fn((): Observable<HttpEvent<Catalog>> => EMPTY),
  } satisfies ApiStub<CatalogService>;
  const catalogInjectApi = {
    createCatalogInject: vi.fn(() => of<CatalogInject>({})),
  } satisfies ApiStub<CatalogInjectService>;
  const route = activatedRouteStub(queryParams);
  TestBed.configureTestingModule({
    providers: [
      { provide: CatalogService, useValue: catalogApi },
      { provide: CatalogInjectService, useValue: catalogInjectApi },
      // Injected but never used by CatalogDataService.
      unstubbed(InjectmDataService),
      { provide: Router, useValue: { navigate: vi.fn() } satisfies Pick<Router, 'navigate'> },
      { provide: ActivatedRoute, useValue: route.route },
    ],
  });
  return {
    service: TestBed.inject(CatalogDataService),
    query: TestBed.inject(CatalogQuery),
    catalogApi,
    catalogInjectApi,
  };
}

const names = (list: Catalog[]) => list.map((c) => c.name);

describe('CatalogDataService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: load and loadMine both merge their catalogs into the store (neither drops catalogs the other loaded).
   * Interacts with: CatalogService.getCatalogs / getMyCatalogs (stubs), real CatalogStore and CatalogQuery.
   * Data: two catalogs from load, one from loadMine.
   */
  it('load and loadMine merge catalogs', () => {
    const { service, query, catalogApi } = setup();
    catalogApi.getCatalogs.mockReturnValue(
      of([catalog(), catalog({ id: 'cat-2', name: 'Phishing Catalog' })]),
    );
    catalogApi.getMyCatalogs.mockReturnValue(of([catalog({ id: 'cat-3', name: 'My Catalog' })]));

    service.load();
    service.loadMine();

    expect(names(query.getAll())).toEqual([
      'My Catalog',
      'Phishing Catalog',
      'Ransomware Catalog',
    ]);
    expect(query.getValue().loading).toBe(false);
  });

  /**
   * Verifies: loadById, add, copy and update store the API result; delete removes after confirmation; unload clears.
   * Interacts with: CatalogService get / create / copy / update / delete (stubs), real CatalogQuery.
   * Data: cat-2 fetched, cat-3 created, cat-3 copied to cat-4, cat-2 renamed, cat-3 deleted.
   */
  it('single-catalog calls keep the store in step with the API', () => {
    const { service, query, catalogApi } = setup();
    catalogApi.getCatalog.mockReturnValue(of(catalog({ id: 'cat-2', name: 'Phishing Catalog' })));
    catalogApi.createCatalog.mockReturnValue(of(catalog({ id: 'cat-3', name: 'Insider Catalog' })));
    catalogApi.copyCatalog.mockReturnValue(of(catalog({ id: 'cat-4', name: 'Insider Catalog - Copy' })));
    catalogApi.updateCatalog.mockReturnValue(of(catalog({ id: 'cat-2', name: 'Phishing v2' })));
    catalogApi.deleteCatalog.mockReturnValue(of(null));

    service.loadById('cat-2');
    service.add(catalog({ id: undefined, name: 'Insider Catalog' }));
    service.copy('cat-3');
    service.update(catalog({ id: 'cat-2', name: 'edited' }));
    expect(catalogApi.copyCatalog).toHaveBeenCalledWith('cat-3');
    expect(catalogApi.updateCatalog).toHaveBeenCalledWith(
      'cat-2',
      expect.objectContaining({ name: 'edited' }),
    );
    expect(names(query.getAll())).toEqual([
      'Insider Catalog',
      'Insider Catalog - Copy',
      'Phishing v2',
    ]);

    service.delete('cat-3');
    expect(names(query.getAll())).toEqual(['Insider Catalog - Copy', 'Phishing v2']);

    service.unload();
    expect(query.getAll()).toEqual([]);
  });

  /**
   * Verifies: addInjectToCatalog creates a catalog-inject link with the given display order and leaves the catalog store alone.
   * Interacts with: CatalogInjectService.createCatalogInject (stub), real CatalogQuery.
   * Data: inject inj-1 added to cat-1 at position 4.
   */
  it('addInjectToCatalog creates the link', () => {
    const { service, query, catalogInjectApi } = setup();
    service.updateStore(catalog());
    catalogInjectApi.createCatalogInject.mockReturnValue(of({ id: 'ci-1' }));

    service.addInjectToCatalog('cat-1', 'inj-1', 4);

    expect(catalogInjectApi.createCatalogInject).toHaveBeenCalledWith({
      catalogId: 'cat-1',
      injectId: 'inj-1',
      isNew: false,
      displayOrder: 4,
    });
    expect(names(query.getAll())).toEqual(['Ransomware Catalog']);
  });

  /**
   * Verifies: uploadJson imports one catalog with progress, a failure resets progress, and downloadJson requests the given ids.
   * Interacts with: CatalogService.uploadJsonCatalog / downloadJsonCatalog (stubs), uploadProgress subject, real CatalogQuery.
   * Data: progress 1/5 and a 200 with a catalog, then a failure.
   */
  it('uploadJson imports a catalog with progress', () => {
    const { service, query, catalogApi } = setup();
    const progress = recordEmissions(service.uploadProgress);
    catalogApi.uploadJsonCatalog.mockReturnValueOnce(
      of(
        { type: HttpEventType.UploadProgress, loaded: 1, total: 5 } satisfies HttpUploadProgressEvent,
        new HttpResponse({ status: 200, body: catalog({ id: 'cat-up', name: 'Uploaded' }) }),
      ),
    );
    catalogApi.uploadJsonCatalog.mockReturnValueOnce(throwError(() => new Error('bad')));

    service.uploadJson(new File(['{}'], 'catalog.json'), 'events', true);
    service.uploadJson(new File(['{}'], 'catalog.json'), 'events', true);

    expect(names(query.getAll())).toEqual(['Uploaded']);
    expect(progress).toEqual([20, 0, 0]);
    expect(query.getValue().loading).toBe(false);
    service.downloadJson('cat-up');
    expect(catalogApi.downloadJsonCatalog).toHaveBeenCalledWith('cat-up');
  });

  /**
   * Verifies: updateStore/deleteFromStore (the Catalog SignalR targets) and setActive drive the queries; CatalogList filters on the id.
   * Interacts with: real CatalogStore through the service, CatalogQuery.selectAll / selectActive.
   * Data: two catalogs, one activated and renamed, the other deleted.
   */
  it('updateStore, deleteFromStore and setActive drive the queries', async () => {
    const { service, query } = setup();
    const emissions = recordEmissions(query.selectAll());

    service.updateStore(catalog());
    service.updateStore(catalog({ id: 'cat-2', name: 'Phishing Catalog' }));
    service.setActive('cat-2');
    service.updateStore({ id: 'cat-2', name: 'Zero-day Catalog' });
    service.deleteFromStore('cat-1');

    expect(emissions.map(names)).toEqual([
      [],
      ['Ransomware Catalog'],
      ['Phishing Catalog', 'Ransomware Catalog'],
      ['Ransomware Catalog', 'Zero-day Catalog'],
      ['Zero-day Catalog'],
    ]);
    const active$ = query.selectActive() as Observable<Catalog>;
    expect((await firstValueFrom(active$)).name).toBe('Zero-day Catalog');
  });

  /**
   * Verifies: CatalogList filters on the catalogmask query param against the id.
   * Interacts with: ActivatedRoute.queryParamMap (stub), real CatalogQuery.
   * Data: cat-1 and cat-2; mask "cat-2".
   */
  it('CatalogList filters on the id', () => {
    const { service } = setup({ catalogmask: 'cat-2' });
    service.updateStore(catalog());
    service.updateStore(catalog({ id: 'cat-2', name: 'Phishing Catalog' }));

    expect(names(recordEmissions(service.CatalogList).at(-1))).toEqual(['Phishing Catalog']);
  });

  /**
   * Verifies: a failed request leaves loading set for every method that sets it first (current behavior), and the ones with no error callback let the error escape.
   * Interacts with: CatalogService endpoints (stubs failing), real CatalogStore and CatalogQuery, captureUnhandledRxErrors.
   * Data: loading cleared first; each endpoint fails with "request failed".
   */
  it.each([
    { method: 'load', endpoint: 'getCatalogs', escapes: false, call: (s: CatalogDataService) => s.load() },
    { method: 'loadMine', endpoint: 'getMyCatalogs', escapes: false, call: (s: CatalogDataService) => s.loadMine() },
    { method: 'loadById', endpoint: 'getCatalog', escapes: true, call: (s: CatalogDataService) => s.loadById('x-1') },
    { method: 'add', endpoint: 'createCatalog', escapes: true, call: (s: CatalogDataService) => s.add({ id: 'x-1' }) },
    { method: 'update', endpoint: 'updateCatalog', escapes: true, call: (s: CatalogDataService) => s.update({ id: 'x-1' }) },
  ] as const)('$method leaves loading stuck when its request fails', async ({ endpoint, escapes, call }) => {
    const { service, catalogApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    TestBed.inject(CatalogStore).setLoading(false);
    catalogApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    expect(TestBed.inject(CatalogQuery).getValue().loading).toBe(true);
    // An empty error callback swallows the error; with no callback it escapes to
    // ErrorService, the ErrorHandler app.module.ts provides, which shows it.
    expect(errors).toEqual(escapes ? [failure] : []);
  });

  /**
   * Verifies: a failed request from copy, delete escapes to the app's global ErrorHandler.
   * Interacts with: CatalogService endpoints (stubs failing), captureUnhandledRxErrors.
   * Data: each endpoint fails with "request failed".
   */
  it.each([
    { method: 'copy', endpoint: 'copyCatalog', call: (s: CatalogDataService) => s.copy('x-1') },
    { method: 'delete', endpoint: 'deleteCatalog', call: (s: CatalogDataService) => s.delete('x-1') },
  ] as const)('$method lets a failed request reach the global ErrorHandler', async ({ endpoint, call }) => {
    const { service, catalogApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    catalogApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    // These methods subscribe with no error callback and set no loading flag,
    // so the error escapes to ErrorService, the ErrorHandler app.module.ts
    // provides, which shows it to the user. Not a defect on its own.
    expect(errors).toEqual([failure]);
  });

  /**
   * Verifies: a failed addInjectToCatalog escapes to the app's global ErrorHandler.
   * Interacts with: CatalogInjectService.createCatalogInject (stub failing), captureUnhandledRxErrors.
   * Data: the link request fails with "request failed".
   */
  it('addInjectToCatalog lets a failed request reach the global ErrorHandler', async () => {
    const { service, catalogInjectApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    catalogInjectApi.createCatalogInject.mockReturnValue(throwError(() => failure));

    service.addInjectToCatalog('cat-1', 'inj-1', 1);
    await flush();

    // No error callback and no loading flag: ErrorService, the ErrorHandler
    // app.module.ts provides, shows the error. Not a defect on its own.
    expect(errors).toEqual([failure]);
  });
});
