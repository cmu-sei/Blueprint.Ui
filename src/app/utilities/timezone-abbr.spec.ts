// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { afterEach, describe, it, expect, vi } from 'vitest';
import { getTimezoneAbbr, TimezoneAbbrPipe } from './timezone-abbr';

// Node reads the default time zone from TZ when it is assigned, so a test can
// run in a zone with daylight saving time; unstubAllEnvs restores the host's.
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getTimezoneAbbr', () => {
  const newYork = 'America/New_York';

  /**
   * Verifies: a date while daylight saving time is in effect gets the daylight abbreviation.
   * Interacts with: getTimezoneAbbr (Intl.DateTimeFormat).
   * Data: 12 Oct 2026 16:00 UTC in America/New_York.
   */
  it("labels a date before the DST change with that date's abbreviation", () => {
    expect(getTimezoneAbbr('2026-10-12T16:00:00Z', newYork)).toBe('EDT');
  });

  /**
   * Verifies: a date after daylight saving time ends gets the standard abbreviation.
   * Interacts with: getTimezoneAbbr (Intl.DateTimeFormat).
   * Data: 12 Nov 2026 00:00 UTC in America/New_York (DST ends 1 Nov 2026).
   */
  it("labels a date after the DST change with that date's abbreviation", () => {
    expect(getTimezoneAbbr('2026-11-12T00:00:00Z', newYork)).toBe('EST');
  });

  /**
   * Verifies: the label changes at the instant daylight saving time ends.
   * Interacts with: getTimezoneAbbr (Intl.DateTimeFormat).
   * Data: one minute before and at 1 Nov 2026 06:00 UTC (02:00 EDT) in America/New_York.
   */
  it('switches at the DST boundary', () => {
    expect(getTimezoneAbbr('2026-11-01T05:59:00Z', newYork)).toBe('EDT');
    expect(getTimezoneAbbr('2026-11-01T06:00:00Z', newYork)).toBe('EST');
  });

  /**
   * Verifies: a value that does not parse as a date gets an empty label.
   * Interacts with: getTimezoneAbbr.
   * Data: the string 'not a date', and NaN as a timestamp.
   */
  it('returns an empty label for an invalid date', () => {
    expect(getTimezoneAbbr('not a date', newYork)).toBe('');
    expect(getTimezoneAbbr(Number.NaN, newYork)).toBe('');
  });

  /**
   * Verifies: a Date, an ISO string and a millisecond timestamp for the same instant get the same label.
   * Interacts with: getTimezoneAbbr (Intl.DateTimeFormat).
   * Data: 12 Nov 2026 00:00 UTC in America/New_York, in each accepted form.
   */
  it.each([
    { form: 'a Date', value: new Date('2026-11-12T00:00:00Z') },
    { form: 'an ISO string', value: '2026-11-12T00:00:00Z' },
    { form: 'a timestamp', value: Date.parse('2026-11-12T00:00:00Z') },
  ])('labels $form', ({ value }) => {
    expect(getTimezoneAbbr(value, newYork)).toBe('EST');
  });

  /**
   * Verifies: a zone with no English abbreviation is labelled with its GMT offset, and UTC as UTC.
   * Interacts with: getTimezoneAbbr (Intl.DateTimeFormat).
   * Data: 12 Nov 2026 00:00 UTC in Asia/Kolkata and in UTC.
   */
  it.each([
    { timeZone: 'Asia/Kolkata', label: 'GMT+5:30' },
    { timeZone: 'UTC', label: 'UTC' },
  ])('labels a date in $timeZone as $label', ({ timeZone, label }) => {
    expect(getTimezoneAbbr('2026-11-12T00:00:00Z', timeZone)).toBe(label);
  });

  /**
   * Verifies: an unknown time zone name falls back to the UTC label instead of throwing.
   * Interacts with: getTimezoneAbbr (Intl.DateTimeFormat throws a RangeError).
   * Data: a valid date in the zone 'Not/AZone'.
   */
  it('falls back to UTC for an unknown time zone', () => {
    expect(getTimezoneAbbr('2026-11-12T00:00:00Z', 'Not/AZone')).toBe('UTC');
  });

  /**
   * Verifies: without a zone argument the date is labelled in the browser's own zone, by that date.
   * Interacts with: getTimezoneAbbr (Intl.DateTimeFormat default zone).
   * Data: TZ set to America/New_York; an October and a November date.
   */
  it("uses the browser's zone when none is given", () => {
    vi.stubEnv('TZ', newYork);

    expect(getTimezoneAbbr('2026-10-12T16:00:00Z')).toBe('EDT');
    expect(getTimezoneAbbr('2026-11-12T00:00:00Z')).toBe('EST');
  });
});

describe('TimezoneAbbrPipe', () => {
  const pipe = new TimezoneAbbrPipe();

  /**
   * Verifies: the pipe renders nothing when there is no date to label.
   * Interacts with: TimezoneAbbrPipe.transform.
   * Data: null, undefined and ''.
   */
  it('returns an empty label when there is no date', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform('')).toBe('');
  });

  /**
   * Verifies: the pipe labels each date with the abbreviation in effect on that date in the browser's zone.
   * Interacts with: TimezoneAbbrPipe.transform, getTimezoneAbbr.
   * Data: TZ set to America/New_York; an October and a November date.
   */
  it('labels a date', () => {
    vi.stubEnv('TZ', 'America/New_York');

    expect(pipe.transform('2026-10-12T16:00:00Z')).toBe('EDT');
    expect(pipe.transform(new Date('2026-11-12T00:00:00Z'))).toBe('EST');
  });

  /**
   * Verifies: the pipe gives an empty label for a value that does not parse as a date.
   * Interacts with: TimezoneAbbrPipe.transform, getTimezoneAbbr.
   * Data: the string 'not a date'.
   */
  it('returns an empty label for a value that is not a date', () => {
    expect(pipe.transform('not a date')).toBe('');
  });
});
