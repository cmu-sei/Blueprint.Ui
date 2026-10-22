// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { describe, it, expect } from 'vitest';
import { DataField, DataFieldType } from 'src/app/generated/blueprint.api';
import { isDateTimeValue } from './date-time-value';
import { dataValueError, hasInvalidDataValue } from './ip-address';

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
    '3/15/2023 0:00 AM',
    ' 3/15/2023 ',
    '2026-10-12T16:00:00.1234567Z',
    '2026-10-12T16:00:00+0400',
    '2024-02-29',
  ])('takes %j as a date', (value) => {
    expect(isDateTimeValue(value)).toBe(true);
  });

  it('takes a Date as a date', () => {
    expect(isDateTimeValue(new Date('2026-10-12T16:00:00Z'))).toBe(true);
  });

  /**
   * Verifies: text left in a field changed to DateTime is not a date, including names new Date() reads as one.
   * Interacts with: isDateTimeValue.
   * Data: "TEAM1"; "Red Team 1" and "Team 2" (new Date() gives 2001); "42" (new Date() gives 2042); "10:00"; an empty string; null;
   * and the dates the API refuses that new Date() rolls over or reads anyway: 30 February, 29 February 2023, hour 24, 13 PM, no space before PM, 8 fractional digits.
   */
  it.each(['TEAM1', 'Red Team 1', 'Team 2', 'Move 3', '42', '10:00', '', null,
    '2026-02-30', '2/30/2023', '2/29/2023', '3/15/2023 24:00', '3/15/2023 13:00 PM', '3/15/2023 6:00PM', '2026-10-12T16:00:00.12345678Z'])('does not take %j as a date', (value) => {
    expect(isDateTimeValue(value)).toBe(false);
  });

  it('does not take an invalid Date as a date', () => {
    expect(isDateTimeValue(new Date('TEAM1'))).toBe(false);
  });
});

describe('a DateTime value that is not a date', () => {
  const WHEN: DataField = { id: 'df-when', name: 'When', dataType: DataFieldType.DateTime };

  /**
   * Verifies: a DateTime value that is not a date has an error and keeps the edit dialogs from saving; a date or an empty value does not.
   * Interacts with: dataValueError, hasInvalidDataValue.
   * Data: When = "Team 2", "2026-10-12T16:00:00.000Z", "" or "   " (only spaces, which the API treats as empty).
   */
  it.each([
    { value: 'Team 2', invalid: true },
    { value: '2026-10-12T16:00:00.000Z', invalid: false },
    { value: '', invalid: false },
    { value: '   ', invalid: false },
  ])('treats $value as invalid: $invalid', ({ value, invalid }) => {
    expect(!!dataValueError(DataFieldType.DateTime, value)).toBe(invalid);
    expect(hasInvalidDataValue([WHEN], [{ id: 'dv-1', dataFieldId: WHEN.id, value }])).toBe(invalid);
  });
});
