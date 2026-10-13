// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { PlainTextPipe } from './plain-text-pipe';

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
