// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { describe, it, expect, beforeEach } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { PresenceStore } from './presence.store';

const ada = { id: 'u2', name: 'Ada' };
const bob = { id: 'u3', name: 'Bob' };
const me = { id: 'u1', name: 'Me' };

function state(version: number, ...users: { id: string; name: string }[]) {
  return { mselId: 'm1', version, users };
}

describe('PresenceStore', () => {
  let store: PresenceStore;

  const names = async () =>
    (await firstValueFrom(store.actors$)).map((x) => `${x.name}:${x.color}`);

  beforeEach(() => {
    store = new PresenceStore();
  });

  /**
   * Verifies: a state for the open MSEL becomes the list, without the signed-in user, each user once.
   * Data: Me, Ada, Bob and a second Ada at version 1.
   */
  it('shows the other users once each', async () => {
    store.apply(state(1, me, ada, bob, ada), 'm1', 'u1');

    expect(await names()).toEqual(['Ada:primary', 'Bob:accent']);
  });

  /**
   * Verifies: a state older than, or the same as, the last one applied is ignored, so a late answer can't
   * overwrite a newer update.
   * Data: version 3 then versions 2 and 3.
   */
  it('ignores a state that is not newer', async () => {
    store.apply(state(3, bob), 'm1', 'u1');

    store.apply(state(2, ada), 'm1', 'u1');
    store.apply(state(3, ada), 'm1', 'u1');

    expect(await names()).toEqual(['Bob:primary']);
  });

  /**
   * Verifies: a state for another MSEL than the open one is ignored.
   * Data: m2 is open; m1 sends Ada.
   */
  it("ignores a state for a MSEL that isn't open", async () => {
    store.apply(state(1, ada), 'm2', 'u1');

    expect(await names()).toEqual([]);
  });

  /** Verifies: an older API's empty answer changes nothing. */
  it('ignores an empty answer', async () => {
    store.apply(undefined, 'm1', 'u1');

    expect(await names()).toEqual([]);
  });

  /**
   * Verifies: clear() empties the list and forgets the version, so a restarted API's lower versions apply.
   * Data: version 5 applied, cleared, then version 1.
   */
  it('takes a lower version after clear', async () => {
    store.apply(state(5, ada), 'm1', 'u1');
    store.clear();

    store.apply(state(1, bob), 'm1', 'u1');

    expect(await names()).toEqual(['Bob:primary']);
  });

  /**
   * Verifies: a user keeps their colour while they stay, and a colour freed by a departure is reused.
   * Data: Ada and Bob, then Bob alone, then Bob and Cy.
   */
  it('keeps each user their colour', async () => {
    store.apply(state(1, ada, bob), 'm1', 'u1');
    store.apply(state(2, bob), 'm1', 'u1');
    expect(await names()).toEqual(['Bob:accent']);

    store.apply(state(3, bob, { id: 'u4', name: 'Cy' }), 'm1', 'u1');

    expect(await names()).toEqual(['Bob:accent', 'Cy:primary']);
  });

  /** Verifies: the sixth user wraps around the five-colour palette. */
  it('cycles colours past the palette', async () => {
    const users = Array.from({ length: 6 }, (_, i) => ({
      id: `x${i}`,
      name: `U${i}`,
    }));

    store.apply(state(1, ...users), 'm1', 'u1');

    expect((await firstValueFrom(store.actors$)).map((a) => a.color)).toEqual([
      'primary',
      'accent',
      'green',
      'orange',
      'purple',
      'primary',
    ]);
  });
});
