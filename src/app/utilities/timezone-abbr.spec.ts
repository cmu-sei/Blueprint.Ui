// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { getTimezoneAbbr, TimezoneAbbrPipe } from './timezone-abbr';

describe('getTimezoneAbbr', () => {
  const newYork = 'America/New_York';

  it('labels a date before the DST change with that date\'s abbreviation', () => {
    expect(getTimezoneAbbr('2026-10-12T16:00:00Z', newYork)).toBe('EDT');
  });

  it('labels a date after the DST change with that date\'s abbreviation', () => {
    // DST ends 1 Nov 2026; TideLink move 1
    expect(getTimezoneAbbr('2026-11-12T00:00:00Z', newYork)).toBe('EST');
  });

  it('switches at the DST boundary', () => {
    // 1 Nov 2026 02:00 EDT = 06:00Z
    expect(getTimezoneAbbr('2026-11-01T05:59:00Z', newYork)).toBe('EDT');
    expect(getTimezoneAbbr('2026-11-01T06:00:00Z', newYork)).toBe('EST');
  });

  it('returns an empty label for an invalid date', () => {
    expect(getTimezoneAbbr('not a date', newYork)).toBe('');
  });
});

describe('TimezoneAbbrPipe', () => {
  const pipe = new TimezoneAbbrPipe();

  it('returns an empty label when there is no date', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform('')).toBe('');
  });

  it('labels a date', () => {
    expect(pipe.transform('2026-11-12T00:00:00Z')).not.toBe('');
  });
});
