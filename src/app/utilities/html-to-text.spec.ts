// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { HtmlToText } from './html-to-text';

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
