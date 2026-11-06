// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { formatPrintDuration, plainText, printFooterCss } from './print-report';

describe('print-report', () => {
  /**
   * Verifies: the footer writes the MSEL name into the named page's bottom-left margin box, escaped as a CSS string
   * on one line.
   * Data: a name with quotes, a backslash and a line break.
   */
  it('writes the MSEL name into the footer as a CSS string', () => {
    expect(printFooterCss('assessment', 'Check "A"\\B\nC')).toBe(
      '@page assessment { @bottom-left { content: "Check \\"A\\"\\\\B C"; } }'
    );
    expect(printFooterCss('assessment', '')).toBe('@page assessment { @bottom-left { content: ""; } }');
  });

  /**
   * Verifies: a duration reads as days, hours and minutes, and a duration under a minute in seconds.
   * Data: 90 minutes, 1 day 1 minute, 45 seconds, and none.
   */
  it('reads a duration in days, hours and minutes', () => {
    expect(formatPrintDuration(5400)).toBe('1 hour 30 minutes');
    expect(formatPrintDuration(86460)).toBe('1 day 1 minute');
    expect(formatPrintDuration(45)).toBe('45 seconds');
    expect(formatPrintDuration(0)).toBe('0 seconds');
  });

  /**
   * Verifies: HTML reads as one line of its text, and nothing reads as empty.
   * Data: a paragraph with a line break and markup, and no value.
   */
  it('reads HTML as one line of plain text', () => {
    expect(plainText('<p>Detect\n  <strong>intrusion</strong></p>')).toBe('Detect intrusion');
    expect(plainText(null)).toBe('');
  });
});
