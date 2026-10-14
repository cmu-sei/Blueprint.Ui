// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Pipe, PipeTransform } from '@angular/core';

/**
 * Short time zone name (e.g. "EST", "EDT") for the given date in the
 * user's time zone. The abbreviation depends on the date, not today,
 * so a November date is labelled EST even while it is EDT now.
 */
export function getTimezoneAbbr(
  value: Date | string | number,
  timeZone?: string
): string {
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return '';
  }
  try {
    const part = new Intl.DateTimeFormat('en-US', {
      timeZoneName: 'short',
      timeZone,
    })
      .formatToParts(date)
      .find((p) => p.type === 'timeZoneName');
    return part?.value || 'UTC';
  } catch {
    return 'UTC';
  }
}

/*
 {{ value | date: 'dd MMM yyyy HH:mm' }} {{ value | timezoneAbbr }}
*/
@Pipe({
  name: 'timezoneAbbr',
  standalone: false,
})
export class TimezoneAbbrPipe implements PipeTransform {
  transform(value: Date | string | number): string {
    if (value === null || value === undefined || value === '') {
      return '';
    }
    return getTimezoneAbbr(value);
  }
}
