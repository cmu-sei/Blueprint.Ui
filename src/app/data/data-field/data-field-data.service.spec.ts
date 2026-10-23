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
import { DataField, DataFieldService, DataFieldType } from 'src/app/generated/blueprint.api';
import { DataFieldStore } from './data-field.store';
import { DataFieldTemplateStore } from './data-field-template.store';
import { DataFieldDataService } from './data-field-data.service';
import { DataFieldQuery } from './data-field.query';
import { DataFieldTemplateQuery } from './data-field-template.query';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { activatedRouteStub } from 'src/app/test-utils/activated-route';
import { recordEmissions } from 'src/app/test-utils/record-emissions';
import { captureUnhandledRxErrors, flush } from 'src/app/test-utils/unhandled-rx-errors';

function field(overrides: Partial<DataField> = {}): DataField {
  return {
    id: 'df-1',
    mselId: 'msel-1',
    name: 'Title',
    dataType: DataFieldType.String,
    displayOrder: 1,
    isTemplate: false,
    ...overrides,
  };
}

function template(overrides: Partial<DataField> = {}): DataField {
  return field({
    id: 'tmpl-1',
    mselId: null,
    name: 'Template Field',
    isTemplate: true,
    ...overrides,
  });
}

function setup(queryParams: Record<string, string> = {}) {
  const dataFieldApi = {
    getDataFieldTemplates: vi.fn(() => of<DataField[]>([])),
    getDataFieldsByMsel: vi.fn(() => of<DataField[]>([])),
    getDataFieldsByInjectType: vi.fn(() => of<DataField[]>([])),
    createDataField: vi.fn((dataField: DataField) => of({ ...dataField })),
    updateDataField: vi.fn((_id: string, dataField: DataField) => of({ ...dataField })),
    deleteDataField: vi.fn(() => of('')),
    downloadJsonDataFields: vi.fn(() => of(new Blob())),
    uploadJsonDataFields: vi.fn((): Observable<HttpEvent<DataField[]>> => EMPTY),
  } satisfies ApiStub<DataFieldService>;
  const navigate = vi.fn();
  const route = activatedRouteStub(queryParams);
  TestBed.configureTestingModule({
    providers: [
      { provide: DataFieldService, useValue: dataFieldApi },
      { provide: Router, useValue: { navigate } satisfies Pick<Router, 'navigate'> },
      { provide: ActivatedRoute, useValue: route.route },
    ],
  });
  return {
    service: TestBed.inject(DataFieldDataService),
    query: TestBed.inject(DataFieldQuery),
    templateQuery: TestBed.inject(DataFieldTemplateQuery),
    dataFieldApi,
    navigate,
    route,
  };
}

const names = (list: DataField[]) => list.map((f) => f.name);

describe('DataFieldDataService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: templates load into their own store, MSEL fields replace the field store, and inject-type fields merge into it.
   * Interacts with: DataFieldService getDataFieldTemplates / getDataFieldsByMsel / getDataFieldsByInjectType (stubs), real DataFieldQuery and DataFieldTemplateQuery.
   * Data: one template, two MSEL fields (one stale field present), one inject-type field.
   */
  it('keeps templates and MSEL fields in separate stores', () => {
    const { service, query, templateQuery, dataFieldApi } = setup();
    service.updateStore(field({ id: 'stale', name: 'Stale' }));
    dataFieldApi.getDataFieldTemplates.mockReturnValue(of([template()]));
    dataFieldApi.getDataFieldsByMsel.mockReturnValue(
      of([field(), field({ id: 'df-2', name: 'Assigned To', dataType: DataFieldType.Team })]),
    );
    dataFieldApi.getDataFieldsByInjectType.mockReturnValue(
      of([field({ id: 'df-it', name: 'Inject Body', injectTypeId: 'it-1' })]),
    );

    service.loadTemplates();
    service.loadByMsel('msel-1');
    service.loadByInjectType('it-1');

    expect(names(templateQuery.getAll())).toEqual(['Template Field']);
    expect(dataFieldApi.getDataFieldsByMsel).toHaveBeenCalledWith('msel-1');
    expect(dataFieldApi.getDataFieldsByInjectType).toHaveBeenCalledWith('it-1');
    expect(names(query.getAll())).toEqual(['Assigned To', 'Inject Body', 'Title']);
    expect(query.getValue().loading).toBe(false);
    expect(templateQuery.getValue().loading).toBe(false);
  });

  /**
   * Verifies: a failed loadByMsel empties the field store and clears its loading flag.
   * Interacts with: DataFieldService.getDataFieldsByMsel (stub erroring), real DataFieldQuery.
   * Data: one stored MSEL field.
   */
  it('a failed loadByMsel empties the field store', () => {
    const { service, query, dataFieldApi } = setup();
    service.updateStore(field());
    dataFieldApi.getDataFieldsByMsel.mockReturnValue(throwError(() => new Error('boom')));

    service.loadByMsel('msel-1');

    expect(query.getAll()).toEqual([]);
    expect(query.getValue().loading).toBe(false);
  });

  /**
   * Verifies: add and updateDataField route the API result to the template store or the field store by isTemplate.
   * Interacts with: DataFieldService.createDataField / updateDataField (stubs), both queries.
   * Data: a template created and renamed; an MSEL field created and renamed.
   */
  it('add and updateDataField route by isTemplate', () => {
    const { service, query, templateQuery, dataFieldApi } = setup();
    dataFieldApi.createDataField.mockImplementation((df: DataField) =>
      of({ ...df, id: df.isTemplate ? 'tmpl-1' : 'df-1' }),
    );
    dataFieldApi.updateDataField.mockImplementation((_id: string, df: DataField) =>
      of({ ...df, name: `${df.name} (saved)` }),
    );

    service.add(template({ id: undefined }));
    service.add(field({ id: undefined }));
    service.updateDataField(template({ name: 'Renamed Template' }));
    service.updateDataField(field({ name: 'Renamed Field' }));

    expect(names(templateQuery.getAll())).toEqual(['Renamed Template (saved)']);
    expect(names(query.getAll())).toEqual(['Renamed Field (saved)']);
    expect(query.getValue().loading).toBe(false);
    expect(templateQuery.getValue().loading).toBe(false);
  });

  /**
   * Verifies: delete removes the id the API returns from both stores, and deleteFromStore does the same for SignalR.
   * Interacts with: DataFieldService.deleteDataField (stub), both queries.
   * Data: a template and two fields; the API confirms tmpl-1, then df-2 is removed by event.
   */
  it('delete removes the confirmed id from both stores', () => {
    const { service, query, templateQuery, dataFieldApi } = setup();
    service.updateStore(template());
    service.updateStore(field());
    service.updateStore(field({ id: 'df-2', name: 'Assigned To' }));
    dataFieldApi.deleteDataField.mockReturnValue(of('tmpl-1'));

    service.delete('tmpl-1');
    expect(templateQuery.getAll()).toEqual([]);
    expect(names(query.getAll())).toEqual(['Assigned To', 'Title']);

    service.deleteFromStore('df-2');
    expect(names(query.getAll())).toEqual(['Title']);

    service.unload();
    expect(query.getAll()).toEqual([]);
  });

  /**
   * Verifies: updateStore (the DataField SignalR target) upserts templates and MSEL fields into their own stores.
   * Interacts with: real DataFieldStore and DataFieldTemplateStore, both queries.
   * Data: a template event and an MSEL-field event, then an update to the field.
   */
  it('updateStore routes events by isTemplate', () => {
    const { service, query, templateQuery } = setup();
    const fieldEmissions = recordEmissions(query.selectAll());

    service.updateStore(template());
    service.updateStore(field());
    service.updateStore({ id: 'df-1', name: 'Headline', isTemplate: false });

    expect(names(templateQuery.getAll())).toEqual(['Template Field']);
    expect(fieldEmissions.map(names)).toEqual([[], ['Title'], ['Headline']]);
  });

  /**
   * Verifies: uploadJson imports templates (into the template store) with progress, and a failure resets progress; downloadJson requests the given ids.
   * Interacts with: DataFieldService.uploadJsonDataFields / downloadJsonDataFields (stubs), uploadProgress subject, DataFieldTemplateQuery.
   * Data: progress 5/10 and a 200 with one template, then a failure.
   */
  it('uploadJson imports templates with progress', () => {
    const { service, templateQuery, dataFieldApi } = setup();
    const progress = recordEmissions(service.uploadProgress);
    dataFieldApi.uploadJsonDataFields.mockReturnValueOnce(
      of(
        { type: HttpEventType.UploadProgress, loaded: 5, total: 10 } satisfies HttpUploadProgressEvent,
        new HttpResponse({ status: 200, body: [template()] }),
      ),
    );
    dataFieldApi.uploadJsonDataFields.mockReturnValueOnce(throwError(() => new Error('bad')));

    service.uploadJson(new File(['[]'], 'fields.json'), 'events', true);
    service.uploadJson(new File(['[]'], 'fields.json'), 'events', true);

    expect(names(templateQuery.getAll())).toEqual(['Template Field']);
    expect(progress).toEqual([50, 0, 0]);
    expect(templateQuery.getValue().loading).toBe(false);
    service.downloadJson(['tmpl-1']);
    expect(dataFieldApi.downloadJsonDataFields).toHaveBeenCalledWith(['tmpl-1']);
  });

  /**
   * Verifies: DataFieldList filters on the dataFieldmask query param against the id only.
   * Interacts with: ActivatedRoute.queryParamMap (stub), real DataFieldQuery.
   * Data: fields df-1 "Title" and df-2 "Assigned To"; masks "df-2" and "title".
   */
  it('DataFieldList filters on the id only', () => {
    const { service, route } = setup({ dataFieldmask: 'df-2' });
    service.updateStore(field());
    service.updateStore(field({ id: 'df-2', name: 'Assigned To' }));
    const emissions = recordEmissions(service.DataFieldList);

    expect(names(emissions.at(-1))).toEqual(['Assigned To']);

    route.setQueryParams({ dataFieldmask: 'title' });
    expect(emissions.at(-1)).toEqual([]);
  });

  /**
   * Verifies: a failed request leaves the loading flag of the store it targets set (current behavior), and the methods with no error callback let the error escape.
   * Interacts with: DataFieldService endpoints (stubs failing), real DataFieldStore/DataFieldQuery and DataFieldTemplateStore/DataFieldTemplateQuery, captureUnhandledRxErrors.
   * Data: both loading flags cleared first; each endpoint fails with "request failed"; add and updateDataField get a template and an MSEL field.
   */
  it.each([
    { method: 'loadTemplates', endpoint: 'getDataFieldTemplates', target: 'template', escapes: false, call: (s: DataFieldDataService) => s.loadTemplates() },
    { method: 'loadByInjectType', endpoint: 'getDataFieldsByInjectType', target: 'field', escapes: true, call: (s: DataFieldDataService) => s.loadByInjectType('it-1') },
    { method: 'add (template)', endpoint: 'createDataField', target: 'template', escapes: true, call: (s: DataFieldDataService) => s.add(template()) },
    { method: 'add (MSEL field)', endpoint: 'createDataField', target: 'field', escapes: true, call: (s: DataFieldDataService) => s.add(field()) },
    { method: 'updateDataField (template)', endpoint: 'updateDataField', target: 'template', escapes: true, call: (s: DataFieldDataService) => s.updateDataField(template()) },
    { method: 'updateDataField (MSEL field)', endpoint: 'updateDataField', target: 'field', escapes: true, call: (s: DataFieldDataService) => s.updateDataField(field()) },
  ] as const)('$method leaves loading stuck when its request fails', async ({ endpoint, target, escapes, call }) => {
    const { service, query, templateQuery, dataFieldApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    TestBed.inject(DataFieldStore).setLoading(false);
    TestBed.inject(DataFieldTemplateStore).setLoading(false);
    dataFieldApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    const [stuck, untouched] = target === 'template' ? [templateQuery, query] : [query, templateQuery];
    expect(stuck.getValue().loading).toBe(true);
    expect(untouched.getValue().loading).toBe(false);
    // An empty error callback swallows the error; with no callback it escapes to
    // ErrorService, the ErrorHandler app.module.ts provides, which shows it.
    expect(errors).toEqual(escapes ? [failure] : []);
  });

  /**
   * Verifies: a failed delete escapes to the app's global ErrorHandler.
   * Interacts with: DataFieldService.deleteDataField (stub failing), captureUnhandledRxErrors.
   * Data: the endpoint fails with "request failed".
   */
  it('delete lets a failed request reach the global ErrorHandler', async () => {
    const { service, dataFieldApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    dataFieldApi.deleteDataField.mockReturnValue(throwError(() => failure));

    service.delete('x-1');
    await flush();

    // No error callback and no loading flag: ErrorService, the ErrorHandler
    // app.module.ts provides, shows the error. Not a defect on its own.
    expect(errors).toEqual([failure]);
  });
});

describe('DataFieldTemplateQuery', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: the template query sorts by name and selects by id.
   * Interacts with: real DataFieldTemplateStore and DataFieldTemplateQuery via DataFieldDataService.updateStore.
   * Data: templates "Zulu" and "Alpha".
   */
  it('sorts templates by name and selects by id', () => {
    const { service, templateQuery } = setup();
    service.updateStore(template({ id: 'z', name: 'Zulu' }));
    service.updateStore(template({ id: 'a', name: 'Alpha' }));

    const sorted = recordEmissions(templateQuery.selectAll()).at(-1);
    const byId = recordEmissions(templateQuery.selectById('z')).at(-1);

    expect(names(sorted)).toEqual(['Alpha', 'Zulu']);
    expect(byId.name).toBe('Zulu');
  });
});
