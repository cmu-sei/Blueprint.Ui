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
import { Organization, OrganizationService } from 'src/app/generated/blueprint.api';
import { OrganizationStore } from './organization.store';
import { OrganizationDataService } from './organization-data.service';
import { OrganizationQuery } from './organization.query';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { activatedRouteStub } from 'src/app/test-utils/activated-route';
import { recordEmissions } from 'src/app/test-utils/record-emissions';
import { captureUnhandledRxErrors, flush } from 'src/app/test-utils/unhandled-rx-errors';

function org(overrides: Partial<Organization> = {}): Organization {
  return {
    id: 'org-1',
    name: 'City Hospital',
    shortName: 'CH',
    description: 'Regional trauma center',
    mselId: 'msel-1',
    isTemplate: false,
    ...overrides,
  };
}

function setup(queryParams: Record<string, string> = {}) {
  const orgApi = {
    getOrganizationTemplates: vi.fn(() => of<Organization[]>([])),
    getOrganizationsByMsel: vi.fn(() => of<Organization[]>([])),
    getOrganization: vi.fn(() => of<Organization>({})),
    createOrganization: vi.fn(() => of<Organization>({})),
    updateOrganization: vi.fn(() => of<Organization>({})),
    deleteOrganization: vi.fn(() => of<unknown>(null)),
    downloadJsonOrganizations: vi.fn(() => of(new Blob())),
    uploadJsonOrganizations: vi.fn((): Observable<HttpEvent<Organization[]>> => EMPTY),
  } satisfies ApiStub<OrganizationService>;
  const navigate = vi.fn();
  const route = activatedRouteStub(queryParams);
  TestBed.configureTestingModule({
    providers: [
      { provide: OrganizationService, useValue: orgApi },
      { provide: Router, useValue: { navigate } satisfies Pick<Router, 'navigate'> },
      { provide: ActivatedRoute, useValue: route.route },
    ],
  });
  return {
    service: TestBed.inject(OrganizationDataService),
    query: TestBed.inject(OrganizationQuery),
    orgApi,
    navigate,
    route,
  };
}

const names = (orgs: Organization[]) => orgs.map((o) => o.name);

describe('OrganizationDataService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: loadTemplates and loadByMsel both merge into the store, so templates and MSEL organizations sit side by side.
   * Interacts with: OrganizationService.getOrganizationTemplates / getOrganizationsByMsel (stubs), real OrganizationQuery.
   * Data: one template, then one MSEL organization.
   */
  it('loadTemplates and loadByMsel merge into the store', () => {
    const { service, query, orgApi } = setup();
    orgApi.getOrganizationTemplates.mockReturnValue(
      of([org({ id: 'tmpl-1', name: 'Template Agency', isTemplate: true })]),
    );
    orgApi.getOrganizationsByMsel.mockReturnValue(of([org()]));

    service.loadTemplates();
    service.loadByMsel('msel-1');

    expect(orgApi.getOrganizationsByMsel).toHaveBeenCalledWith('msel-1');
    expect(names(query.getAll())).toEqual(['City Hospital', 'Template Agency']);
    expect(query.getValue().loading).toBe(false);
  });

  /**
   * Verifies: loadById, add and updateOrganization store what the API returns.
   * Interacts with: OrganizationService getOrganization / createOrganization / updateOrganization (stubs), real OrganizationQuery.
   * Data: org-2 fetched, org-3 created, org-2 renamed.
   */
  it('loadById, add and updateOrganization store the API result', () => {
    const { service, query, orgApi } = setup();
    orgApi.getOrganization.mockReturnValue(of(org({ id: 'org-2', name: 'Fire Dept' })));
    orgApi.createOrganization.mockReturnValue(of(org({ id: 'org-3', name: 'Police' })));
    orgApi.updateOrganization.mockReturnValue(
      of(org({ id: 'org-2', name: 'Fire & Rescue' })),
    );

    service.loadById('org-2');
    service.add(org({ id: undefined, name: 'Police' }));
    service.updateOrganization(org({ id: 'org-2', name: 'Fire & Rescue' }));

    expect(orgApi.updateOrganization).toHaveBeenCalledWith(
      'org-2',
      expect.objectContaining({ name: 'Fire & Rescue' }),
    );
    expect(names(query.getAll())).toEqual(['Fire & Rescue', 'Police']);
    expect(query.getValue().loading).toBe(false);
  });

  /**
   * Verifies: delete removes the organization once the API confirms, and unload clears the store.
   * Interacts with: OrganizationService.deleteOrganization (stub), real OrganizationQuery.
   * Data: two organizations; org-1 deleted, then the rest unloaded.
   */
  it('delete and unload remove organizations', () => {
    const { service, query, orgApi } = setup();
    service.updateStore(org());
    service.updateStore(org({ id: 'org-2', name: 'Fire Dept' }));
    orgApi.deleteOrganization.mockReturnValue(of(null));

    service.delete('org-1');
    expect(names(query.getAll())).toEqual(['Fire Dept']);

    service.unload();
    expect(query.getAll()).toEqual([]);
  });

  /**
   * Verifies: uploadJson reports progress, upserts the imported organizations, and resets progress on failure.
   * Interacts with: OrganizationService.uploadJsonOrganizations (stub emitting HTTP events), uploadProgress subject, real OrganizationQuery.
   * Data: progress 30/60, then a 200 with two organizations; then a failing upload.
   */
  it('uploadJson imports organizations with progress', () => {
    const { service, query, orgApi } = setup();
    const progress = recordEmissions(service.uploadProgress);
    const upload = new File(['[]'], 'orgs.json');
    orgApi.uploadJsonOrganizations.mockReturnValueOnce(
      of(
        { type: HttpEventType.UploadProgress, loaded: 30, total: 60 } satisfies HttpUploadProgressEvent,
        new HttpResponse({
          status: 200,
          body: [org(), org({ id: 'org-2', name: 'Fire Dept' })],
        }),
      ),
    );
    orgApi.uploadJsonOrganizations.mockReturnValueOnce(
      throwError(() => new Error('bad file')),
    );

    service.uploadJson(upload, 'events', true);
    expect(orgApi.uploadJsonOrganizations).toHaveBeenCalledWith(upload, 'events', true);
    expect(names(query.getAll())).toEqual(['City Hospital', 'Fire Dept']);

    service.uploadJson(upload, 'events', true);
    expect(progress).toEqual([50, 0, 0]);
    expect(query.getValue().loading).toBe(false);
  });

  /**
   * Verifies: downloadJson passes the selected ids to the API.
   * Interacts with: OrganizationService.downloadJsonOrganizations (stub).
   * Data: ids org-1 and org-2.
   */
  it('downloadJson requests the selected organizations', () => {
    const { service, orgApi } = setup();

    service.downloadJson(['org-1', 'org-2']);
    expect(orgApi.downloadJsonOrganizations).toHaveBeenCalledWith(['org-1', 'org-2']);
  });

  /**
   * Verifies: updateStore and deleteFromStore (the Organization SignalR targets) drive selectAll, sorted by name.
   * Interacts with: real OrganizationStore through the service, OrganizationQuery.selectAll.
   * Data: add City Hospital and Fire Dept, rename Fire Dept to "Ambulance", delete City Hospital.
   */
  it('updateStore and deleteFromStore drive the query output', () => {
    const { service, query } = setup();
    const emissions = recordEmissions(query.selectAll());

    service.updateStore(org());
    service.updateStore(org({ id: 'org-2', name: 'Fire Dept' }));
    service.updateStore({ id: 'org-2', name: 'Ambulance' });
    service.deleteFromStore('org-1');

    expect(emissions.map(names)).toEqual([
      [],
      ['City Hospital'],
      ['City Hospital', 'Fire Dept'],
      ['Ambulance', 'City Hospital'],
      ['Ambulance'],
    ]);
  });

  /**
   * Verifies: OrganizationList filters on the organizationmask query param against description or id.
   * Interacts with: ActivatedRoute.queryParamMap (stub), real OrganizationQuery.
   * Data: "Regional trauma center" and "Volunteer fire"; masks "trauma" and "org-2".
   */
  it('OrganizationList filters on the organizationmask query param', () => {
    const { service, route } = setup({ organizationmask: 'trauma' });
    service.updateStore(org());
    service.updateStore(org({ id: 'org-2', name: 'Fire Dept', description: 'Volunteer fire' }));
    const emissions = recordEmissions(service.OrganizationList);

    expect(names(emissions.at(-1))).toEqual(['City Hospital']);

    route.setQueryParams({ organizationmask: 'org-2' });
    expect(names(emissions.at(-1))).toEqual(['Fire Dept']);
  });

  /**
   * Verifies: a failed request leaves loading set for every method that sets it first (current behavior), and the ones with no error callback let the error escape.
   * Interacts with: OrganizationService endpoints (stubs failing), real OrganizationStore and OrganizationQuery, captureUnhandledRxErrors.
   * Data: loading cleared first; each endpoint fails with "request failed".
   */
  it.each([
    { method: 'loadTemplates', endpoint: 'getOrganizationTemplates', escapes: false, call: (s: OrganizationDataService) => s.loadTemplates() },
    { method: 'loadByMsel', endpoint: 'getOrganizationsByMsel', escapes: false, call: (s: OrganizationDataService) => s.loadByMsel('x-1') },
    { method: 'loadById', endpoint: 'getOrganization', escapes: true, call: (s: OrganizationDataService) => s.loadById('x-1') },
    { method: 'add', endpoint: 'createOrganization', escapes: true, call: (s: OrganizationDataService) => s.add({ id: 'x-1' }) },
    { method: 'updateOrganization', endpoint: 'updateOrganization', escapes: true, call: (s: OrganizationDataService) => s.updateOrganization({ id: 'x-1' }) },
  ] as const)('$method leaves loading stuck when its request fails', async ({ endpoint, escapes, call }) => {
    const { service, orgApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    TestBed.inject(OrganizationStore).setLoading(false);
    orgApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    expect(TestBed.inject(OrganizationQuery).getValue().loading).toBe(true);
    // An empty error callback swallows the error; with no callback it escapes to
    // ErrorService, the ErrorHandler app.module.ts provides, which shows it.
    expect(errors).toEqual(escapes ? [failure] : []);
  });

  /**
   * Verifies: a failed request from delete escapes to the app's global ErrorHandler.
   * Interacts with: OrganizationService endpoints (stubs failing), captureUnhandledRxErrors.
   * Data: each endpoint fails with "request failed".
   */
  it.each([
    { method: 'delete', endpoint: 'deleteOrganization', call: (s: OrganizationDataService) => s.delete('x-1') },
  ] as const)('$method lets a failed request reach the global ErrorHandler', async ({ endpoint, call }) => {
    const { service, orgApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    orgApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    // These methods subscribe with no error callback and set no loading flag,
    // so the error escapes to ErrorService, the ErrorHandler app.module.ts
    // provides, which shows it to the user. Not a defect on its own.
    expect(errors).toEqual([failure]);
  });
});
