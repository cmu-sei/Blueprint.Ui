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
import { Card, CardService } from 'src/app/generated/blueprint.api';
import { CardStore } from './card.store';
import { CardDataService } from './card-data.service';
import { CardQuery } from './card.query';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { activatedRouteStub } from 'src/app/test-utils/activated-route';
import { recordEmissions } from 'src/app/test-utils/record-emissions';
import { captureUnhandledRxErrors, flush } from 'src/app/test-utils/unhandled-rx-errors';

function card(overrides: Partial<Card> = {}): Card {
  return {
    id: 'card-1',
    mselId: 'msel-1',
    name: 'Breach Card',
    description: 'Initial breach',
    move: 1,
    inject: 1,
    isTemplate: false,
    ...overrides,
  };
}

function setup(queryParams: Record<string, string> = {}) {
  const cardApi = {
    getCardTemplates: vi.fn(() => of<Card[]>([])),
    getCardsByMsel: vi.fn(() => of<Card[]>([])),
    getCard: vi.fn(() => of(card())),
    createCard: vi.fn(() => of(card())),
    updateCard: vi.fn(() => of(card())),
    deleteCard: vi.fn(() => of<unknown>(null)),
    downloadJsonCards: vi.fn(() => of(new Blob())),
    uploadJsonCards: vi.fn((): Observable<HttpEvent<Card[]>> => EMPTY),
  } satisfies ApiStub<CardService>;
  const navigate = vi.fn();
  const route = activatedRouteStub(queryParams);
  TestBed.configureTestingModule({
    providers: [
      { provide: CardService, useValue: cardApi },
      { provide: Router, useValue: { navigate } satisfies Pick<Router, 'navigate'> },
      { provide: ActivatedRoute, useValue: route.route },
    ],
  });
  return {
    service: TestBed.inject(CardDataService),
    query: TestBed.inject(CardQuery),
    cardApi,
    navigate,
    route,
  };
}

const names = (cards: Card[]) => cards.map((c) => c.name);

describe('CardDataService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: loadTemplates merges templates into the store, while loadByMsel replaces everything (templates included) with the MSEL's cards.
   * Interacts with: CardService.getCardTemplates / getCardsByMsel (stubs), real CardStore and CardQuery.
   * Data: one template, then two MSEL cards.
   */
  it('loadTemplates merges, loadByMsel replaces', () => {
    const { service, query, cardApi } = setup();
    cardApi.getCardTemplates.mockReturnValue(
      of([card({ id: 'tmpl-1', name: 'Template Card', isTemplate: true })]),
    );
    cardApi.getCardsByMsel.mockReturnValue(
      of([card(), card({ id: 'card-2', name: 'Arrest Card' })]),
    );
    service.updateStore(card({ id: 'card-0', name: 'Already here' }));

    service.loadTemplates();
    expect(names(query.getAll())).toEqual(['Already here', 'Template Card']);

    service.loadByMsel('msel-1');
    expect(cardApi.getCardsByMsel).toHaveBeenCalledWith('msel-1');
    expect(names(query.getAll())).toEqual(['Arrest Card', 'Breach Card']);
    expect(query.getValue().loading).toBe(false);
  });

  /**
   * Verifies: a failed loadByMsel empties the store and clears loading.
   * Interacts with: CardService.getCardsByMsel (stub erroring), real CardQuery.
   * Data: one stored card; getCardsByMsel fails.
   */
  it('a failed loadByMsel empties the store', () => {
    const { service, query, cardApi } = setup();
    cardApi.getCardsByMsel.mockReturnValue(throwError(() => new Error('boom')));
    service.updateStore(card());

    service.loadByMsel('msel-1');

    expect(query.getAll()).toEqual([]);
    expect(query.getValue().loading).toBe(false);
  });

  /**
   * Verifies: loadById, add and updateCard store what the API returns.
   * Interacts with: CardService getCard / createCard / updateCard (stubs), real CardQuery.
   * Data: card-2 fetched, card-3 created, card-2 renamed by the API.
   */
  it('loadById, add and updateCard store the API result', () => {
    const { service, query, cardApi } = setup();
    cardApi.getCard.mockReturnValue(of(card({ id: 'card-2', name: 'Arrest Card' })));
    cardApi.createCard.mockReturnValue(of(card({ id: 'card-3', name: 'Ransom Card' })));
    cardApi.updateCard.mockReturnValue(of(card({ id: 'card-2', name: 'Arrest Card v2' })));

    service.loadById('card-2');
    service.add(card({ id: undefined, name: 'Ransom Card' }));
    service.updateCard(card({ id: 'card-2', name: 'edited' }));

    expect(cardApi.updateCard).toHaveBeenCalledWith(
      'card-2',
      expect.objectContaining({ name: 'edited' }),
    );
    expect(names(query.getAll())).toEqual(['Arrest Card v2', 'Ransom Card']);
    expect(query.getValue().loading).toBe(false);
  });

  /**
   * Verifies: delete removes the card once the API confirms, and unload clears the store.
   * Interacts with: CardService.deleteCard (stub), real CardQuery.
   * Data: two cards; card-1 deleted, then unload.
   */
  it('delete and unload remove cards', () => {
    const { service, query, cardApi } = setup();
    service.updateStore(card());
    service.updateStore(card({ id: 'card-2', name: 'Arrest Card' }));
    cardApi.deleteCard.mockReturnValue(of(null));

    service.delete('card-1');
    expect(cardApi.deleteCard).toHaveBeenCalledWith('card-1');
    expect(names(query.getAll())).toEqual(['Arrest Card']);

    service.unload();
    expect(query.getAll()).toEqual([]);
  });

  /**
   * Verifies: uploadJson reports progress and upserts the imported cards; a failure resets progress and loading; downloadJson requests the given ids.
   * Interacts with: CardService.uploadJsonCards / downloadJsonCards (stubs), uploadProgress subject, real CardQuery.
   * Data: progress 1/4, a 200 with one card, a 200 with no body, then a failure.
   */
  it('uploadJson imports cards with progress', () => {
    const { service, query, cardApi } = setup();
    const progress = recordEmissions(service.uploadProgress);
    const upload = new File(['[]'], 'cards.json');
    cardApi.uploadJsonCards.mockReturnValueOnce(
      of(
        { type: HttpEventType.UploadProgress, loaded: 1, total: 4 } satisfies HttpUploadProgressEvent,
        new HttpResponse({ status: 200, body: [card()] }),
      ),
    );
    cardApi.uploadJsonCards.mockReturnValueOnce(
      of(new HttpResponse({ status: 200, body: null })),
    );
    cardApi.uploadJsonCards.mockReturnValueOnce(throwError(() => new Error('bad')));

    service.uploadJson(upload, 'events', true);
    service.uploadJson(upload, 'events', true);
    service.uploadJson(upload, 'events', true);

    expect(names(query.getAll())).toEqual(['Breach Card']);
    expect(progress).toEqual([25, 0, 0, 0]);
    expect(query.getValue().loading).toBe(false);
    service.downloadJson(['card-1']);
    expect(cardApi.downloadJsonCards).toHaveBeenCalledWith(['card-1']);
  });

  /**
   * Verifies: updateStore and deleteFromStore (the Card SignalR targets) drive selectAll, sorted by name.
   * Interacts with: real CardStore through the service, CardQuery.selectAll.
   * Data: add two cards, rename one, delete the other.
   */
  it('updateStore and deleteFromStore drive the query output', () => {
    const { service, query } = setup();
    const emissions = recordEmissions(query.selectAll());

    service.updateStore(card());
    service.updateStore(card({ id: 'card-2', name: 'Arrest Card' }));
    service.updateStore({ id: 'card-2', name: 'Zero Day' });
    service.deleteFromStore('card-1');

    expect(emissions.map(names)).toEqual([
      [],
      ['Breach Card'],
      ['Arrest Card', 'Breach Card'],
      ['Breach Card', 'Zero Day'],
      ['Zero Day'],
    ]);
  });

  /**
   * Verifies: CardList filters on the cardmask query param against description or id.
   * Interacts with: ActivatedRoute.queryParamMap (stub), real CardQuery.
   * Data: descriptions "Initial breach" and "Suspect detained"; masks "detained" and "card-1".
   */
  it('CardList filters on the cardmask query param', () => {
    const { service, route } = setup({ cardmask: 'detained' });
    service.updateStore(card());
    service.updateStore(card({ id: 'card-2', name: 'Arrest Card', description: 'Suspect detained' }));
    const emissions = recordEmissions(service.CardList);

    expect(names(emissions.at(-1))).toEqual(['Arrest Card']);

    route.setQueryParams({ cardmask: 'card-1' });
    expect(names(emissions.at(-1))).toEqual(['Breach Card']);
  });

  /**
   * Verifies: filterControl writes the term to the cardmask query param.
   * Interacts with: Router.navigate (spy).
   * Data: term "breach".
   */
  it('filterControl pushes the term into the cardmask query param', () => {
    const { service, navigate } = setup();

    service.filterControl.setValue('breach');

    expect(navigate).toHaveBeenCalledWith([], {
      queryParams: { cardmask: 'breach' },
      queryParamsHandling: 'merge',
    });
  });

  /**
   * Verifies: a failed request leaves loading set for every method that sets it first (current behavior), and the ones with no error callback let the error escape.
   * Interacts with: CardService endpoints (stubs failing), real CardStore and CardQuery, captureUnhandledRxErrors.
   * Data: loading cleared first; each endpoint fails with "request failed".
   */
  it.each([
    { method: 'loadTemplates', endpoint: 'getCardTemplates', escapes: false, call: (s: CardDataService) => s.loadTemplates() },
    { method: 'loadById', endpoint: 'getCard', escapes: true, call: (s: CardDataService) => s.loadById('x-1') },
    { method: 'add', endpoint: 'createCard', escapes: true, call: (s: CardDataService) => s.add({ id: 'x-1' }) },
    { method: 'updateCard', endpoint: 'updateCard', escapes: true, call: (s: CardDataService) => s.updateCard({ id: 'x-1' }) },
  ] as const)('$method leaves loading stuck when its request fails', async ({ endpoint, escapes, call }) => {
    const { service, cardApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    TestBed.inject(CardStore).setLoading(false);
    cardApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    expect(TestBed.inject(CardQuery).getValue().loading).toBe(true);
    // An empty error callback swallows the error; with no callback it escapes to
    // ErrorService, the ErrorHandler app.module.ts provides, which shows it.
    expect(errors).toEqual(escapes ? [failure] : []);
  });

  /**
   * Verifies: a failed request from delete escapes to the app's global ErrorHandler.
   * Interacts with: CardService endpoints (stubs failing), captureUnhandledRxErrors.
   * Data: each endpoint fails with "request failed".
   */
  it.each([
    { method: 'delete', endpoint: 'deleteCard', call: (s: CardDataService) => s.delete('x-1') },
  ] as const)('$method lets a failed request reach the global ErrorHandler', async ({ endpoint, call }) => {
    const { service, cardApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    cardApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    // These methods subscribe with no error callback and set no loading flag,
    // so the error escapes to ErrorService, the ErrorHandler app.module.ts
    // provides, which shows it to the user. Not a defect on its own.
    expect(errors).toEqual([failure]);
  });
});
