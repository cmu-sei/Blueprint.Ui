// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Pipe, PipeTransform } from '@angular/core';

// The forms a DateTime field holds: the ISO 8601 strings the date picker saves and
// the M/d/yyyy dates, with an optional time, the API's xlsx import writes. The same
// list the API checks a DateTime field's values against.
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const US_DATE_TIME = /^\d{1,2}\/\d{1,2}\/\d{4}( \d{1,2}:\d{2}( ?[AaPp][Mm])?)?$/;

/**
 * True when a DateTime field's value is a date. new Date() alone is not a test,
 * since it reads text such as "Team 2" as February 2001 and "42" as a year.
 */
export function isDateTimeValue(value: unknown): boolean {
  if (value instanceof Date) {
    return !isNaN(value.getTime());
  }
  if (typeof value !== 'string') {
    return false;
  }
  const text = value.trim();
  return (ISO_DATE_TIME.test(text) || US_DATE_TIME.test(text)) &&
    !isNaN(new Date(text).getTime());
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
