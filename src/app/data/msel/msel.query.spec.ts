// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { Msel, MselItemStatus } from 'src/app/generated/blueprint.api';
import { MselQuery } from './msel.query';
import { MselStore } from './msel.store';

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

describe('MselQuery', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: selectAll orders MSELs by name ascending regardless of insertion order.
   * Interacts with: real MselStore and MselQuery (sortBy name).
   * Data: MSELs named "Charlie", "Alpha", "Bravo" inserted in that order.
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
