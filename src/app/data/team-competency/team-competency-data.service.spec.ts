// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { TeamCompetency, TeamCompetencyService } from 'src/app/generated/blueprint.api';
import { TeamCompetencyStore } from './team-competency.store';
import { TeamCompetencyDataService } from './team-competency-data.service';
import { TeamCompetencyQuery } from './team-competency.query';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { recordEmissions } from 'src/app/test-utils/record-emissions';
import { captureUnhandledRxErrors, flush } from 'src/app/test-utils/unhandled-rx-errors';

function tc(overrides: Partial<TeamCompetency> = {}): TeamCompetency {
  return { id: 'tc-1', teamId: 'team-red', competencyId: 'comp-b', ...overrides };
}

function setup() {
  const tcApi = {
    getMselTeamCompetencies: vi.fn(() => of<TeamCompetency[]>([])),
    getTeamCompetencies: vi.fn(() => of<TeamCompetency[]>([])),
    createTeamCompetency: vi.fn(() => of<TeamCompetency>({})),
    deleteTeamCompetency: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<TeamCompetencyService>;
  TestBed.configureTestingModule({
    providers: [{ provide: TeamCompetencyService, useValue: tcApi }],
  });
  return {
    service: TestBed.inject(TeamCompetencyDataService),
    query: TestBed.inject(TeamCompetencyQuery),
    tcApi,
  };
}

const competencyIds = (list: TeamCompetency[]) => list.map((t) => t.competencyId);

describe('TeamCompetencyDataService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: loadByMsel and loadByTeam replace the store (sorted by competency id) and empty it on failure; TeamCompetencyList mirrors the query.
   * Interacts with: TeamCompetencyService.getMselTeamCompetencies / getTeamCompetencies (stubs), real TeamCompetencyStore and Query.
   * Data: MSEL-wide competencies comp-b and comp-a, then one team's comp-c, then a failure from each.
   */
  it('loaders replace the team competencies, or empty them on failure', () => {
    const { service, query, tcApi } = setup();
    const list = recordEmissions(service.TeamCompetencyList);
    tcApi.getMselTeamCompetencies.mockReturnValueOnce(
      of([tc(), tc({ id: 'tc-2', competencyId: 'comp-a' })]),
    );
    tcApi.getTeamCompetencies.mockReturnValueOnce(of([tc({ id: 'tc-3', competencyId: 'comp-c' })]));
    tcApi.getMselTeamCompetencies.mockReturnValueOnce(throwError(() => new Error('boom')));
    tcApi.getTeamCompetencies.mockReturnValueOnce(throwError(() => new Error('boom')));

    service.loadByMsel('msel-1');
    expect(tcApi.getMselTeamCompetencies).toHaveBeenCalledWith('msel-1');
    expect(competencyIds(list.at(-1))).toEqual(['comp-a', 'comp-b']);

    service.loadByTeam('team-red');
    expect(tcApi.getTeamCompetencies).toHaveBeenCalledWith('team-red');
    expect(competencyIds(query.getAll())).toEqual(['comp-c']);

    service.loadByMsel('msel-1');
    expect(query.getAll()).toEqual([]);
    tcApi.createTeamCompetency.mockReturnValue(of(tc()));
    service.add(tc({ id: undefined }));
    service.loadByTeam('team-red');
    expect(query.getAll()).toEqual([]);
    expect(query.getValue().loading).toBe(false);
  });

  /**
   * Verifies: add stores the created team competency and delete removes it after confirmation; unload clears.
   * Interacts with: TeamCompetencyService.createTeamCompetency / deleteTeamCompetency (stubs), real TeamCompetencyQuery.
   * Data: tc-1 created, tc-2 created, tc-1 deleted.
   */
  it('add, delete and unload keep the store in step with the API', () => {
    const { service, query, tcApi } = setup();
    tcApi.createTeamCompetency.mockReturnValueOnce(of(tc()));
    tcApi.createTeamCompetency.mockReturnValueOnce(of(tc({ id: 'tc-2', competencyId: 'comp-a' })));
    tcApi.deleteTeamCompetency.mockReturnValue(of(null));

    service.add(tc({ id: undefined }));
    service.add(tc({ id: undefined, competencyId: 'comp-a' }));
    expect(competencyIds(query.getAll())).toEqual(['comp-a', 'comp-b']);

    service.delete('tc-1');
    expect(tcApi.deleteTeamCompetency).toHaveBeenCalledWith('tc-1');
    expect(competencyIds(query.getAll())).toEqual(['comp-a']);

    service.unload();
    expect(query.getAll()).toEqual([]);
  });

  /**
   * Verifies: a failed request leaves loading set for every method that sets it first (current behavior), and the ones with no error callback let the error escape.
   * Interacts with: TeamCompetencyService endpoints (stubs failing), real TeamCompetencyStore and TeamCompetencyQuery, captureUnhandledRxErrors.
   * Data: loading cleared first; each endpoint fails with "request failed".
   */
  it.each([
    { method: 'add', endpoint: 'createTeamCompetency', escapes: true, call: (s: TeamCompetencyDataService) => s.add({ id: 'x-1' }) },
  ] as const)('$method leaves loading stuck when its request fails', async ({ endpoint, escapes, call }) => {
    const { service, tcApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    TestBed.inject(TeamCompetencyStore).setLoading(false);
    tcApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    expect(TestBed.inject(TeamCompetencyQuery).getValue().loading).toBe(true);
    // With no error callback the error escapes to ErrorService, the ErrorHandler
    // app.module.ts provides, which shows it.
    expect(errors).toEqual(escapes ? [failure] : []);
  });

  /**
   * Verifies: a failed request from delete escapes to the app's global ErrorHandler.
   * Interacts with: TeamCompetencyService endpoints (stubs failing), captureUnhandledRxErrors.
   * Data: each endpoint fails with "request failed".
   */
  it.each([
    { method: 'delete', endpoint: 'deleteTeamCompetency', call: (s: TeamCompetencyDataService) => s.delete('x-1') },
  ] as const)('$method lets a failed request reach the global ErrorHandler', async ({ endpoint, call }) => {
    const { service, tcApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    tcApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    // These methods subscribe with no error callback and set no loading flag,
    // so the error escapes to ErrorService, the ErrorHandler app.module.ts
    // provides, which shows it to the user. Not a defect on its own.
    expect(errors).toEqual([failure]);
  });
});
