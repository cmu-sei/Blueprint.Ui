// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { PlainTextPipe } from './plain-text-pipe';
import { DisplayOrderPipe, SortByPipe } from './sort-by-pipe';
import { HtmlToText } from './html-to-text';

describe('PlainTextPipe', () => {
  const pipe = new PlainTextPipe();

  /**
   * Verifies: tags (including ones spanning lines) are replaced with spaces, and empty input passes through.
   * Interacts with: PlainTextPipe.transform.
   * Data: HTML with a paragraph and a multi-line tag; a line break; '', null and undefined.
   */
  it.each([
    { input: '<p>Phishing</p><b\nclass="x">email</b>', output: ' Phishing  email ' },
    { input: 'line<br/>break', output: 'line break' },
    { input: '', output: '' },
    { input: null, output: null },
    { input: undefined, output: undefined },
  ])('turns $input into $output', ({ input, output }) => {
    expect(pipe.transform(input)).toBe(output);
  });
});

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

describe('HtmlToText.extractContent', () => {
  /**
   * Verifies: the text of the HTML is returned with runs of spaces collapsed, optionally spacing out adjacent elements.
   * Interacts with: HtmlToText.extractContent (DOM span parsing).
   * Data: "<p>Ransom</p><p>note   arrives</p>" with and without element spacing.
   */
  it.each([
    { space: false, text: 'Ransomnote arrives' },
    { space: true, text: 'Ransom note arrives ' },
  ])('extracts text with element spacing $space', ({ space, text }) => {
    expect(HtmlToText.extractContent('<p>Ransom</p><p>note   arrives</p>', space)).toBe(text);
  });

  /**
   * Verifies: a result ending in ">" has its last two characters trimmed.
   * Interacts with: HtmlToText.extractContent.
   * Data: escaped text "a -&gt;" whose text content ends with ">".
   */
  it('trims a trailing arrow', () => {
    expect(HtmlToText.extractContent('a -&gt;', false)).toBe('a ');
  });
});
