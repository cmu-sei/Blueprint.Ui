// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PlayerApplicationTeam, PlayerApplicationTeamService } from 'src/app/generated/blueprint.api';
import { PlayerApplicationTeamDataService } from './player-application-team-data.service';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { getDefaultProviders } from 'src/app/test-utils/default-test-providers';
import { recordEmissions } from 'src/app/test-utils/record-emissions';

function appTeam(
  overrides: Partial<PlayerApplicationTeam> = {},
): PlayerApplicationTeam {
  return {
    id: 'pat-1',
    playerApplicationId: 'app-1',
    teamId: 'team-red',
    displayOrder: 0,
    ...overrides,
  };
}

function setup() {
  const patApi = {
    getMselPlayerApplicationTeams: vi.fn(() => of<PlayerApplicationTeam[]>([])),
    createPlayerApplicationTeam: vi.fn(() => of<PlayerApplicationTeam>({})),
    deletePlayerApplicationTeam: vi.fn(() => of<unknown>(null)),
    updatePlayerApplicationTeam: vi.fn(() => of<PlayerApplicationTeam>({})),
  } satisfies ApiStub<PlayerApplicationTeamService>;
  TestBed.configureTestingModule({
    // The service injects auth, router and route but never uses them; the
    // default placeholders satisfy DI.
    providers: getDefaultProviders([
      { provide: PlayerApplicationTeamService, useValue: patApi },
    ]),
  });
  const service = TestBed.inject(PlayerApplicationTeamDataService);
  return {
    service,
    patApi,
    emissions: recordEmissions(service.playerApplicationTeams),
  };
}

const ids = (list: PlayerApplicationTeam[]) => list.map((pat) => pat.id);

describe('PlayerApplicationTeamDataService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: getPlayerApplicationTeamsFromApi publishes the MSEL's application teams, or an empty list on failure.
   * Interacts with: PlayerApplicationTeamService.getMselPlayerApplicationTeams (stub), playerApplicationTeams subject.
   * Data: two application teams, then an API error.
   */
  it('publishes the MSEL application teams', () => {
    const { service, patApi, emissions } = setup();
    patApi.getMselPlayerApplicationTeams.mockReturnValueOnce(
      of([appTeam(), appTeam({ id: 'pat-2' })]),
    );
    patApi.getMselPlayerApplicationTeams.mockReturnValueOnce(
      throwError(() => new Error('boom')),
    );

    service.getPlayerApplicationTeamsFromApi('msel-1');
    expect(ids(emissions.at(-1))).toEqual(['pat-1', 'pat-2']);

    service.getPlayerApplicationTeamsFromApi('msel-1');
    expect(emissions.at(-1)).toEqual([]);
  });

  /**
   * Verifies: addTeamToPlayerApplication creates the link with the requested display order and lists it first.
   * Interacts with: PlayerApplicationTeamService.createPlayerApplicationTeam (stub), playerApplicationTeams subject.
   * Data: pat-1 listed; team-blue added to app-1 at display order 3.
   */
  it('addTeamToPlayerApplication creates the link', () => {
    const { service, patApi, emissions } = setup();
    service.updateStore(appTeam());
    patApi.createPlayerApplicationTeam.mockReturnValue(
      of(appTeam({ id: 'pat-2', teamId: 'team-blue', displayOrder: 3 })),
    );

    service.addTeamToPlayerApplication('app-1', { id: 'team-blue' }, 3);

    expect(patApi.createPlayerApplicationTeam).toHaveBeenCalledWith({
      playerApplicationId: 'app-1',
      teamId: 'team-blue',
      displayOrder: 3,
    });
    expect(ids(emissions.at(-1))).toEqual(['pat-2', 'pat-1']);
  });

  /**
   * Verifies: updatePlayerApplicationTeam replaces the link with the API's version, and removePlayerApplicationTeam drops it.
   * Interacts with: PlayerApplicationTeamService update/deletePlayerApplicationTeam (stubs), playerApplicationTeams subject.
   * Data: pat-1 and pat-2 listed; pat-2 reordered, then pat-1 removed.
   */
  it('update replaces and remove drops the link', () => {
    const { service, patApi, emissions } = setup();
    service.updateStore(appTeam({ id: 'pat-2' }));
    service.updateStore(appTeam());
    patApi.updatePlayerApplicationTeam.mockReturnValue(
      of(appTeam({ id: 'pat-2', displayOrder: 5 })),
    );
    patApi.deletePlayerApplicationTeam.mockReturnValue(of(null));

    service.updatePlayerApplicationTeam(appTeam({ id: 'pat-2', displayOrder: 5 }));
    expect(patApi.updatePlayerApplicationTeam).toHaveBeenCalledWith(
      'pat-2',
      expect.objectContaining({ displayOrder: 5 }),
    );
    expect(emissions.at(-1).map((p) => `${p.id}:${p.displayOrder}`)).toEqual([
      'pat-2:5',
      'pat-1:0',
    ]);

    service.removePlayerApplicationTeam('pat-1');
    expect(ids(emissions.at(-1))).toEqual(['pat-2']);
  });

  /**
   * Verifies: failed add, update and remove calls republish the unchanged list.
   * Interacts with: the three PlayerApplicationTeamService mutations (stubs erroring), playerApplicationTeams subject.
   * Data: pat-1 listed; three failing calls.
   */
  it('republishes the unchanged list when a change fails', () => {
    const { service, patApi, emissions } = setup();
    service.updateStore(appTeam());
    const fail = () => throwError(() => new Error('boom'));
    patApi.createPlayerApplicationTeam.mockImplementation(fail);
    patApi.updatePlayerApplicationTeam.mockImplementation(fail);
    patApi.deletePlayerApplicationTeam.mockImplementation(fail);
    const before = emissions.length;

    service.addTeamToPlayerApplication('app-1', { id: 'team-blue' }, 1);
    service.updatePlayerApplicationTeam(appTeam({ displayOrder: 9 }));
    service.removePlayerApplicationTeam('pat-1');

    expect(emissions.slice(before).map(ids)).toEqual([
      ['pat-1'],
      ['pat-1'],
      ['pat-1'],
    ]);
    expect(emissions.at(-1)[0].displayOrder).toBe(0);
  });

  /**
   * Verifies: updateStore and deleteFromStore (the PlayerApplicationTeam SignalR targets) upsert to the front and remove by id.
   * Interacts with: playerApplicationTeams subject.
   * Data: pat-1 added, pat-2 added, pat-1 updated, pat-2 deleted.
   */
  it('updateStore and deleteFromStore keep the list current', () => {
    const { service, emissions } = setup();

    service.updateStore(appTeam());
    service.updateStore(appTeam({ id: 'pat-2' }));
    service.updateStore(appTeam({ displayOrder: 7 }));
    service.deleteFromStore('pat-2');

    expect(emissions.map(ids)).toEqual([
      [],
      ['pat-1'],
      ['pat-2', 'pat-1'],
      ['pat-1', 'pat-2'],
      ['pat-1'],
    ]);
  });
});
