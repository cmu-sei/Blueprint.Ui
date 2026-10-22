// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Pipe, PipeTransform } from '@angular/core';

// The forms a DateTime field holds, as the API's ServiceUtilities.IsDateTimeValue reads them: the
// ISO 8601 strings the date picker saves and the M/d/yyyy dates, with an optional time, the API's
// xlsx import writes. Each part is captured so the date can be checked against the calendar.
const ISO_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?:(?::(\d{2})(?:\.\d{1,7})?)?(?:Z|[+-]\d{2}:?\d{2})?)?)?$/;
const US_DATE_TIME = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?: (\d{1,2}):(\d{2})( [AaPp][Mm])?)?$/;

function isCalendarDate(year: number, month: number, day: number): boolean {
  // day 0 of the next month is the last day of this one
  return month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isTimeOfDay(hour: number, minute: number, second: number, isTwelveHour: boolean): boolean {
  return hour <= (isTwelveHour ? 12 : 23) && minute <= 59 && second <= 59;
}

/**
 * True when a DateTime field's value is a date. new Date() alone is not a test, since it reads
 * text such as "Team 2" as February 2001 and "42" as a year, and rolls 2/30/2023 over to March 2.
 */
export function isDateTimeValue(value: unknown): boolean {
  if (value instanceof Date) {
    return !isNaN(value.getTime());
  }
  if (typeof value !== 'string') {
    return false;
  }
  const text = value.trim();
  const iso = ISO_DATE_TIME.exec(text);
  if (iso) {
    const [, year, month, day, hour = '0', minute = '0', second = '0'] = iso;
    return isCalendarDate(+year, +month, +day) && isTimeOfDay(+hour, +minute, +second, false);
  }
  const us = US_DATE_TIME.exec(text);
  if (us) {
    const [, month, day, year, hour = '0', minute = '0', meridiem] = us;
    return isCalendarDate(+year, +month, +day) && isTimeOfDay(+hour, +minute, 0, !!meridiem);
  }
  return false;
}

/**
 * True for a value with nothing in it: empty, null or only spaces. The date picker writes a Date,
 * which is never blank, so only a string is trimmed.
 */
export function isBlankValue(value: unknown): boolean {
  return value == null || (typeof value === 'string' && !value.trim());
}

/*
 @if (value | isDateTimeValue) { {{ value | date: 'dd MMM yyyy HH:mm' }} }
*/
@Pipe({
  name: 'isDateTimeValue',
  standalone: false,
})
export class IsDateTimeValuePipe implements PipeTransform {
  transform(value: unknown): boolean {
    return isDateTimeValue(value);
  }
}
