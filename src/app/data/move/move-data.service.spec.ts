// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Move, MoveService } from 'src/app/generated/blueprint.api';
import { MoveStore } from './move.store';
import { MoveDataService } from './move-data.service';
import { MoveQuery } from './move.query';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { activatedRouteStub } from 'src/app/test-utils/activated-route';
import { recordEmissions } from 'src/app/test-utils/record-emissions';
import { captureUnhandledRxErrors, flush } from 'src/app/test-utils/unhandled-rx-errors';

function move(overrides: Partial<Move> = {}): Move {
  return {
    id: 'move-1',
    moveNumber: 1,
    description: 'Initial move',
    deltaSeconds: 0,
    mselId: 'msel-1',
    dateCreated: '2026-01-01T00:00:00Z' as unknown as Date,
    dateModified: '2026-01-02T00:00:00Z' as unknown as Date,
    situationTime: '2026-01-03T00:00:00Z' as unknown as Date,
    ...overrides,
  };
}

function setup(queryParams: Record<string, string> = {}) {
  const moveApi = {
    getMovesByMsel: vi.fn(() => of<Move[]>([])),
    getMove: vi.fn(() => of(move())),
    createMove: vi.fn(() => of(move())),
    updateMove: vi.fn(() => of(move())),
    deleteMove: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<MoveService>;
  const route = activatedRouteStub(queryParams);
  const navigate = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: MoveService, useValue: moveApi },
      { provide: Router, useValue: { navigate } satisfies Pick<Router, 'navigate'> },
      { provide: ActivatedRoute, useValue: route.route },
    ],
  });
  return {
    service: TestBed.inject(MoveDataService),
    query: TestBed.inject(MoveQuery),
    moveApi,
    navigate,
    route,
  };
}

describe('MoveDataService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: loadByMsel replaces the store with the MSEL's moves, converting the date strings to Date objects.
   * Interacts with: MoveService.getMovesByMsel (stub), real MoveStore and MoveQuery.
   * Data: two moves for msel-1 whose dates arrive as ISO strings.
   */
  it('loadByMsel stores the moves with their dates parsed', () => {
    const { service, query, moveApi } = setup();
    moveApi.getMovesByMsel.mockReturnValue(
      of([move(), move({ id: 'move-2', moveNumber: 2 })]),
    );

    service.loadByMsel('msel-1');

    expect(moveApi.getMovesByMsel).toHaveBeenCalledWith('msel-1');
    const moves = query.getAll();
    expect(moves.map((m) => m.id)).toEqual(['move-1', 'move-2']);
    expect(moves[0].dateCreated).toEqual(new Date('2026-01-01T00:00:00Z'));
    expect(moves[0].situationTime).toEqual(new Date('2026-01-03T00:00:00Z'));
    expect(query.getValue().loading).toBe(false);
  });

  /**
   * Verifies: loadByMsel drops moves from a previously loaded MSEL instead of merging them.
   * Interacts with: MoveService.getMovesByMsel (stub), real MoveQuery.
   * Data: msel-1 loaded first, then msel-2 with a different move.
   */
  it('loadByMsel replaces moves from the previous MSEL', () => {
    const { service, query, moveApi } = setup();
    moveApi.getMovesByMsel.mockReturnValueOnce(of([move()]));
    moveApi.getMovesByMsel.mockReturnValueOnce(
      of([move({ id: 'move-9', mselId: 'msel-2' })]),
    );

    service.loadByMsel('msel-1');
    service.loadByMsel('msel-2');

    expect(query.getAll().map((m) => m.id)).toEqual(['move-9']);
  });

  /**
   * Verifies: a failed loadByMsel empties the store and clears the loading flag.
   * Interacts with: MoveService.getMovesByMsel (stub erroring), real MoveQuery.
   * Data: one move already in the store before the failing call.
   */
  it('loadByMsel empties the store and stops loading when the API fails', () => {
    const { service, query, moveApi } = setup();
    service.updateStore(move());
    moveApi.getMovesByMsel.mockReturnValue(
      throwError(() => new Error('boom')),
    );

    service.loadByMsel('msel-1');

    expect(query.getAll()).toEqual([]);
    expect(query.getValue().loading).toBe(false);
  });

  /**
   * Verifies: loadById upserts the fetched move and keeps the other moves.
   * Interacts with: MoveService.getMove (stub), real MoveQuery.
   * Data: move-1 already stored; move-2 fetched by id.
   */
  it('loadById upserts the move without dropping the others', () => {
    const { service, query, moveApi } = setup();
    service.updateStore(move());
    moveApi.getMove.mockReturnValue(of(move({ id: 'move-2' })));

    service.loadById('move-2');

    expect(moveApi.getMove).toHaveBeenCalledWith('move-2');
    expect(query.getAll().map((m) => m.id)).toEqual(['move-1', 'move-2']);
    expect(query.getEntity('move-2').dateCreated).toBeInstanceOf(Date);
  });

  /**
   * Verifies: add stores the move the API created, and updateMove stores the API's version of the edit.
   * Interacts with: MoveService.createMove and updateMove (stubs), real MoveQuery.
   * Data: a new move, then an edit that changes its description.
   */
  it('add and updateMove store what the API returns', () => {
    const { service, query, moveApi } = setup();
    moveApi.createMove.mockReturnValue(of(move()));
    moveApi.updateMove.mockReturnValue(
      of(move({ description: 'Server edit' })),
    );

    service.add(move({ id: undefined }));
    expect(query.getAll().map((m) => m.id)).toEqual(['move-1']);

    service.updateMove(move({ description: 'Client edit' }));
    expect(moveApi.updateMove).toHaveBeenCalledWith(
      'move-1',
      expect.objectContaining({ description: 'Client edit' }),
    );
    expect(query.getEntity('move-1').description).toBe('Server edit');
    expect(query.getValue().loading).toBe(false);
  });

  /**
   * Verifies: delete removes the move only after the API confirms the deletion.
   * Interacts with: MoveService.deleteMove (stub), real MoveQuery.
   * Data: two stored moves; move-1 deleted.
   */
  it('delete removes the move once the API confirms', () => {
    const { service, query, moveApi } = setup();
    service.updateStore(move());
    service.updateStore(move({ id: 'move-2' }));
    moveApi.deleteMove.mockReturnValue(of(null));

    service.delete('move-1');

    expect(moveApi.deleteMove).toHaveBeenCalledWith('move-1');
    expect(query.getAll().map((m) => m.id)).toEqual(['move-2']);
  });

  /**
   * Verifies: updateStore and deleteFromStore (the SignalR targets) upsert, merge and remove moves, emitting each change.
   * Interacts with: real MoveStore through MoveDataService, MoveQuery.selectAll.
   * Data: create move-1, update its description with a partial payload, then delete it.
   */
  it('updateStore and deleteFromStore drive the query output', () => {
    const { service, query } = setup();
    const emissions = recordEmissions(query.selectAll());

    service.updateStore(move());
    service.updateStore({ id: 'move-1', description: 'Edited' });
    service.deleteFromStore('move-1');

    expect(emissions.map((list) => list.map((m) => m.description))).toEqual([
      [],
      ['Initial move'],
      ['Edited'],
      [],
    ]);
    // The partial update merges into the stored move rather than replacing it.
    expect(emissions[2][0].moveNumber).toBe(1);
  });

  /**
   * Verifies: MoveList filters by the movemask query param against description or id, and re-filters when the param changes.
   * Interacts with: ActivatedRoute.queryParamMap (stub), real MoveQuery.
   * Data: moves "Initial move" and "Escalation"; mask "escal", then cleared.
   */
  it('MoveList filters on the movemask query param', () => {
    const { service, route } = setup({ movemask: 'escal' });
    service.updateStore(move());
    service.updateStore(move({ id: 'move-2', description: 'Escalation' }));
    const emissions = recordEmissions(service.MoveList);

    expect(emissions.at(-1).map((m) => m.id)).toEqual(['move-2']);

    route.setQueryParams({});
    expect(emissions.at(-1).map((m) => m.id)).toEqual(['move-1', 'move-2']);
  });

  /**
   * Verifies: typing in filterControl writes the term to the movemask query param, merging with the other params.
   * Interacts with: Router.navigate (spy).
   * Data: filter term "abc".
   */
  it('filterControl pushes the term into the movemask query param', () => {
    const { service, navigate } = setup();

    service.filterControl.setValue('abc');

    expect(navigate).toHaveBeenCalledWith([], {
      queryParams: { movemask: 'abc' },
      queryParamsHandling: 'merge',
    });
  });

  /**
   * Verifies: unload clears every move from the store.
   * Interacts with: real MoveQuery.
   * Data: one stored move.
   */
  it('unload clears the store', () => {
    const { service, query } = setup();
    service.updateStore(move());

    service.unload();

    expect(query.getAll()).toEqual([]);
  });

  /**
   * Verifies: a failed request leaves loading set for every method that sets it first (current behavior), and the ones with no error callback let the error escape.
   * Interacts with: MoveService endpoints (stubs failing), real MoveStore and MoveQuery, captureUnhandledRxErrors.
   * Data: loading cleared first; each endpoint fails with "request failed".
   */
  it.each([
    { method: 'loadById', endpoint: 'getMove', escapes: true, call: (s: MoveDataService) => s.loadById('x-1') },
    { method: 'add', endpoint: 'createMove', escapes: true, call: (s: MoveDataService) => s.add({ id: 'x-1' }) },
    { method: 'updateMove', endpoint: 'updateMove', escapes: true, call: (s: MoveDataService) => s.updateMove({ id: 'x-1' }) },
  ] as const)('$method leaves loading stuck when its request fails', async ({ endpoint, escapes, call }) => {
    const { service, moveApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    TestBed.inject(MoveStore).setLoading(false);
    moveApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    expect(TestBed.inject(MoveQuery).getValue().loading).toBe(true);
    // With no error callback the error escapes to ErrorService, the ErrorHandler
    // app.module.ts provides, which shows it.
    expect(errors).toEqual(escapes ? [failure] : []);
  });

  /**
   * Verifies: a failed request from delete escapes to the app's global ErrorHandler.
   * Interacts with: MoveService endpoints (stubs failing), captureUnhandledRxErrors.
   * Data: each endpoint fails with "request failed".
   */
  it.each([
    { method: 'delete', endpoint: 'deleteMove', call: (s: MoveDataService) => s.delete('x-1') },
  ] as const)('$method lets a failed request reach the global ErrorHandler', async ({ endpoint, call }) => {
    const { service, moveApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    moveApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    // These methods subscribe with no error callback and set no loading flag,
    // so the error escapes to ErrorService, the ErrorHandler app.module.ts
    // provides, which shows it to the user. Not a defect on its own.
    expect(errors).toEqual([failure]);
  });
});
