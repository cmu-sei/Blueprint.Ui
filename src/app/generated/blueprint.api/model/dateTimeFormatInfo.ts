/*
 Copyright 2024 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

/**
 * Blueprint API
 * No description provided (generated by Openapi Generator https://github.com/openapitools/openapi-generator)
 *
 * The version of the OpenAPI document: v1
 * 
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */
import { DayOfWeek } from './dayOfWeek';
import { CalendarWeekRule } from './calendarWeekRule';
import { Calendar } from './calendar';


export interface DateTimeFormatInfo { 
    amDesignator?: string | null;
    calendar?: Calendar;
    dateSeparator?: string | null;
    firstDayOfWeek?: DayOfWeek;
    calendarWeekRule?: CalendarWeekRule;
    fullDateTimePattern?: string | null;
    longDatePattern?: string | null;
    longTimePattern?: string | null;
    monthDayPattern?: string | null;
    pmDesignator?: string | null;
    readonly rfC1123Pattern?: string | null;
    shortDatePattern?: string | null;
    shortTimePattern?: string | null;
    readonly sortableDateTimePattern?: string | null;
    timeSeparator?: string | null;
    readonly universalSortableDateTimePattern?: string | null;
    yearMonthPattern?: string | null;
    abbreviatedDayNames?: Array<string> | null;
    shortestDayNames?: Array<string> | null;
    dayNames?: Array<string> | null;
    abbreviatedMonthNames?: Array<string> | null;
    monthNames?: Array<string> | null;
    readonly isReadOnly?: boolean;
    readonly nativeCalendarName?: string | null;
    abbreviatedMonthGenitiveNames?: Array<string> | null;
    monthGenitiveNames?: Array<string> | null;
}

