// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { Move } from 'src/app/generated/blueprint.api';
import { moveOrderProblems, moveOrderPushProblems } from './move-order';

const move = (moveNumber: number, deltaSeconds: number): Move => ({
  id: `m${moveNumber}`,
  moveNumber,
  deltaSeconds,
});

describe('moveOrderProblems', () => {
  /**
   * Verifies: each consecutive pair by number that shares a start or is out of order is named, whatever order
   * the moves arrive in, and moves in start time order give none.
   * Data: Moves 3, 0, 2, 1 at 600, 0, 1200, 0; then Moves 0, 1 at 0, 60.
   */
  it('names each pair that shares a start or is out of order', () => {
    expect(
      moveOrderProblems([move(3, 600), move(0, 0), move(2, 1200), move(1, 0)]),
    ).toEqual([
      'Move 0 and Move 1 start at the same time.',
      'Move 3 starts before Move 2.',
    ]);
    expect(moveOrderProblems([move(0, 0), move(1, 60)])).toEqual([]);
    expect(moveOrderProblems([])).toEqual([]);
  });
});

describe('moveOrderPushProblems', () => {
  /**
   * Verifies: events that start before the first move are named, as the API's push refusal names them.
   * Data: Move 1 at 600 and Move 2 at 1200; events at 0, 300 and 700.
   */
  it('names the events that start before the first move', () => {
    expect(
      moveOrderPushProblems([move(1, 600), move(2, 1200)], [0, 300, 700]),
    ).toEqual(['2 scenario events start before Move 1, so they are in no move.']);
    expect(moveOrderPushProblems([move(1, 600)], [0])).toEqual([
      '1 scenario event starts before Move 1, so it is in no move.',
    ]);
  });

  it('adds the move order problems and finds none for a valid MSEL or one with no moves', () => {
    expect(moveOrderPushProblems([move(0, 0), move(1, 0)], [0])).toEqual([
      'Move 0 and Move 1 start at the same time.',
    ]);
    expect(moveOrderPushProblems([move(0, 0), move(1, 600)], [0, 700])).toEqual([]);
    expect(moveOrderPushProblems([], [-5, 100])).toEqual([]);
  });
});
