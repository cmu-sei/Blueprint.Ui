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
  Msel,
  MselItemStatus,
  MselRole,
  MselService,
} from 'src/app/generated/blueprint.api';
import { ErrorService } from 'src/app/services/error/error.service';
import { MselDataService } from './msel-data.service';
import { MselQuery } from './msel.query';
import { MselStore } from './msel.store';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { activatedRouteStub } from 'src/app/test-utils/activated-route';
import { recordEmissions } from 'src/app/test-utils/record-emissions';
import { captureUnhandledRxErrors, flush } from 'src/app/test-utils/unhandled-rx-errors';

function msel(overrides: Partial<Msel> = {}): Msel {
  return {
    id: 'msel-1',
    name: 'Exercise Alpha',
    description: 'Alpha description',
    status: MselItemStatus.Pending,
    dateCreated: '2026-01-01T00:00:00Z' as unknown as Date,
    dateModified: '2026-01-02T00:00:00Z' as unknown as Date,
    startTime: '2026-02-01T12:00:00Z' as unknown as Date,
    ...overrides,
  };
}

function setup(queryParams: Record<string, string> = {}) {
  const mselApi = {
    ...({
      getMsels: vi.fn(() => of<Msel[]>([])),
      getMyMsels: vi.fn(() => of<Msel[]>([])),
      getMsel: vi.fn(() => of(msel())),
      createMsel: vi.fn(() => of(msel())),
      copyMsel: vi.fn(() => of(msel())),
      updateMsel: vi.fn(() => of(msel())),
      pushIntegrations: vi.fn(() => of(msel())),
      pullIntegrations: vi.fn(() => of(msel())),
      cancelIntegrations: vi.fn(() => of<unknown>(null)),
      archive: vi.fn(() => of(msel())),
      deleteMsel: vi.fn(() => of<unknown>(null)),
      addUserMselRole: vi.fn(() => of(msel())),
      removeUserMselRole: vi.fn(() => of(msel())),
      getMyJoinMsels: vi.fn(() => of<Msel[]>([])),
      getMyLaunchMsels: vi.fn(() => of<Msel[]>([])),
      joinMselByInvitation: vi.fn(() => of(msel())),
      launchMselByInvitation: vi.fn(() => of(msel())),
      downloadXlsx: vi.fn(() => of(new Blob())),
      downloadJsonMsel: vi.fn(() => of(new Blob())),
      uploadJsonMsel: vi.fn((): Observable<HttpEvent<Msel>> => EMPTY),
      // POST msels/xlsx documents no body type (the client says any); it returns the MSEL.
      uploadXlsx: vi.fn((): Observable<HttpEvent<Msel>> => EMPTY),
    } satisfies ApiStub<MselService>),
    // Outside ApiStub because the generated type is wrong: its 'events'
    // overload says HttpEvent<string>, and the stub is typed to what the API sends.
    replaceWithXlsxFile: vi.fn((): Observable<HttpEvent<Msel>> => EMPTY),
  };
  const handleError = vi.fn();
  const navigate = vi.fn();
  const route = activatedRouteStub(queryParams);
  TestBed.configureTestingModule({
    providers: [
      { provide: MselService, useValue: mselApi },
      { provide: ErrorService, useValue: { handleError } satisfies Pick<ErrorService, 'handleError'> },
      { provide: Router, useValue: { navigate } satisfies Pick<Router, 'navigate'> },
      { provide: ActivatedRoute, useValue: route.route },
    ],
  });
  return {
    service: TestBed.inject(MselDataService),
    query: TestBed.inject(MselQuery),
    store: TestBed.inject(MselStore),
    mselApi,
    handleError,
    navigate,
    route,
  };
}

const file = () => new File(['data'], 'msel.xlsx');

describe('MselDataService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  describe('loading', () => {
    /**
     * Verifies: load replaces the store with every MSEL from the API, parsing the date fields, and stops loading.
     * Interacts with: MselService.getMsels (stub), real MselStore and MselQuery.
     * Data: two MSELs whose dates arrive as ISO strings.
     */
    it('load stores all MSELs with parsed dates', () => {
      const { service, query, mselApi } = setup();
      mselApi.getMsels.mockReturnValue(
        of([msel(), msel({ id: 'msel-2', name: 'Exercise Bravo' })]),
      );

      service.load();

      const msels = query.getAll();
      expect(msels.map((m) => m.name)).toEqual([
        'Exercise Alpha',
        'Exercise Bravo',
      ]);
      expect(msels[0].dateCreated).toEqual(new Date('2026-01-01T00:00:00Z'));
      expect(msels[0].startTime).toEqual(new Date('2026-02-01T12:00:00Z'));
      expect(query.getValue().loading).toBe(false);
    });

    /**
     * Verifies: setAsDates turns a null dateModified into the Unix epoch instead of leaving it empty.
     * Interacts with: MselService.getMsels (stub), MselDataService.setAsDates.
     * Data: an MSEL that has never been modified (dateModified null).
     */
    it('load turns a null dateModified into the epoch', () => {
      const { service, query, mselApi } = setup();
      mselApi.getMsels.mockReturnValue(of([msel({ dateModified: null })]));

      service.load();

      expect(query.getEntity('msel-1').dateModified).toEqual(new Date(0));
    });

    /**
     * Verifies: a failed load empties the store and clears the loading flag.
     * Interacts with: MselService.getMsels (stub erroring), real MselQuery.
     * Data: one MSEL already stored before the failing call.
     */
    it('load empties the store when the API fails', () => {
      const { service, query, mselApi } = setup();
      service.updateStore(msel());
      mselApi.getMsels.mockReturnValue(throwError(() => new Error('boom')));

      service.load();

      expect(query.getAll()).toEqual([]);
      expect(query.getValue().loading).toBe(false);
    });

    /**
     * Verifies: loadMine loads the caller's MSELs from getMyMsels, and empties the store on failure.
     * Interacts with: MselService.getMyMsels (stub), real MselQuery.
     * Data: one MSEL, then an API error.
     */
    it('loadMine stores the caller\'s MSELs and empties the store on failure', () => {
      const { service, query, mselApi } = setup();
      mselApi.getMyMsels.mockReturnValueOnce(of([msel()]));
      mselApi.getMyMsels.mockReturnValueOnce(
        throwError(() => new Error('boom')),
      );

      service.loadMine();
      expect(query.getAll().map((m) => m.id)).toEqual(['msel-1']);

      service.loadMine();
      expect(query.getAll()).toEqual([]);
      expect(query.getValue().loading).toBe(false);
    });

    /**
     * Verifies: loadById upserts the full MSEL into the store without touching the other MSELs.
     * Interacts with: MselService.getMsel (stub), real MselQuery.
     * Data: msel-2 already stored; msel-1 fetched with its moves.
     */
    it('loadById upserts the MSEL', () => {
      const { service, query, mselApi } = setup();
      service.updateStore(msel({ id: 'msel-2', name: 'Exercise Bravo' }));
      mselApi.getMsel.mockReturnValue(
        of(msel({ moves: [{ id: 'move-1', mselId: 'msel-1' }] })),
      );

      service.loadById('msel-1');

      expect(mselApi.getMsel).toHaveBeenCalledWith('msel-1');
      expect(query.getAll().map((m) => m.id)).toEqual(['msel-1', 'msel-2']);
      expect(query.getEntity('msel-1').moves).toHaveLength(1);
    });

    /**
     * Verifies: a failed loadById leaves the store alone and clears the loading flag.
     * Interacts with: MselService.getMsel (stub erroring), real MselQuery.
     * Data: one stored MSEL.
     */
    it('loadById stops loading when the API fails', () => {
      const { service, query, mselApi } = setup();
      service.updateStore(msel());
      mselApi.getMsel.mockReturnValue(throwError(() => new Error('boom')));

      service.loadById('msel-1');

      expect(query.getAll()).toHaveLength(1);
      expect(query.getValue().loading).toBe(false);
    });

    /**
     * Verifies: unload clears every MSEL from the store.
     * Interacts with: real MselQuery.
     * Data: one stored MSEL.
     */
    it('unload clears the store', () => {
      const { service, query } = setup();
      service.updateStore(msel());

      service.unload();

      expect(query.getAll()).toEqual([]);
    });
  });

  describe('create, copy and update', () => {
    /**
     * Verifies: add returns a cold observable — the store is untouched until the caller subscribes — and then stores the created MSEL.
     * Interacts with: MselService.createMsel (stub), real MselQuery.
     * Data: a new MSEL without an id; the API returns it as msel-1.
     */
    it('add stores the created MSEL only once the caller subscribes', async () => {
      const { service, query, mselApi } = setup();
      mselApi.createMsel.mockReturnValue(of(msel()));

      const created$ = service.add(msel({ id: undefined }));
      expect(query.getAll()).toEqual([]);

      const created = await firstValueFrom(created$);

      expect(created.id).toBe('msel-1');
      expect(query.getAll().map((m) => m.id)).toEqual(['msel-1']);
      expect(query.getValue().loading).toBe(false);
    });

    /**
     * Verifies: copy adds the API's copy of the MSEL alongside the original.
     * Interacts with: MselService.copyMsel (stub), real MselQuery.
     * Data: msel-1 stored; the API returns msel-2 as its copy.
     */
    it('copy adds the copied MSEL', () => {
      const { service, query, mselApi } = setup();
      service.updateStore(msel());
      mselApi.copyMsel.mockReturnValue(
        of(msel({ id: 'msel-2', name: 'Exercise Alpha - Copy' })),
      );

      service.copy('msel-1');

      expect(mselApi.copyMsel).toHaveBeenCalledWith('msel-1');
      expect(query.getEntity('msel-2').name).toBe('Exercise Alpha - Copy');
      expect(query.getAll()).toHaveLength(2);
    });

    /**
     * Verifies: updateMsel issues a single PUT even when the caller also subscribes, stores the result, and replays it to the caller.
     * Interacts with: MselService.updateMsel (stub), real MselQuery, ErrorService (spy).
     * Data: msel-1 renamed by the API to "Server Name".
     */
    it('updateMsel saves once, stores the result and replays it to the caller', async () => {
      const { service, query, mselApi, handleError } = setup();
      service.updateStore(msel());
      mselApi.updateMsel.mockReturnValue(of(msel({ name: 'Server Name' })));

      const result = await firstValueFrom(
        service.updateMsel(msel({ name: 'Client Name' })),
      );

      expect(mselApi.updateMsel).toHaveBeenCalledTimes(1);
      expect(mselApi.updateMsel).toHaveBeenCalledWith(
        'msel-1',
        expect.objectContaining({ name: 'Client Name' }),
      );
      expect(result.name).toBe('Server Name');
      expect(query.getEntity('msel-1').name).toBe('Server Name');
      expect(query.getValue().loading).toBe(false);
      expect(handleError).not.toHaveBeenCalled();
    });

    /**
     * Verifies: a failed updateMsel reports the error once, errors the caller's subscription, and leaves the stored MSEL unchanged.
     * Interacts with: MselService.updateMsel (stub erroring), ErrorService.handleError (spy), real MselQuery.
     * Data: msel-1 stored as "Exercise Alpha"; the PUT fails with a 409.
     */
    it('updateMsel surfaces a failed save to the user and the caller', async () => {
      const { service, query, mselApi, handleError } = setup();
      service.updateStore(msel());
      const failure = { status: 409 };
      mselApi.updateMsel.mockReturnValue(throwError(() => failure));

      const update$ = service.updateMsel(msel({ name: 'Client Name' }));

      await expect(firstValueFrom(update$)).rejects.toBe(failure);
      expect(handleError).toHaveBeenCalledTimes(1);
      expect(handleError).toHaveBeenCalledWith(failure);
      expect(mselApi.updateMsel).toHaveBeenCalledTimes(1);
      expect(query.getEntity('msel-1').name).toBe('Exercise Alpha');
      expect(query.getValue().loading).toBe(false);
    });

    /**
     * Verifies: archive stores the MSEL the API returns, with its archived status.
     * Interacts with: MselService.archive (stub), real MselQuery.
     * Data: msel-1 Pending; the API returns it Archived.
     */
    it('archive stores the archived MSEL', () => {
      const { service, query, mselApi } = setup();
      service.updateStore(msel());
      mselApi.archive.mockReturnValue(
        of(msel({ status: MselItemStatus.Archived })),
      );

      service.archive('msel-1');

      expect(query.getEntity('msel-1').status).toBe(MselItemStatus.Archived);
    });

    /**
     * Verifies: delete removes the MSEL once the API confirms.
     * Interacts with: MselService.deleteMsel (stub), real MselQuery.
     * Data: two stored MSELs; msel-1 deleted.
     */
    it('delete removes the MSEL', () => {
      const { service, query, mselApi } = setup();
      service.updateStore(msel());
      service.updateStore(msel({ id: 'msel-2' }));
      mselApi.deleteMsel.mockReturnValue(of(null));

      service.delete('msel-1');

      expect(query.getAll().map((m) => m.id)).toEqual(['msel-2']);
    });

    /**
     * Verifies: addUserMselRole and removeUserMselRole store the MSEL the API returns with the changed role list.
     * Interacts with: MselService.addUserMselRole / removeUserMselRole (stubs), real MselQuery.
     * Data: user-1 granted Editor on msel-1, then the role removed.
     */
    it('adding and removing a user role stores the updated MSEL', () => {
      const { service, query, mselApi } = setup();
      service.updateStore(msel());
      const editorRole = {
        id: 'umr-1',
        userId: 'user-1',
        mselId: 'msel-1',
        role: MselRole.Editor,
      };
      mselApi.addUserMselRole.mockReturnValue(
        of(msel({ userMselRoles: [editorRole] })),
      );
      mselApi.removeUserMselRole.mockReturnValue(
        of(msel({ userMselRoles: [] })),
      );

      service.addUserMselRole('user-1', 'msel-1', MselRole.Editor);
      expect(mselApi.addUserMselRole).toHaveBeenCalledWith(
        'user-1',
        'msel-1',
        MselRole.Editor,
      );
      expect(query.getEntity('msel-1').userMselRoles).toEqual([editorRole]);

      service.removeUserMselRole('user-1', 'msel-1', MselRole.Editor);
      expect(query.getEntity('msel-1').userMselRoles).toEqual([]);
      expect(query.getValue().loading).toBe(false);
    });

    /**
     * Verifies: a failed role change leaves the MSEL unchanged and clears the loading flag.
     * Interacts with: MselService.addUserMselRole / removeUserMselRole (stubs erroring), real MselQuery.
     * Data: msel-1 stored without roles; the endpoint fails with "boom".
     */
    it.each([
      { method: 'addUserMselRole', endpoint: 'addUserMselRole', call: (s: MselDataService) => s.addUserMselRole('user-1', 'msel-1', MselRole.Editor) },
      { method: 'removeUserMselRole', endpoint: 'removeUserMselRole', call: (s: MselDataService) => s.removeUserMselRole('user-1', 'msel-1', MselRole.Editor) },
    ] as const)('a failed $method leaves the MSEL unchanged', ({ endpoint, call }) => {
      const { service, query, mselApi } = setup();
      service.updateStore(msel());
      mselApi[endpoint].mockReturnValue(throwError(() => new Error('boom')));

      call(service);

      expect(query.getEntity('msel-1').userMselRoles).toBeUndefined();
      expect(query.getValue().loading).toBe(false);
    });
  });

  describe('integrations', () => {
    /**
     * Verifies: pushIntegrations and pullIntegrations store the MSEL the API returns.
     * Interacts with: MselService.pushIntegrations / pullIntegrations (stubs), real MselQuery.
     * Data: the push returns status Pushing, the pull returns status Pulling.
     */
    it.each([
      { method: 'pushIntegrations', endpoint: 'pushIntegrations', status: MselItemStatus.Pushing, call: (s: MselDataService) => s.pushIntegrations('msel-1') },
      { method: 'pullIntegrations', endpoint: 'pullIntegrations', status: MselItemStatus.Pulling, call: (s: MselDataService) => s.pullIntegrations('msel-1') },
    ] as const)('$method stores the returned MSEL', ({ endpoint, status, call }) => {
      const { service, query, mselApi } = setup();
      service.updateStore(msel());
      mselApi[endpoint].mockReturnValue(of(msel({ status })));

      call(service);

      expect(mselApi[endpoint]).toHaveBeenCalledWith('msel-1');
      expect(query.getEntity('msel-1').status).toBe(status);
    });

    /**
     * Verifies: a failed push, pull or cancel is reported through ErrorService and leaves loading cleared.
     * Interacts with: MselService push/pull/cancelIntegrations (stubs erroring), ErrorService.handleError (spy), real MselQuery.
     * Data: loading cleared first; the endpoint fails with its own error object.
     */
    it.each([
      { method: 'pushIntegrations', endpoint: 'pushIntegrations', call: (s: MselDataService) => s.pushIntegrations('msel-1') },
      { method: 'pullIntegrations', endpoint: 'pullIntegrations', call: (s: MselDataService) => s.pullIntegrations('msel-1') },
      { method: 'cancelIntegrations', endpoint: 'cancelIntegrations', call: (s: MselDataService) => s.cancelIntegrations('msel-1') },
    ] as const)('reports a failed $method', ({ method, endpoint, call }) => {
      const { service, query, store, mselApi, handleError } = setup();
      const failure = new Error(method);
      store.setLoading(false);
      mselApi[endpoint].mockReturnValue(throwError(() => failure));

      call(service);

      expect(handleError.mock.calls).toEqual([[failure]]);
      expect(query.getValue().loading).toBe(false);
    });

    /**
     * Verifies: a successful cancelIntegrations reports nothing.
     * Interacts with: MselService.cancelIntegrations (stub), ErrorService.handleError (spy).
     * Data: the API returns nothing.
     */
    it('cancelIntegrations is silent on success', () => {
      const { service, mselApi, handleError } = setup();
      mselApi.cancelIntegrations.mockReturnValue(of(null));

      service.cancelIntegrations('msel-1');

      expect(mselApi.cancelIntegrations).toHaveBeenCalledWith('msel-1');
      expect(handleError).not.toHaveBeenCalled();
    });

    /**
     * Verifies: updateIntegrationStatus (the IntegrationStatusUpdated SignalR target) patches only that MSEL's status text.
     * Interacts with: real MselStore and MselQuery.
     * Data: msel-1 and msel-2 stored; msel-1 gets "Pushing to Gallery".
     */
    it('updateIntegrationStatus patches the status text', () => {
      const { service, query } = setup();
      service.updateStore(msel());
      service.updateStore(msel({ id: 'msel-2' }));

      service.updateIntegrationStatus('msel-1', 'Pushing to Gallery');

      expect(query.getEntity('msel-1').integrationStatus).toBe(
        'Pushing to Gallery',
      );
      expect(query.getEntity('msel-1').name).toBe('Exercise Alpha');
      expect(query.getEntity('msel-2').integrationStatus).toBeUndefined();
    });
  });

  describe('uploads', () => {
    /**
     * Verifies: uploading an xlsx onto an existing MSEL replaces it via replaceWithXlsxFile, reports progress, then resets progress and stores the result.
     * Interacts with: MselService.replaceWithXlsxFile (stub emitting HTTP events), uploadProgress subject, real MselQuery.
     * Data: an upload-progress event at 50/200 bytes, then a 200 response carrying the replaced MSEL.
     */
    it('uploadXlsx with an id replaces the MSEL and reports progress', () => {
      const { service, query, mselApi } = setup();
      const progress = recordEmissions(service.uploadProgress);
      const upload = file();
      mselApi.replaceWithXlsxFile.mockReturnValue(
        of(
          { type: HttpEventType.UploadProgress, loaded: 50, total: 200 } satisfies HttpUploadProgressEvent,
          new HttpResponse({
            status: 200,
            body: msel({ name: 'Replaced' }),
          }),
        ),
      );

      service.uploadXlsx('msel-1', upload, 'events', true);

      expect(mselApi.replaceWithXlsxFile).toHaveBeenCalledWith(
        'msel-1',
        upload,
        undefined,
        'events',
        true,
      );
      expect(mselApi.uploadXlsx).not.toHaveBeenCalled();
      expect(progress).toEqual([25, 0]);
      expect(query.getEntity('msel-1').name).toBe('Replaced');
      expect(query.getValue().loading).toBe(false);
    });

    /**
     * Verifies: uploading an xlsx without an id creates a new MSEL via uploadXlsx.
     * Interacts with: MselService.uploadXlsx (stub), real MselQuery.
     * Data: a 200 response carrying msel-9.
     */
    it('uploadXlsx without an id creates a new MSEL', () => {
      const { service, query, mselApi } = setup();
      const upload = file();
      mselApi.uploadXlsx.mockReturnValue(
        of(new HttpResponse({ status: 200, body: msel({ id: 'msel-9' }) })),
      );

      service.uploadXlsx('', upload, 'events', true);

      expect(mselApi.uploadXlsx).toHaveBeenCalledWith(upload, 'events', true);
      expect(query.getAll().map((m) => m.id)).toEqual(['msel-9']);
    });

    /**
     * Verifies: a non-200 upload response stops loading and resets progress without storing anything.
     * Interacts with: MselService.uploadXlsx (stub), uploadProgress subject, real MselQuery.
     * Data: a 204 response with no body.
     */
    it('uploadXlsx ignores a non-200 response body', () => {
      const { service, query, mselApi } = setup();
      const progress = recordEmissions(service.uploadProgress);
      mselApi.uploadXlsx.mockReturnValue(
        of(new HttpResponse({ status: 204, body: null })),
      );

      service.uploadXlsx(undefined, file(), 'events', true);

      expect(progress).toEqual([0]);
      expect(query.getAll()).toEqual([]);
      expect(query.getValue().loading).toBe(false);
    });

    /**
     * Verifies: a failed upload (with or without an id) is reported, resets progress and stops loading.
     * Interacts with: MselService.replaceWithXlsxFile / uploadXlsx (stubs erroring), ErrorService.handleError (spy).
     * Data: two failing uploads.
     */
    it('uploadXlsx reports a failed upload', () => {
      const { service, query, mselApi, handleError } = setup();
      const progress = recordEmissions(service.uploadProgress);
      const failure = new Error('too large');
      mselApi.replaceWithXlsxFile.mockReturnValue(throwError(() => failure));
      mselApi.uploadXlsx.mockReturnValue(throwError(() => failure));

      service.uploadXlsx('msel-1', file(), 'events', true);
      service.uploadXlsx('', file(), 'events', true);

      expect(handleError.mock.calls).toEqual([[failure], [failure]]);
      expect(progress).toEqual([0, 0]);
      expect(query.getValue().loading).toBe(false);
    });

    /**
     * Verifies: uploadJson reports progress and stores the imported MSEL, and reports failures.
     * Interacts with: MselService.uploadJsonMsel (stub), uploadProgress subject, ErrorService (spy), real MselQuery.
     * Data: a 100/100 progress event and a 200 response, then a failing upload.
     */
    it('uploadJson stores the imported MSEL and reports failures', () => {
      const { service, query, mselApi, handleError } = setup();
      const progress = recordEmissions(service.uploadProgress);
      const failure = new Error('bad json');
      mselApi.uploadJsonMsel.mockReturnValueOnce(
        of(
          { type: HttpEventType.UploadProgress, loaded: 100, total: 100 } satisfies HttpUploadProgressEvent,
          new HttpResponse({ status: 200, body: msel({ id: 'msel-json' }) }),
        ),
      );
      mselApi.uploadJsonMsel.mockReturnValueOnce(throwError(() => failure));

      service.uploadJson(file(), 'events', true);
      expect(query.getAll().map((m) => m.id)).toEqual(['msel-json']);

      service.uploadJson(file(), 'events', true);
      expect(handleError).toHaveBeenCalledWith(failure);
      expect(progress).toEqual([100, 0, 0]);
      expect(query.getValue().loading).toBe(false);
    });
  });

  describe('store helpers and lists', () => {
    /**
     * Verifies: updateStore and deleteFromStore (the MselCreated/Updated/Deleted SignalR targets) drive selectAll, emitting once per change.
     * Interacts with: real MselStore through MselDataService, MselQuery.selectAll.
     * Data: create msel-1, rename it with a partial payload, delete it.
     */
    it('updateStore and deleteFromStore drive the query output', () => {
      const { service, query } = setup();
      const emissions = recordEmissions(query.selectAll());

      service.updateStore(msel());
      service.updateStore({ id: 'msel-1', name: 'Renamed' });
      service.deleteFromStore('msel-1');

      expect(emissions.map((list) => list.map((m) => m.name))).toEqual([
        [],
        ['Exercise Alpha'],
        ['Renamed'],
        [],
      ]);
      expect(emissions[2][0].description).toBe('Alpha description');
    });

    /**
     * Verifies: setActive marks the MSEL that selectActive emits.
     * Interacts with: real MselStore and MselQuery.selectActive.
     * Data: two MSELs; msel-2 activated.
     */
    it('setActive selects the active MSEL', async () => {
      const { service, query } = setup();
      service.updateStore(msel());
      service.updateStore(msel({ id: 'msel-2', name: 'Exercise Bravo' }));

      service.setActive('msel-2');

      // selectActive is typed for single- and multi-active stores; MSELs are single-active.
      const active$ = query.selectActive() as Observable<Msel>;
      expect((await firstValueFrom(active$)).name).toBe('Exercise Bravo');
    });

    /**
     * Verifies: MselList filters on the mselmask query param, matching the description or the id but not the name.
     * Interacts with: ActivatedRoute.queryParamMap (stub), real MselQuery.
     * Data: MSELs "Exercise Alpha"/"Alpha description" and "Exercise Bravo"/"Night shift"; masks "night", "msel-1", "bravo".
     */
    it('MselList filters on the mselmask query param', () => {
      const { service, route } = setup({ mselmask: 'night' });
      service.updateStore(msel());
      service.updateStore(
        msel({ id: 'msel-2', name: 'Exercise Bravo', description: 'Night shift' }),
      );
      const emissions = recordEmissions(service.MselList);

      expect(emissions.at(-1).map((m) => m.id)).toEqual(['msel-2']);

      route.setQueryParams({ mselmask: 'msel-1' });
      expect(emissions.at(-1).map((m) => m.id)).toEqual(['msel-1']);

      // The name is not part of the match.
      route.setQueryParams({ mselmask: 'bravo' });
      expect(emissions.at(-1)).toEqual([]);
    });

    /**
     * Verifies: filterControl writes the term to the mselmask query param.
     * Interacts with: Router.navigate (spy).
     * Data: filter term "alpha".
     */
    it('filterControl pushes the term into the mselmask query param', () => {
      const { service, navigate } = setup();

      service.filterControl.setValue('alpha');

      expect(navigate).toHaveBeenCalledWith([], {
        queryParams: { mselmask: 'alpha' },
        queryParamsHandling: 'merge',
      });
    });

    /**
     * Verifies: each pass-through method calls the matching API endpoint with the caller's ids and leaves the store alone.
     * Interacts with: MselService join/launch/download/getMy* endpoints (stubs), real MselQuery.
     * Data: MSEL msel-1, team team-1.
     */
    it.each([
      { method: 'getMyJoinMsels', endpoint: 'getMyJoinMsels', args: [], call: (s: MselDataService) => s.getMyJoinMsels() },
      { method: 'getMyLaunchMsels', endpoint: 'getMyLaunchMsels', args: [], call: (s: MselDataService) => s.getMyLaunchMsels() },
      { method: 'getMyBuildMsels', endpoint: 'getMyMsels', args: [], call: (s: MselDataService) => s.getMyBuildMsels() },
      { method: 'join', endpoint: 'joinMselByInvitation', args: ['msel-1', 'team-1'], call: (s: MselDataService) => s.join('msel-1', 'team-1') },
      { method: 'launch', endpoint: 'launchMselByInvitation', args: ['msel-1', 'team-1'], call: (s: MselDataService) => s.launch('msel-1', 'team-1') },
      { method: 'downloadXlsx', endpoint: 'downloadXlsx', args: ['msel-1'], call: (s: MselDataService) => s.downloadXlsx('msel-1') },
      { method: 'downloadJson', endpoint: 'downloadJsonMsel', args: ['msel-1'], call: (s: MselDataService) => s.downloadJson('msel-1') },
    ] as const)('$method calls $endpoint', ({ endpoint, args, call }) => {
      const { service, query, mselApi } = setup();

      call(service);

      expect(mselApi[endpoint]).toHaveBeenCalledTimes(1);
      expect(mselApi[endpoint]).toHaveBeenCalledWith(...args);
      expect(query.getAll()).toEqual([]);
    });
  });

  /**
   * Verifies: a failed request from delete escapes to the app's global ErrorHandler.
   * Interacts with: MselService endpoints (stubs failing), captureUnhandledRxErrors.
   * Data: each endpoint fails with "request failed".
   */
  it.each([
    { method: 'delete', endpoint: 'deleteMsel', call: (s: MselDataService) => s.delete('x-1') },
  ] as const)('$method lets a failed request reach the global ErrorHandler', async ({ endpoint, call }) => {
    const { service, mselApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    mselApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    // These methods subscribe with no error callback and set no loading flag,
    // so the error escapes to ErrorService, the ErrorHandler app.module.ts
    // provides, which shows it to the user. Not a defect on its own.
    expect(errors).toEqual([failure]);
  });
});

describe('MselQuery', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: selectAll orders MSELs by name ascending regardless of insertion order.
   * Interacts with: real MselStore and MselQuery (sortBy name).
   * Data: MSELs named "Charlie", "alpha", "Bravo" inserted in that order.
   */
  it('sorts MSELs by name', async () => {
    const store = new MselStore();
    const query = new MselQuery(store);
    store.set([
      msel({ id: 'c', name: 'Charlie' }),
      msel({ id: 'a', name: 'Alpha' }),
      msel({ id: 'b', name: 'Bravo' }),
    ]);

    const names = (await firstValueFrom(query.selectAll())).map((m) => m.name);

    expect(names).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  /**
   * Verifies: getById returns the stored MSEL or undefined, and selectById emits it.
   * Interacts with: real MselStore and MselQuery.
   * Data: one MSEL, msel-1.
   */
  it('looks MSELs up by id', async () => {
    const store = new MselStore();
    const query = new MselQuery(store);
    store.set([msel()]);

    expect(query.getById('msel-1').name).toBe('Exercise Alpha');
    expect(query.getById('missing')).toBeUndefined();
    expect((await firstValueFrom(query.selectById('msel-1'))).id).toBe(
      'msel-1',
    );
  });

  /**
   * Verifies: getByScenarioEventId finds the MSEL that owns a scenario event, and throws if any stored MSEL lacks a scenarioEvents list.
   * Interacts with: real MselStore and MselQuery.
   * Data: msel-1 owning se-1, msel-2 owning se-2; then an MSEL without scenarioEvents.
   */
  it('finds the MSEL that owns a scenario event', () => {
    const store = new MselStore();
    const query = new MselQuery(store);
    store.set([
      msel({ scenarioEvents: [{ id: 'se-1', mselId: 'msel-1' }] }),
      msel({ id: 'msel-2', scenarioEvents: [{ id: 'se-2', mselId: 'msel-2' }] }),
    ]);

    expect(query.getByScenarioEventId('se-2').id).toBe('msel-2');
    expect(query.getByScenarioEventId('se-404')).toBeUndefined();

    store.upsert('msel-0', msel({ id: 'msel-0', name: 'Aardvark' }));
    expect(() => query.getByScenarioEventId('se-2')).toThrow(TypeError);
  });
});
