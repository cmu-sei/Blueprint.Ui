// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { DisplayOrderPipe, SortByPipe } from './sort-by-pipe';

describe('SortByPipe', () => {
  const pipe = new SortByPipe();

  /**
   * Verifies: without an order, or with fewer than two items, the input comes back untouched.
   * Interacts with: SortByPipe.transform.
   * Data: an unordered list with no order and with a null order; a null list; a one-item list.
   */
  it.each([
    { label: 'no order', list: ['b', 'a'], order: undefined },
    { label: 'a null order', list: ['b', 'a'], order: null },
    { label: 'a null list', list: null, order: 'asc' },
    { label: 'a one-item list', list: ['only'], order: 'asc' },
  ])('returns the input for $label', ({ list, order }) => {
    expect(pipe.transform(list, order)).toBe(list);
  });

  /**
   * Verifies: a plain array sorts ascending or descending, in place.
   * Interacts with: SortByPipe.transform (1-D branch).
   * Data: ['charlie', 'alpha', 'bravo'] sorted asc, then desc.
   */
  it('sorts a plain array in place', () => {
    const list = ['charlie', 'alpha', 'bravo'];

    const asc = pipe.transform(list, 'asc');
    expect(asc).toEqual(['alpha', 'bravo', 'charlie']);
    expect(asc).toBe(list);

    expect(pipe.transform(list, 'desc')).toEqual(['charlie', 'bravo', 'alpha']);
  });

  /**
   * Verifies: on a plain array, any order other than 'asc' sorts descending, and an empty column counts as no column.
   * Interacts with: SortByPipe.transform (1-D branch).
   * Data: ['bravo', 'alpha', 'charlie'] with order 'DESC' and column ''.
   */
  it('sorts a plain array descending for any order but asc', () => {
    expect(pipe.transform(['bravo', 'alpha', 'charlie'], 'DESC', '')).toEqual(['charlie', 'bravo', 'alpha']);
  });

  /**
   * Verifies: an array of objects sorts on the given column in the given direction, returning a new array.
   * Interacts with: SortByPipe.transform (lodash orderBy branch).
   * Data: three moves sorted by moveNumber asc and desc.
   */
  it('sorts objects on a column into a new array', () => {
    const moves = [{ moveNumber: 2 }, { moveNumber: 3 }, { moveNumber: 1 }];

    const asc = pipe.transform(moves, 'asc', 'moveNumber');

    expect(asc.map((m) => m.moveNumber)).toEqual([1, 2, 3]);
    expect(asc).not.toBe(moves);
    expect(pipe.transform(moves, 'desc', 'moveNumber').map((m) => m.moveNumber)).toEqual([3, 2, 1]);
  });
});

describe('DisplayOrderPipe', () => {
  const pipe = new DisplayOrderPipe();

  /**
   * Verifies: items are returned in displayOrder in a new array, and short or missing lists pass through.
   * Interacts with: DisplayOrderPipe.transform.
   * Data: options with displayOrder 3, 1, 2; a one-item list; null.
   */
  it('orders by displayOrder without mutating the input', () => {
    const options = [
      { name: 'c', displayOrder: 3 },
      { name: 'a', displayOrder: 1 },
      { name: 'b', displayOrder: 2 },
    ];

    const sorted = pipe.transform(options);

    expect(sorted.map((o) => o.name)).toEqual(['a', 'b', 'c']);
    expect(options.map((o) => o.name)).toEqual(['c', 'a', 'b']);
    expect(pipe.transform([options[0]])).toEqual([options[0]]);
    expect(pipe.transform(null)).toBeNull();
  });
});
