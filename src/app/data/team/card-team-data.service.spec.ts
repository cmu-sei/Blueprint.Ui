// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { CardTeam, CardTeamService } from 'src/app/generated/blueprint.api';
import { CardTeamDataService } from './card-team-data.service';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { getDefaultProviders } from 'src/app/test-utils/default-test-providers';
import { recordEmissions } from 'src/app/test-utils/record-emissions';

function cardTeam(overrides: Partial<CardTeam> = {}): CardTeam {
  return {
    id: 'ct-1',
    cardId: 'card-1',
    teamId: 'team-red',
    isShownOnWall: true,
    canPostArticles: false,
    ...overrides,
  };
}

function setup() {
  const cardTeamApi = {
    getMselCardTeams: vi.fn(() => of<CardTeam[]>([])),
    createCardTeam: vi.fn(() => of(cardTeam())),
    deleteCardTeam: vi.fn(() => of<unknown>(null)),
    updateCardTeam: vi.fn(() => of(cardTeam())),
  } satisfies ApiStub<CardTeamService>;
  TestBed.configureTestingModule({
    // The service injects auth, router and route but never uses them; the
    // default placeholders satisfy DI.
    providers: getDefaultProviders([
      { provide: CardTeamService, useValue: cardTeamApi },
    ]),
  });
  const service = TestBed.inject(CardTeamDataService);
  return { service, cardTeamApi, emissions: recordEmissions(service.cardTeams) };
}

const ids = (list: CardTeam[]) => list.map((ct) => ct.id);

describe('CardTeamDataService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: getCardTeamsFromApi publishes the MSEL's card teams, and publishes an empty list when the call fails.
   * Interacts with: CardTeamService.getMselCardTeams (stub), cardTeams subject.
   * Data: two card teams, then an API error.
   */
  it('getCardTeamsFromApi publishes the MSEL card teams', () => {
    const { service, cardTeamApi, emissions } = setup();
    cardTeamApi.getMselCardTeams.mockReturnValueOnce(
      of([cardTeam(), cardTeam({ id: 'ct-2' })]),
    );
    cardTeamApi.getMselCardTeams.mockReturnValueOnce(
      throwError(() => new Error('boom')),
    );

    service.getCardTeamsFromApi('msel-1');
    expect(cardTeamApi.getMselCardTeams).toHaveBeenCalledWith('msel-1');
    expect(ids(emissions.at(-1))).toEqual(['ct-1', 'ct-2']);

    service.getCardTeamsFromApi('msel-1');
    expect(emissions.at(-1)).toEqual([]);
  });

  /**
   * Verifies: addTeamToCard creates a wall-visible, non-posting card team and puts it first in the list.
   * Interacts with: CardTeamService.createCardTeam (stub), cardTeams subject.
   * Data: ct-1 already listed; team-blue added to card-1 as ct-2.
   */
  it('addTeamToCard creates the card team with default flags', () => {
    const { service, cardTeamApi, emissions } = setup();
    service.updateStore(cardTeam());
    cardTeamApi.createCardTeam.mockReturnValue(
      of(cardTeam({ id: 'ct-2', teamId: 'team-blue' })),
    );

    service.addTeamToCard('card-1', { id: 'team-blue', name: 'Blue' });

    expect(cardTeamApi.createCardTeam).toHaveBeenCalledWith({
      cardId: 'card-1',
      teamId: 'team-blue',
      isShownOnWall: true,
      canPostArticles: false,
    });
    expect(ids(emissions.at(-1))).toEqual(['ct-2', 'ct-1']);
  });

  /**
   * Verifies: updateCardTeam replaces the card team with the API's version and moves it to the front.
   * Interacts with: CardTeamService.updateCardTeam (stub), cardTeams subject.
   * Data: ct-1 and ct-2 listed; ct-2 updated to allow posting.
   */
  it('updateCardTeam replaces the card team', () => {
    const { service, cardTeamApi, emissions } = setup();
    service.updateStore(cardTeam({ id: 'ct-2' }));
    service.updateStore(cardTeam());
    cardTeamApi.updateCardTeam.mockReturnValue(
      of(cardTeam({ id: 'ct-2', canPostArticles: true })),
    );

    service.updateCardTeam(cardTeam({ id: 'ct-2', canPostArticles: true }));

    expect(cardTeamApi.updateCardTeam).toHaveBeenCalledWith(
      'ct-2',
      expect.objectContaining({ canPostArticles: true }),
    );
    expect(ids(emissions.at(-1))).toEqual(['ct-2', 'ct-1']);
    expect(emissions.at(-1)[0].canPostArticles).toBe(true);
  });

  /**
   * Verifies: removeCardTeam drops the card team after the API confirms.
   * Interacts with: CardTeamService.deleteCardTeam (stub), cardTeams subject.
   * Data: ct-1 and ct-2 listed; ct-1 removed.
   */
  it('removeCardTeam drops the card team', () => {
    const { service, cardTeamApi, emissions } = setup();
    service.updateStore(cardTeam());
    service.updateStore(cardTeam({ id: 'ct-2' }));
    cardTeamApi.deleteCardTeam.mockReturnValue(of(null));

    service.removeCardTeam('ct-1');

    expect(ids(emissions.at(-1))).toEqual(['ct-2']);
  });

  /**
   * Verifies: failed add, update and remove calls republish the unchanged list.
   * Interacts with: CardTeamService create/update/deleteCardTeam (stubs erroring), cardTeams subject.
   * Data: ct-1 listed; three failing calls.
   */
  it('republishes the unchanged list when a change fails', () => {
    const { service, cardTeamApi, emissions } = setup();
    service.updateStore(cardTeam());
    const fail = () => throwError(() => new Error('boom'));
    cardTeamApi.createCardTeam.mockImplementation(fail);
    cardTeamApi.updateCardTeam.mockImplementation(fail);
    cardTeamApi.deleteCardTeam.mockImplementation(fail);
    const before = emissions.length;

    service.addTeamToCard('card-1', { id: 'team-blue' });
    service.updateCardTeam(cardTeam({ isShownOnWall: false }));
    service.removeCardTeam('ct-1');

    expect(emissions.slice(before).map(ids)).toEqual([
      ['ct-1'],
      ['ct-1'],
      ['ct-1'],
    ]);
    expect(emissions.at(-1)[0].isShownOnWall).toBe(true);
  });

  /**
   * Verifies: updateStore and deleteFromStore (the CardTeam SignalR targets) upsert to the front and remove by id.
   * Interacts with: cardTeams subject.
   * Data: ct-1 added, ct-2 added, ct-1 updated, ct-2 deleted.
   */
  it('updateStore and deleteFromStore keep the list current', () => {
    const { service, emissions } = setup();

    service.updateStore(cardTeam());
    service.updateStore(cardTeam({ id: 'ct-2' }));
    service.updateStore(cardTeam({ isShownOnWall: false }));
    service.deleteFromStore('ct-2');

    expect(emissions.map(ids)).toEqual([
      [],
      ['ct-1'],
      ['ct-2', 'ct-1'],
      ['ct-1', 'ct-2'],
      ['ct-1'],
    ]);
    expect(emissions.at(-1)[0].isShownOnWall).toBe(false);
  });
});
