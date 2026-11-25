// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import {
  MselCountermeasures,
  MselTechnique,
  MselTechniqueService,
  TechniqueCountermeasureImport,
  TechniqueReleaseService,
} from 'src/app/generated/blueprint.api';
import { MselTechniqueDataService } from './msel-technique-data.service';
import { MselCountermeasureDataService } from './msel-countermeasure-data.service';
import { MselTechniqueQuery } from './msel-technique.query';
import { TechniqueReleaseDataService } from 'src/app/data/technique-release/technique-release-data.service';
import { TechniqueReleaseQuery } from 'src/app/data/technique-release/technique-release.query';
import { LoadedCountermeasures } from './msel-countermeasure-data.service';
import { ApiStub } from 'src/app/test-utils/api-stub';

function pooled(mselId: string, techniqueId: string): MselTechnique {
  return { id: `${mselId}-${techniqueId}`, mselId, techniqueId };
}

function answer(mselId: string, hasMappings = true): MselCountermeasures {
  return {
    mselId,
    techniqueReleaseId: 'd3fend-1',
    hasMappings,
    techniques: [],
  };
}

function setup() {
  // each call answers with the next queued response, so a test decides which arrives first
  const pools: Subject<MselTechnique[]>[] = [];
  const answers: Subject<MselCountermeasures>[] = [];
  const mselApi = {
    getMselTechniques: vi.fn(() => {
      const response = new Subject<MselTechnique[]>();
      pools.push(response);
      return response;
    }),
    getMselCountermeasures: vi.fn(() => {
      const response = new Subject<MselCountermeasures>();
      answers.push(response);
      return response;
    }),
  } satisfies ApiStub<MselTechniqueService>;
  const releaseList = new Subject<never[]>();
  const releaseApi = {
    importTechniqueCountermeasures: vi.fn(() =>
      of<TechniqueCountermeasureImport>({ pairsStored: 3 }),
    ),
    getTechniqueReleases: vi.fn(() => releaseList),
  } satisfies ApiStub<TechniqueReleaseService>;
  TestBed.configureTestingModule({
    providers: [
      { provide: MselTechniqueService, useValue: mselApi },
      { provide: TechniqueReleaseService, useValue: releaseApi },
    ],
  });
  return {
    pool: TestBed.inject(MselTechniqueDataService),
    query: TestBed.inject(MselTechniqueQuery),
    countermeasures: TestBed.inject(MselCountermeasureDataService),
    releases: TestBed.inject(TechniqueReleaseDataService),
    releaseQuery: TestBed.inject(TechniqueReleaseQuery),
    releaseList,
    mselApi,
    pools,
    answers,
  };
}

function latest(service: MselCountermeasureDataService) {
  let value: LoadedCountermeasures | undefined;
  service.countermeasures$.subscribe((v) => (value = v)).unsubscribe();
  return value;
}

describe('MselTechniqueDataService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: a pool answer for a MSEL since left does not replace the current MSEL's pool, whichever arrives first.
   * Interacts with: MselTechniqueService.getMselTechniques (stub), real MselTechniqueStore and Query.
   * Data: MSEL A's load, then MSEL B's; B answers first, then A.
   */
  it("keeps the current MSEL's pool when an earlier MSEL's answer arrives late", () => {
    const { pool, query, pools } = setup();

    pool.loadByMsel('msel-a');
    pool.loadByMsel('msel-b');
    pools[1].next([pooled('msel-b', 't-b')]);
    pools[0].next([pooled('msel-a', 't-a')]);

    expect(query.getAll().map((m) => m.techniqueId)).toEqual(['t-b']);
    expect(query.getValue().loading).toBe(false);
  });

  /**
   * Verifies: a failed pool load empties the pool and ends loading, rather than leaving it loading.
   * Interacts with: MselTechniqueService.getMselTechniques (stub failing).
   * Data: MSEL A, whose pool read fails.
   */
  it('ends loading when the pool cannot be read', () => {
    const { pool, query, pools } = setup();

    pool.loadByMsel('msel-a');
    pools[0].error(new Error('500'));

    expect(query.getAll()).toEqual([]);
    expect(query.getValue().loading).toBe(false);
  });
});

describe('MselCountermeasureDataService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: a countermeasures answer for a MSEL since left does not replace the current MSEL's.
   * Interacts with: MselTechniqueService.getMselCountermeasures (stub).
   * Data: MSEL A's load, then MSEL B's; B answers first, then A.
   */
  it("keeps the current MSEL's countermeasures when an earlier answer arrives late", () => {
    const { countermeasures, answers } = setup();

    countermeasures.load('msel-a');
    countermeasures.load('msel-b');
    answers[1].next(answer('msel-b'));
    answers[0].next(answer('msel-a'));

    expect(latest(countermeasures)?.mselId).toBe('msel-b');
    expect(countermeasures.loading).toBe(false);
  });

  /**
   * Verifies: importing a mappings file reads the loaded MSEL's countermeasures again, though its pool is unchanged.
   * Interacts with: TechniqueReleaseDataService.importCountermeasures, TechniqueReleaseService (stub).
   * Data: MSEL A loaded with no mappings; mappings then imported onto the D3FEND release.
   */
  it("reads a MSEL's countermeasures again when mappings are imported", () => {
    const { countermeasures, releases, mselApi, answers } = setup();
    countermeasures.load('msel-a');
    answers[0].next(answer('msel-a', false));

    releases.importCountermeasures('d3fend-1', new Blob(['{}'])).subscribe();
    answers[1].next(answer('msel-a'));

    expect(mselApi.getMselCountermeasures).toHaveBeenCalledTimes(2);
    expect(latest(countermeasures)?.hasMappings).toBe(true);
  });

  /**
   * Verifies: a failed countermeasures read is marked as failed, so it is not shown as "nothing imported".
   * Interacts with: MselTechniqueService.getMselCountermeasures (stub failing).
   * Data: MSEL A, whose countermeasures read fails.
   */
  it('marks countermeasures that could not be read', () => {
    const { countermeasures, answers } = setup();

    countermeasures.load('msel-a');
    answers[0].error(new Error('500'));

    expect(latest(countermeasures)).toMatchObject({
      techniqueReleaseId: null,
      loadFailed: true,
    });
    expect(countermeasures.loading).toBe(false);
  });

  /**
   * Verifies: unloading while a read is under way ends loading, and the late answer is dropped.
   * Interacts with: unload, MselTechniqueService.getMselCountermeasures (stub).
   * Data: MSEL A's read, unloaded before it answers.
   */
  it('ends loading when unloaded during a read', () => {
    const { countermeasures, answers } = setup();

    countermeasures.load('msel-a');
    countermeasures.unload();
    answers[0].next(answer('msel-a'));

    expect(countermeasures.loading).toBe(false);
    expect(latest(countermeasures)).toBeUndefined();
  });

  /**
   * Verifies: with no MSEL loaded, importing mappings asks for no countermeasures.
   * Interacts with: TechniqueReleaseDataService.importCountermeasures.
   * Data: no MSEL loaded.
   */
  it('reads nothing when mappings are imported with no MSEL loaded', () => {
    const { releases, mselApi } = setup();

    releases.importCountermeasures('d3fend-1', new Blob(['{}'])).subscribe();

    expect(mselApi.getMselCountermeasures).not.toHaveBeenCalled();
  });
});

describe('TechniqueReleaseDataService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: a failed release list read ends loading, so the import buttons it disables come back.
   * Interacts with: TechniqueReleaseService.getTechniqueReleases (stub failing), real TechniqueReleaseStore and Query.
   * Data: a release list read that fails.
   */
  it('ends loading when the releases cannot be read', () => {
    const { releases, releaseQuery, releaseList } = setup();

    releases.load();
    expect(releaseQuery.getValue().loading).toBe(true);
    releaseList.error(new Error('500'));

    expect(releaseQuery.getValue().loading).toBe(false);
    expect(releaseQuery.getAll()).toEqual([]);
  });
});
