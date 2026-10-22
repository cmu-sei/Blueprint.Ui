// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { describe, it, expect } from 'vitest';
import { isDateTimeValue } from './date-time-value';

describe('isDateTimeValue', () => {
  /**
   * Verifies: the forms the date picker saves and the API's xlsx import writes are dates.
   * Interacts with: isDateTimeValue.
   * Data: ISO 8601 with and without milliseconds, offset or time; M/d/yyyy with and without a time; a Date.
   */
  it.each([
    '2026-10-12T16:00:00.000Z',
    '2026-10-12T16:00:00Z',
    '2026-10-12T12:00:00-04:00',
    '2026-10-12',
    '3/15/2023',
    '3/15/2023 18:00',
    '3/15/2023 6:00 PM',
    ' 3/15/2023 ',
  ])('takes %j as a date', (value) => {
    expect(isDateTimeValue(value)).toBe(true);
  });

  it('takes a Date as a date', () => {
    expect(isDateTimeValue(new Date('2026-10-12T16:00:00Z'))).toBe(true);
  });

  /**
   * Verifies: text left in a field changed to DateTime is not a date, including names new Date() reads as one.
   * Interacts with: isDateTimeValue.
   * Data: "TEAM1"; "Red Team 1" and "Team 2" (new Date() gives 2001); "42" (new Date() gives 2042); "10:00"; an empty string; null; an invalid Date.
   */
  it.each(['TEAM1', 'Red Team 1', 'Team 2', 'Move 3', '42', '10:00', '', null])('does not take %j as a date', (value) => {
    expect(isDateTimeValue(value)).toBe(false);
  });

  it('does not take an invalid Date as a date', () => {
    expect(isDateTimeValue(new Date('TEAM1'))).toBe(false);
  });
});
