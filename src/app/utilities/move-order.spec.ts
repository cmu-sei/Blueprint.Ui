// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { Move } from 'src/app/generated/blueprint.api';
import { moveOrderConflict, moveOrderProblems } from './move-order';

const move = (moveNumber: number, deltaSeconds: number): Move => ({
  id: `m${moveNumber}`,
  moveNumber,
  deltaSeconds,
});
const RULE = 'Each move must start after the move before it.';

describe('moveOrderConflict', () => {
  /**
   * Verifies: a move must start strictly after the move numbered before it and before the one numbered after it,
   * and the message names the closest conflicting move, as the API's 400 does.
   * Data: Move 0 at 0 and Move 2 at 600; Move 1 at 0, 300, 600 or 900.
   */
  it.each([
    {
      seconds: 0,
      expected: `Move 1 can't start at the same time as Move 0. ${RULE}`,
    },
    { seconds: 300, expected: '' },
    {
      seconds: 600,
      expected: `Move 1 can't start at the same time as Move 2. ${RULE}`,
    },
    { seconds: 900, expected: `Move 1 must start before Move 2. ${RULE}` },
  ])(
    'Move 1 at $seconds between Move 0 at 0 and Move 2 at 600: "$expected"',
    ({ seconds, expected }) => {
      expect(moveOrderConflict(1, seconds, [move(0, 0), move(2, 600)])).toBe(
        expected,
      );
    },
  );

  /**
   * Verifies: a move starting before an earlier-numbered move names the closest such move.
   * Data: Move 0 at 0, Move 1 at 600; Move 2 at 300.
   */
  it('names the closest earlier move a new move starts before', () => {
    expect(moveOrderConflict(2, 300, [move(0, 0), move(1, 600)])).toBe(
      `Move 2 must start after Move 1. ${RULE}`,
    );
  });

  /**
   * Verifies: numbers and starts sent as strings (the API serializes integers as strings) compare as numbers,
   * and a move with the same number is not compared (the API refuses a duplicate number itself).
   * Data: Move "9" at "100", Move 10 at 50 as a string pair; Move 1 at 0 against another Move 1 at 0.
   */
  it('compares string values as numbers and skips a move with the same number', () => {
    const asStrings = {
      moveNumber: '9',
      deltaSeconds: '100',
    } as unknown as Move;
    expect(moveOrderConflict(10, 200, [asStrings])).toBe('');
    expect(moveOrderConflict(10, 50, [asStrings])).toBe(
      `Move 10 must start after Move 9. ${RULE}`,
    );
    expect(moveOrderConflict(1, 0, [move(1, 0)])).toBe('');
  });
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
